import { isAbsolute, relative, resolve, sep } from 'node:path'

export interface RuntimeConfiguration {
  host: '127.0.0.1' | '::1' | '0.0.0.0'
  port: number
  dbPath: string
}

function validatePublicOrigins(raw: string | undefined): void {
  const origins = raw?.split(',').map((origin) => origin.trim()) ?? []
  if (!origins.length)
    throw new Error(
      'Public deployment requires PORTAL_WEB_ORIGIN with the exact HTTPS frontend origin.',
    )
  for (const origin of origins) {
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      throw new Error(
        'PORTAL_WEB_ORIGIN must contain exact HTTPS origins, without paths or wildcards.',
      )
    }
    if (
      url.protocol !== 'https:' ||
      origin !== url.origin ||
      url.hostname.includes('*') ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw new Error(
        'PORTAL_WEB_ORIGIN must contain exact HTTPS origins, without paths or wildcards.',
      )
  }
}

export function runtimeConfigurationFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const host = env.PORTAL_API_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1' && host !== '::1' && host !== '0.0.0.0')
    throw new Error('PORTAL_API_HOST must be 127.0.0.1, ::1 or 0.0.0.0.')
  const rawPort = env.PORTAL_API_PORT ?? env.PORT ?? '4003'
  const port = Number(rawPort)
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORTAL_API_PORT (or PORT) must be a valid TCP port.')

  const publicRuntime = host === '0.0.0.0' || env.NODE_ENV === 'production'
  if (publicRuntime) {
    validatePublicOrigins(env.PORTAL_WEB_ORIGIN)
    if (!env.PORTAL_DB_PATH || !isAbsolute(env.PORTAL_DB_PATH))
      throw new Error(
        'Public deployment requires an absolute PORTAL_DB_PATH on persistent storage.',
      )
  }
  if (env.PORTAL_DB_PATH !== undefined && !env.PORTAL_DB_PATH.trim())
    throw new Error('PORTAL_DB_PATH must not be empty.')
  const dbPath = resolve(env.PORTAL_DB_PATH ?? '.local/portal/portal.sqlite')

  // Railway sets this metadata only when an actual volume is attached. A default
  // /data directory in a container image alone does not provide persistence.
  if (env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_VOLUME_MOUNT_PATH) {
    const mount = env.RAILWAY_VOLUME_MOUNT_PATH
    if (!mount || !isAbsolute(mount))
      throw new Error('Attach a persistent Railway volume before starting the API.')
    const child = relative(resolve(mount), dbPath)
    if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child))
      throw new Error('PORTAL_DB_PATH must point to a file inside the attached Railway volume.')
  }
  return { host, port, dbPath }
}
