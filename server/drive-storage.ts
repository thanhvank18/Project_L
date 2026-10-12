import { createHash, createPrivateKey } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { JWT, OAuth2Client } from 'google-auth-library'
import type { FileRecord } from '../shared/portal.ts'
import { HttpError } from './errors.ts'

const driveApi = 'https://www.googleapis.com/drive/v3'
const uploadApi = 'https://www.googleapis.com/upload/drive/v3'
const maximumFileSize = 8 * 1024 * 1024
const maximumJsonSize = 64 * 1024
const timeoutMs = 15_000
const driveId = /^[A-Za-z0-9_-]{5,200}$/

export interface RemoteFileLocation {
  provider: 'google-drive'
  connectionId?: string
  fileId: string
  folderId: string
  sharedDriveId: string | null
  sha256: string
}

export interface RemoteFileStorage {
  allocate(record: FileRecord, bytes: Buffer): Promise<RemoteFileLocation>
  write(location: RemoteFileLocation, record: FileRecord, bytes: Buffer): Promise<void>
  read(location: RemoteFileLocation, record: FileRecord): Promise<Buffer>
  remove(location: RemoteFileLocation): Promise<void>
}

export interface SubmissionStorageConfiguration {
  mode: 'sqlite' | 'google-drive'
  drive?: RemoteFileStorage
}

export interface DriveStorageOptions {
  folderId: string
  sharedDriveId?: string
  requireSharedDrive: boolean
  getAccessToken: () => Promise<string>
  fetch?: typeof globalThis.fetch
}

export const storageUnavailable = () =>
  new HttpError(
    503,
    'storage_unavailable',
    'Submission file storage is unavailable. Try again later.',
  )
const integrityFailure = () =>
  new HttpError(
    502,
    'file_integrity',
    'The stored file could not be verified. Contact an administrator.',
  )
export const fileDigest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

async function boundedToken(getAccessToken: () => Promise<string>): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      getAccessToken(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(storageUnavailable()), timeoutMs)
        timer.unref()
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function responseBytes(response: Response, maximum: number): Promise<Buffer> {
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) {
    await response.body?.cancel()
    throw integrityFailure()
  }
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximum) {
        await reader.cancel()
        throw integrityFailure()
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

/** Only fixed Google endpoints are used. Provider IDs and credentials never enter public file records. */
export function createDriveStorage(options: DriveStorageOptions): RemoteFileStorage {
  if (
    !driveId.test(options.folderId) ||
    (options.sharedDriveId !== undefined && !driveId.test(options.sharedDriveId)) ||
    (options.requireSharedDrive && !options.sharedDriveId)
  )
    throw new Error('Google Drive folder and Shared Drive configuration is invalid.')
  const request = options.fetch ?? globalThis.fetch
  const remotePath = (location: RemoteFileLocation) => {
    if (!driveId.test(location.fileId)) throw storageUnavailable()
    return `/files/${encodeURIComponent(location.fileId)}?supportsAllDrives=true`
  }
  async function call(
    path: string,
    init: RequestInit = {},
    maximum = maximumJsonSize,
    upload = false,
    inspectHeaders?: (headers: Headers) => void,
  ): Promise<Buffer> {
    try {
      const token = await boundedToken(options.getAccessToken)
      if (!token || /[\r\n]/.test(token)) throw storageUnavailable()
      const response = await request(`${upload ? uploadApi : driveApi}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw storageUnavailable()
      }
      try {
        inspectHeaders?.(response.headers)
      } catch (error) {
        await response.body?.cancel()
        throw error
      }
      return await responseBytes(response, maximum)
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw storageUnavailable()
    }
  }
  async function json(path: string): Promise<Record<string, unknown>> {
    try {
      const value: unknown = JSON.parse((await call(path)).toString('utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw storageUnavailable()
      return value as Record<string, unknown>
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw storageUnavailable()
    }
  }
  return {
    async allocate(_record, bytes) {
      const folder = await json(
        `/files/${encodeURIComponent(options.folderId)}?supportsAllDrives=true&fields=id,mimeType,trashed,driveId,capabilities(canAddChildren)`,
      )
      const capabilities = folder.capabilities as Record<string, unknown> | undefined
      if (
        folder.id !== options.folderId ||
        folder.mimeType !== 'application/vnd.google-apps.folder' ||
        folder.trashed === true ||
        capabilities?.canAddChildren !== true ||
        (options.requireSharedDrive && !folder.driveId) ||
        (options.sharedDriveId && folder.driveId !== options.sharedDriveId)
      )
        throw storageUnavailable()
      const generated = await json('/files/generateIds?count=1&space=drive&type=files')
      const fileId = Array.isArray(generated.ids) ? generated.ids[0] : undefined
      if (typeof fileId !== 'string' || !driveId.test(fileId)) throw storageUnavailable()
      return {
        provider: 'google-drive',
        fileId,
        folderId: options.folderId,
        sharedDriveId: typeof folder.driveId === 'string' ? folder.driveId : null,
        sha256: fileDigest(bytes),
      }
    },
    async write(location, record, bytes) {
      remotePath(location)
      if (location.folderId !== options.folderId || location.sha256 !== fileDigest(bytes))
        throw integrityFailure()
      const metadata = {
        id: location.fileId,
        name: `${record.id}--${record.name}`,
        mimeType: record.mime,
        parents: [location.folderId],
        appProperties: { portalFileId: record.id, portalSha256: location.sha256 },
      }
      let uploadPath = ''
      await call(
        '/files?uploadType=resumable&supportsAllDrives=true&fields=id,size',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': record.mime,
            'X-Upload-Content-Length': String(bytes.length),
          },
          body: JSON.stringify(metadata),
        },
        maximumJsonSize,
        true,
        (headers) => {
          const session = new URL(headers.get('location') ?? '')
          if (
            session.origin !== 'https://www.googleapis.com' ||
            session.pathname !== '/upload/drive/v3/files' ||
            session.username ||
            session.password ||
            session.hash ||
            session.searchParams.get('uploadType') !== 'resumable' ||
            !session.searchParams.get('upload_id')
          )
            throw storageUnavailable()
          uploadPath = `/files${session.search}`
        },
      )
      const result = await call(
        uploadPath,
        {
          method: 'PUT',
          headers: { 'Content-Type': record.mime, 'Content-Length': String(bytes.length) },
          body: bytes,
        },
        maximumJsonSize,
        true,
      )
      try {
        const uploaded = JSON.parse(result.toString('utf8')) as Record<string, unknown>
        if (uploaded.id !== location.fileId || Number(uploaded.size) !== bytes.length)
          throw integrityFailure()
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw storageUnavailable()
      }
    },
    async read(location, record) {
      const bytes = await call(`${remotePath(location)}&alt=media`, {}, maximumFileSize)
      if (bytes.length !== record.size || fileDigest(bytes) !== location.sha256)
        throw integrityFailure()
      return bytes
    },
    async remove(location) {
      await call(remotePath(location), { method: 'DELETE' }, maximumJsonSize)
    },
  }
}

/** Read only explicitly selected credential formats; do not discover ADC or trust credential endpoints. */
export function submissionStorageFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): SubmissionStorageConfiguration {
  const mode = env.PORTAL_SUBMISSION_STORAGE?.trim() || 'sqlite'
  if (mode !== 'sqlite' && mode !== 'google-drive')
    throw new Error('PORTAL_SUBMISSION_STORAGE must be sqlite or google-drive.')
  const configured = Object.entries(env).some(
    ([key, value]) => key.startsWith('PORTAL_DRIVE_') && value?.trim(),
  )
  if (mode === 'sqlite' && !configured) return { mode }
  try {
    const folderId = env.PORTAL_DRIVE_FOLDER_ID?.trim() ?? ''
    const sharedDriveId = env.PORTAL_DRIVE_SHARED_DRIVE_ID?.trim() || undefined
    const path = env.PORTAL_DRIVE_CREDENTIALS_FILE?.trim()
    const authMode = env.PORTAL_DRIVE_AUTH_MODE?.trim()
    if (!path || !['service-account', 'oauth'].includes(authMode ?? '')) throw storageUnavailable()
    const file = statSync(path)
    if (!file.isFile() || file.size > maximumJsonSize) throw storageUnavailable()
    const credentials = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const transporterOptions = {
      timeout: timeoutMs,
      retry: false,
      maxContentLength: maximumJsonSize,
      maxRedirects: 0,
    }
    let client: OAuth2Client
    if (authMode === 'service-account') {
      if (
        credentials.type !== 'service_account' ||
        typeof credentials.client_email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(credentials.client_email) ||
        typeof credentials.private_key !== 'string' ||
        !sharedDriveId
      )
        throw storageUnavailable()
      if (createPrivateKey(credentials.private_key).asymmetricKeyType !== 'rsa')
        throw storageUnavailable()
      client = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/drive'],
        transporterOptions,
      })
    } else {
      if (
        credentials.type !== 'authorized_user' ||
        typeof credentials.client_id !== 'string' ||
        !credentials.client_id.endsWith('.apps.googleusercontent.com') ||
        typeof credentials.client_secret !== 'string' ||
        !credentials.client_secret.trim() ||
        typeof credentials.refresh_token !== 'string' ||
        !credentials.refresh_token.trim()
      )
        throw storageUnavailable()
      client = new OAuth2Client({
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        transporterOptions,
      })
      client.setCredentials({ refresh_token: credentials.refresh_token })
    }
    return {
      mode,
      drive: createDriveStorage({
        folderId,
        sharedDriveId,
        requireSharedDrive: authMode === 'service-account',
        getAccessToken: async () => {
          const result = await client.getAccessToken()
          if (!result.token) throw storageUnavailable()
          return result.token
        },
      }),
    }
  } catch {
    throw new Error(
      'Google Drive storage configuration is incomplete or invalid. Check the private server configuration.',
    )
  }
}
