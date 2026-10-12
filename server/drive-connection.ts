import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library'
import type { Account, AuditEntry, FileRecord } from '../shared/portal.ts'
import type { DriveConnectionStatus, DriveFolder, DriveFolderPage } from '../shared/drive.ts'
import { tokenHash } from './auth.ts'
import type { Database } from './db.ts'
import { all, authenticated, get, id, now, put, remove, role, transaction } from './domain-store.ts'
import {
  createDriveStorage,
  storageUnavailable,
  type RemoteFileLocation,
  type RemoteFileStorage,
  type SubmissionStorageConfiguration,
} from './drive-storage.ts'
import { HttpError } from './errors.ts'

const callbackPath = '/api/v1/portal/drive/callback'
const scope = 'https://www.googleapis.com/auth/drive'
const folderMime = 'application/vnd.google-apps.folder'
const identifier = /^[A-Za-z0-9_-]{5,200}$/
const statePattern = /^[A-Za-z0-9_-]{43}$/
const timeout = 15_000
interface Identity {
  id: string
  email: string
  name: string
}
interface Connection {
  id: 'centre'
  version: number
  connectionId: string
  account: Identity | null
  refresh?: string
  folder: DriveFolder | null
  enabled: boolean
  authRequired?: boolean
}
interface Pending {
  id: string
  cookieHash: string
  verifier: string
  sessionHash: string
  userId: string
  expectedVersion: number
  expiresAt: number
}
export interface DriveOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  encryptionKey: Buffer
}
export interface DriveOAuthGateway {
  authorizationUrl(state: string, challenge: string): string
  exchange(code: string, verifier: string): Promise<{ refreshToken: string; accessToken: string }>
  access(refreshToken: string): Promise<string>
  identity(accessToken: string): Promise<Identity>
  folders(accessToken: string, parentId: string, pageToken?: string): Promise<DriveFolderPage>
  folder(accessToken: string, folderId: string): Promise<DriveFolder>
}

export function driveOAuthConfigFromEnvironment(
  dbPath: string,
  env: NodeJS.ProcessEnv = process.env,
): DriveOAuthConfig | undefined {
  const clientId = env.PORTAL_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.PORTAL_GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = env.PORTAL_GOOGLE_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) return undefined
  const uri = new URL(redirectUri)
  const allowed = (env.PORTAL_WEB_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((v) => v.trim())
  if (
    !clientId.endsWith('.apps.googleusercontent.com') ||
    /[\r\n]/.test(clientSecret) ||
    uri.pathname !== callbackPath ||
    uri.search ||
    uri.hash ||
    uri.username ||
    uri.password ||
    !allowed.includes(uri.origin) ||
    (uri.protocol !== 'https:' &&
      !(uri.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(uri.hostname)))
  )
    throw new Error(
      'Google OAuth server configuration is invalid. Check the private configuration.',
    )
  const keyPath = resolve(dirname(dbPath), 'drive-oauth.key')
  mkdirSync(dirname(keyPath), { recursive: true })
  try {
    writeFileSync(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  const encryptionKey = readFileSync(keyPath)
  if (encryptionKey.length !== 32)
    throw new Error('The private Google OAuth encryption key is invalid.')
  return { clientId, clientSecret, redirectUri, encryptionKey }
}

export function createGoogleOAuthGateway(config: DriveOAuthConfig): DriveOAuthGateway {
  const client = () =>
    new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      transporterOptions: { timeout, retry: false, maxRedirects: 0, maxContentLength: 128 * 1024 },
    })
  async function json(accessToken: string, path: string): Promise<Record<string, unknown>> {
    const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: 'error',
      signal: AbortSignal.timeout(timeout),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw storageUnavailable()
    }
    if (!response.body) throw storageUnavailable()
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.length
        if (size > 128 * 1024) {
          await reader.cancel()
          throw storageUnavailable()
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw storageUnavailable()
    return value as Record<string, unknown>
  }
  function folder(value: Record<string, unknown>): DriveFolder {
    const capabilities = value.capabilities as { canAddChildren?: boolean } | undefined
    if (
      typeof value.id !== 'string' ||
      !identifier.test(value.id) ||
      typeof value.name !== 'string' ||
      value.name.length > 1000 ||
      value.mimeType !== folderMime ||
      value.trashed === true ||
      value.driveId ||
      capabilities?.canAddChildren !== true
    )
      throw new HttpError(
        422,
        'drive_folder_invalid',
        'Choose a writable folder in the connected account’s My Drive.',
      )
    return { id: value.id, name: value.name }
  }
  return {
    authorizationUrl(state, challenge) {
      return client().generateAuthUrl({
        access_type: 'offline',
        scope: [scope],
        prompt: 'consent select_account',
        state,
        code_challenge: challenge,
        code_challenge_method: CodeChallengeMethod.S256,
      })
    },
    async exchange(code, verifier) {
      const { tokens } = await client().getToken({ code, codeVerifier: verifier })
      if (
        !tokens.refresh_token ||
        !tokens.access_token ||
        (tokens.scope && !tokens.scope.split(' ').includes(scope))
      )
        throw storageUnavailable()
      return { refreshToken: tokens.refresh_token, accessToken: tokens.access_token }
    },
    async access(refreshToken) {
      const auth = client()
      auth.setCredentials({ refresh_token: refreshToken })
      const value = await auth.getAccessToken()
      if (!value.token) throw storageUnavailable()
      return value.token
    },
    async identity(accessToken) {
      const value = (
        await json(accessToken, '/about?fields=user(permissionId,emailAddress,displayName)')
      ).user as Record<string, unknown> | undefined
      if (
        !value ||
        typeof value.permissionId !== 'string' ||
        typeof value.emailAddress !== 'string' ||
        typeof value.displayName !== 'string'
      )
        throw storageUnavailable()
      return { id: value.permissionId, email: value.emailAddress, name: value.displayName }
    },
    async folder(accessToken, key) {
      return folder(
        await json(
          accessToken,
          `/files/${encodeURIComponent(key)}?fields=id,name,mimeType,trashed,driveId,capabilities(canAddChildren)`,
        ),
      )
    },
    async folders(accessToken, parentId, pageToken) {
      const params = new URLSearchParams({
        q: `mimeType = '${folderMime}' and trashed = false and '${parentId}' in parents`,
        pageSize: '50',
        orderBy: 'name',
        fields:
          'nextPageToken,files(id,name,mimeType,trashed,driveId,capabilities(canAddChildren))',
        spaces: 'drive',
        corpora: 'user',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const result = await json(accessToken, `/files?${params}`)
      if (!Array.isArray(result.files)) throw storageUnavailable()
      const folders: DriveFolder[] = []
      for (const item of result.files) {
        try {
          folders.push(folder(item as Record<string, unknown>))
        } catch (error) {
          if (!(error instanceof HttpError) || error.code !== 'drive_folder_invalid') throw error
        }
      }
      return {
        folders,
        nextPageToken: typeof result.nextPageToken === 'string' ? result.nextPageToken : null,
      }
    },
  }
}

export function createDriveConnectionService(
  db: Database,
  config?: DriveOAuthConfig,
  options: {
    gateway?: DriveOAuthGateway
    storage?: (options: Parameters<typeof createDriveStorage>[0]) => RemoteFileStorage
    fallback?: SubmissionStorageConfiguration
  } = {},
) {
  const gateway = config ? (options.gateway ?? createGoogleOAuthGateway(config)) : undefined
  const storageFactory = options.storage ?? createDriveStorage
  const fallback = options.fallback ?? { mode: 'sqlite' as const }
  const connection = (): Connection =>
    get<Connection>(db, 'driveConnection', 'centre') ?? {
      id: 'centre',
      version: 0,
      connectionId: id(),
      account: null,
      folder: null,
      enabled: false,
    }
  const admin = (supplied: Account) => {
    const actor = authenticated(db, supplied)
    role(actor, ['admin'])
    return actor
  }
  function checkVersion(value: unknown, current: Connection) {
    if (!Number.isSafeInteger(value) || Number(value) < 0)
      throw new HttpError(400, 'invalid_payload', 'A current connection version is required.')
    if (value !== current.version)
      throw new HttpError(409, 'conflict', 'Drive settings changed. Refresh before trying again.')
  }
  const boundFiles = (connectionId: string) =>
    ['fileStorage', 'fileStoragePending'].some((kind) =>
      all<{ location?: RemoteFileLocation }>(db, kind).some(
        (record) => record.location?.connectionId === connectionId,
      ),
    )
  function seal(value: string): string {
    if (!config) throw storageUnavailable()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', config.encryptionKey, iv)
    const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64')
  }
  function unseal(value: string): string {
    if (!config) throw storageUnavailable()
    try {
      const b = Buffer.from(value, 'base64')
      const cipher = createDecipheriv('aes-256-gcm', config.encryptionKey, b.subarray(0, 12))
      cipher.setAuthTag(b.subarray(12, 28))
      return Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString('utf8')
    } catch {
      throw storageUnavailable()
    }
  }
  const changed = (expected: Connection) => {
    const current = connection()
    if (current.version !== expected.version || current.connectionId !== expected.connectionId)
      throw new HttpError(409, 'conflict', 'Drive settings changed during this request. Try again.')
    return current
  }
  async function access(expected: Connection) {
    if (!gateway || !expected.refresh) throw storageUnavailable()
    try {
      const token = await gateway.access(unseal(expected.refresh))
      changed(expected)
      return token
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) throw error
      const statusCode = (error as { response?: { status?: number } })?.response?.status
      if ([400, 401, 403].includes(statusCode ?? 0) && connection().version === expected.version)
        put<Connection>(db, 'driveConnection', { ...expected, authRequired: true })
      throw storageUnavailable()
    }
  }
  const status = (actor: Account): DriveConnectionStatus => {
    admin(actor)
    const current = connection()
    const authRequired = Boolean(
      current.authRequired || (current.enabled && (!config || !current.refresh)),
    )
    return {
      configured: Boolean(config),
      portalOrigin: config ? new URL(config.redirectUri).origin : undefined,
      connected: Boolean(config && current.refresh && !authRequired),
      uploadEnabled: current.enabled && Boolean(config && current.refresh && !authRequired),
      authRequired,
      version: current.version,
      account: current.account
        ? { email: current.account.email, name: current.account.name }
        : null,
      folder: current.folder,
      previousFilesUnavailable:
        (!config || !current.refresh || authRequired) && boundFiles(current.connectionId),
    }
  }
  function cookieName(state: string) {
    return `portal_drive_${state.slice(0, 12)}`
  }
  function cookie(state: string, value: string, clear = false) {
    return `${cookieName(state)}=${value}; HttpOnly; SameSite=Lax; Path=${callbackPath}; Max-Age=${clear ? 0 : 600}${config?.redirectUri.startsWith('https:') ? '; Secure' : ''}`
  }
  function sessionIsCurrent(pending: Pending): boolean {
    const value = db
      .prepare(
        'SELECT u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.user_id=?',
      )
      .get(pending.sessionHash, pending.userId)
    return Boolean(
      value &&
      value.role === 'admin' &&
      value.active === 1 &&
      Number(value.expires_at) > Date.now(),
    )
  }
  function audit(actorId: string, action: string) {
    put<AuditEntry>(db, 'audit', {
      id: id(),
      actorId,
      action,
      targetId: 'centre',
      createdAt: now(),
    })
  }
  return {
    status,
    assertOrigin(origin: string | undefined) {
      if (!config) throw new HttpError(503, 'drive_not_configured', 'Configure Google OAuth first.')
      if (origin !== new URL(config.redirectUri).origin)
        throw new HttpError(
          409,
          'drive_origin_mismatch',
          'Open the configured website origin before connecting Google.',
        )
    },
    start(actor: Account, token: string, expectedVersion: unknown) {
      const user = admin(actor)
      const current = connection()
      checkVersion(expectedVersion, current)
      if (!gateway || !config)
        throw new HttpError(
          503,
          'drive_not_configured',
          'Google OAuth must be configured on the server first.',
        )
      const state = randomBytes(32).toString('base64url'),
        nonce = randomBytes(32).toString('base64url'),
        verifier = randomBytes(32).toString('base64url')
      transaction(db, () => {
        for (const pending of all<Pending>(db, 'driveOAuthPending'))
          if (pending.expiresAt < Date.now() || pending.userId === user.id)
            remove(db, 'driveOAuthPending', pending.id)
        const pending: Pending = {
          id: tokenHash(state),
          cookieHash: tokenHash(nonce),
          verifier: seal(verifier),
          sessionHash: tokenHash(token),
          userId: user.id,
          expectedVersion: current.version,
          expiresAt: Date.now() + 600000,
        }
        if (!sessionIsCurrent(pending))
          throw new HttpError(401, 'session_invalid', 'Sign in again.')
        put(db, 'driveOAuthPending', pending)
      })
      const challenge = createHash('sha256').update(verifier).digest('base64url')
      return {
        authorizationUrl: gateway.authorizationUrl(state, challenge),
        cookie: cookie(state, nonce),
      }
    },
    async callback(params: URLSearchParams, cookies: string) {
      const state = params.get('state') ?? ''
      const result = {
        location: `${config ? new URL(config.redirectUri).origin : 'http://127.0.0.1:5173'}/learn?drive=error#settings`,
        cookie: statePattern.test(state) ? cookie(state, '', true) : undefined,
      }
      if (!gateway || !config || !statePattern.test(state)) return result
      const pending = get<Pending>(db, 'driveOAuthPending', tokenHash(state))
      const nonce = cookies
        .split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName(state)}=`))
        ?.slice(cookieName(state).length + 1)
      if (!pending || !nonce || tokenHash(nonce) !== pending.cookieHash) return result
      remove(db, 'driveOAuthPending', pending.id)
      if (
        pending.expiresAt < Date.now() ||
        !sessionIsCurrent(pending) ||
        connection().version !== pending.expectedVersion
      )
        return result
      if (params.get('error'))
        return { ...result, location: result.location.replace('drive=error', 'drive=cancelled') }
      const code = params.get('code')
      if (!code || code.length > 4096) return result
      try {
        const tokens = await gateway.exchange(code, unseal(pending.verifier))
        const identity = await gateway.identity(tokens.accessToken)
        transaction(db, () => {
          if (!sessionIsCurrent(pending)) throw storageUnavailable()
          const current = connection()
          checkVersion(pending.expectedVersion, current)
          if (
            current.account &&
            current.account.id !== identity.id &&
            boundFiles(current.connectionId)
          )
            throw new HttpError(
              409,
              'drive_account_in_use',
              'Reconnect the same Google account to preserve access to earlier uploads.',
            )
          const same = current.account?.id === identity.id
          put<Connection>(db, 'driveConnection', {
            id: 'centre',
            version: current.version + 1,
            connectionId: same ? current.connectionId : id(),
            account: identity,
            refresh: seal(tokens.refreshToken),
            folder: same ? current.folder : null,
            enabled: false,
          })
          audit(pending.userId, 'drive.connected')
        })
        return { ...result, location: result.location.replace('drive=error', 'drive=connected') }
      } catch {
        return result
      }
    },
    async folders(
      actor: Account,
      parentId: string,
      pageToken?: string,
      reauthorize: () => Account = () => actor,
    ) {
      admin(actor)
      if (
        (parentId !== 'root' && !identifier.test(parentId)) ||
        (pageToken !== undefined && (pageToken.length > 2000 || /[\r\n]/.test(pageToken)))
      )
        throw new HttpError(400, 'invalid_payload', 'Invalid folder navigation.')
      const current = connection()
      try {
        const token = await access(current)
        const result = await gateway!.folders(token, parentId, pageToken)
        admin(reauthorize())
        changed(current)
        return result
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw storageUnavailable()
      }
    },
    async selectFolder(
      actor: Account,
      folderId: unknown,
      expectedVersion: unknown,
      reauthorize: () => Account = () => actor,
    ) {
      const user = admin(actor)
      const current = connection()
      checkVersion(expectedVersion, current)
      if (typeof folderId !== 'string' || !identifier.test(folderId))
        throw new HttpError(400, 'invalid_payload', 'Choose a folder.')
      try {
        const folder = await gateway!.folder(await access(current), folderId)
        transaction(db, () => {
          admin(reauthorize())
          changed(current)
          put<Connection>(db, 'driveConnection', {
            ...current,
            folder,
            enabled: true,
            version: current.version + 1,
          })
          audit(user.id, 'drive.folder_selected')
        })
        return status(actor)
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw storageUnavailable()
      }
    },
    disconnect(actor: Account, expectedVersion: unknown) {
      const user = admin(actor)
      transaction(db, () => {
        const current = connection()
        checkVersion(expectedVersion, current)
        put<Connection>(db, 'driveConnection', {
          ...current,
          refresh: undefined,
          enabled: false,
          authRequired: false,
          version: current.version + 1,
        })
        for (const pending of all<Pending>(db, 'driveOAuthPending'))
          remove(db, 'driveOAuthPending', pending.id)
        audit(user.id, 'drive.disconnected')
      })
      return status(actor)
    },
    storageConfiguration(): SubmissionStorageConfiguration {
      const current = get<Connection>(db, 'driveConnection', 'centre')
      if (!current) return fallback
      const provider = (location?: RemoteFileLocation) => {
        if (location && !location.connectionId) {
          if (!fallback.drive) throw storageUnavailable()
          return fallback.drive
        }
        const selected = connection()
        if (
          !selected.refresh ||
          !config ||
          !selected.folder ||
          (location && location.connectionId !== selected.connectionId)
        )
          throw storageUnavailable()
        return storageFactory({
          folderId: location?.folderId ?? selected.folder.id,
          requireSharedDrive: false,
          getAccessToken: () => access(selected),
        })
      }
      const drive: RemoteFileStorage = {
        async allocate(record: FileRecord, bytes: Buffer) {
          const snapshot = connection()
          if (!snapshot.enabled) throw storageUnavailable()
          const remote = await provider().allocate(record, bytes)
          changed(snapshot)
          return { ...remote, connectionId: snapshot.connectionId }
        },
        async write(location, record, bytes) {
          const snapshot = connection()
          await provider(location).write(location, record, bytes)
          changed(snapshot)
        },
        async read(location, record) {
          const snapshot = connection()
          const bytes = await provider(location).read(location, record)
          changed(snapshot)
          return bytes
        },
        async remove(location) {
          await provider(location).remove(location)
        },
      }
      return { mode: current.enabled ? 'google-drive' : 'sqlite', drive }
    },
  }
}
export type DriveConnectionService = ReturnType<typeof createDriveConnectionService>
