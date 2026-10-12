import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account, FileRecord, Role } from '../shared/portal.ts'
import { tokenHash } from './auth.ts'
import { getAccount, openDatabase } from './db.ts'
import { get, put } from './domain-store.ts'
import {
  createDriveConnectionService,
  type DriveOAuthConfig,
  type DriveOAuthGateway,
} from './drive-connection.ts'
import { fileDigest, type RemoteFileStorage } from './drive-storage.ts'
import { createServer } from './http.ts'
import { HttpError } from './errors.ts'
import { createFileService } from './file-service.ts'
import { createSpeakingService } from './speaking-service.ts'
import { speakingConfigurationFromEnvironment } from './speaking-config.ts'
import { emailConfigurationFromEnvironment } from './email-config.ts'

const errorStatus = (status: number) => (error: unknown) =>
  error instanceof HttpError && error.status === status
function setup() {
  const db = openDatabase(':memory:')
  const users = {} as Record<Role, Account>
  const tokens = {} as Record<Role, string>
  for (const role of ['admin', 'teacher', 'assistant', 'student'] as const) {
    db.prepare(
      'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
    ).run(role, role, `${role}@example.test`, role, new Date().toISOString(), 'unused-test')
    users[role] = getAccount(db, role)!
    tokens[role] = `qa-drive-${role}`.padEnd(43, 'a')
    db.prepare(
      'INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)',
    ).run(tokenHash(tokens[role]), role, Date.now(), Date.now() + 600000)
  }
  const config: DriveOAuthConfig = {
    clientId: 'qa.apps.googleusercontent.com',
    clientSecret: 'qa-private-client-secret',
    redirectUri: 'http://127.0.0.1:5173/api/v1/portal/drive/callback',
    encryptionKey: Buffer.alloc(32, 7),
  }
  const control = {
    identity: 'google-centre',
    exchanges: 0,
    failAccess: false,
    accessHook: () => {},
    identityHook: () => {},
    folderHook: () => {},
    foldersHook: () => {},
  }
  const gateway: DriveOAuthGateway = {
    authorizationUrl(state, challenge) {
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&code_challenge=${challenge}`
    },
    async exchange(_code, verifier) {
      control.exchanges++
      assert.ok(verifier.length >= 43)
      return { refreshToken: 'private-refresh-token', accessToken: 'private-access-token' }
    },
    async access(token) {
      assert.equal(token, 'private-refresh-token')
      if (control.failAccess) throw { response: { status: 401 } }
      control.accessHook()
      return 'private-access-token'
    },
    async identity() {
      control.identityHook()
      return { id: control.identity, email: 'centre@example.test', name: 'Centre' }
    },
    async folders() {
      control.foldersHook()
      return { folders: [{ id: 'folder-one', name: 'Submissions' }], nextPageToken: null }
    },
    async folder(_token, folderId) {
      control.folderHook()
      return { id: folderId, name: 'Submissions' }
    },
  }
  const remoteBytes = new Map<string, Buffer>()
  const storage: RemoteFileStorage = {
    async allocate(record, bytes) {
      return {
        provider: 'google-drive',
        fileId: record.id,
        folderId: 'folder-one',
        sharedDriveId: null,
        sha256: fileDigest(bytes),
      }
    },
    async write(location, _record, bytes) {
      remoteBytes.set(location.fileId, bytes)
    },
    async read(location) {
      return remoteBytes.get(location.fileId)!
    },
    async remove(location) {
      remoteBytes.delete(location.fileId)
    },
  }
  const service = createDriveConnectionService(db, config, { gateway, storage: () => storage })
  function start() {
    const value = service.start(users.admin, tokens.admin, service.status(users.admin).version)
    const url = new URL(value.authorizationUrl)
    return {
      params: new URLSearchParams({ state: url.searchParams.get('state')!, code: 'qa-auth-code' }),
      cookie: value.cookie.split(';')[0]!,
      value,
    }
  }
  async function connect() {
    const request = start()
    return service.callback(request.params, request.cookie)
  }
  return { db, users, tokens, config, control, gateway, service, start, connect }
}

test('Drive OAuth binds single-use state to cookie and current admin session; stores only encrypted tokens', async () => {
  const s = setup()
  try {
    const request = s.start()
    assert.equal(
      (await s.service.callback(request.params, '')).location.includes('drive=error'),
      true,
    )
    assert.equal(s.control.exchanges, 0)
    assert.equal(
      (await s.service.callback(request.params, request.cookie)).location.includes(
        'drive=connected',
      ),
      true,
    )
    assert.equal(
      (await s.service.callback(request.params, request.cookie)).location.includes('drive=error'),
      true,
    )
    assert.equal(s.control.exchanges, 1)
    const serialized = JSON.stringify(s.service.status(s.users.admin))
    assert.equal(serialized.includes('private-'), false)
    const records = s.db
      .prepare('SELECT body FROM records')
      .all()
      .map((v) => String(v.body))
      .join('')
    assert.equal(records.includes('private-refresh-token'), false)
    assert.equal(records.includes('private-access-token'), false)
    assert.equal(s.service.status(s.users.admin).uploadEnabled, false)
  } finally {
    s.db.close()
  }
})

test('Drive callbacks reject revoked admin sessions and permission changes during token exchange', async () => {
  for (const phase of ['before', 'during'] as const) {
    const s = setup()
    try {
      const request = s.start()
      const revoke = () => s.db.prepare("UPDATE users SET role='student' WHERE id='admin'").run()
      if (phase === 'before') revoke()
      else s.control.identityHook = revoke
      assert.match(
        (await s.service.callback(request.params, request.cookie)).location,
        /drive=error/,
      )
      assert.equal(get(s.db, 'driveConnection', 'centre'), undefined)
    } finally {
      s.db.close()
    }
  }
})

test('Drive callback expires, handles cancellation and rejects stale connection versions', async () => {
  const s = setup()
  try {
    let request = s.start()
    request.params.set('error', 'access_denied')
    assert.match(
      (await s.service.callback(request.params, request.cookie)).location,
      /drive=cancelled/,
    )
    request = s.start()
    s.service.disconnect(s.users.admin, 0)
    assert.match((await s.service.callback(request.params, request.cookie)).location, /drive=error/)
    request = s.start()
    const hash = tokenHash(request.params.get('state')!)
    const pending = get<{ id: string; expiresAt: number }>(s.db, 'driveOAuthPending', hash)!
    put(s.db, 'driveOAuthPending', { ...pending, expiresAt: 0 })
    assert.match((await s.service.callback(request.params, request.cookie)).location, /drive=error/)
  } finally {
    s.db.close()
  }
})

test('Only current admins can browse or change Drive; folder selection is versioned and reauthorized', async () => {
  const s = setup()
  try {
    for (const role of ['teacher', 'assistant', 'student'] as const) {
      assert.throws(() => s.service.status(s.users[role]), errorStatus(403))
      await assert.rejects(s.service.folders(s.users[role], 'root'), errorStatus(403))
    }
    await s.connect()
    assert.deepEqual((await s.service.folders(s.users.admin, 'root')).folders, [
      { id: 'folder-one', name: 'Submissions' },
    ])
    await assert.rejects(s.service.folders(s.users.admin, "invalid' query"), errorStatus(400))
    await assert.rejects(s.service.selectFolder(s.users.admin, 'root', 1), errorStatus(400))
    await assert.rejects(s.service.selectFolder(s.users.admin, 'folder-one', 0), errorStatus(409))
    const value = await s.service.selectFolder(s.users.admin, 'folder-one', 1)
    assert.equal(value.uploadEnabled, true)
    assert.equal(value.version, 2)
    s.control.folderHook = () => {
      s.db.prepare("UPDATE users SET active=0 WHERE id='admin'").run()
    }
    await assert.rejects(s.service.selectFolder(s.users.admin, 'folder-two', 2), errorStatus(401))
  } finally {
    s.db.close()
  }
})

test('Disconnect while refreshing a token returns a conflict without reading folders or restoring credentials', async () => {
  const s = setup()
  try {
    await s.connect()
    let folderReads = 0
    s.control.foldersHook = () => {
      folderReads++
    }
    s.control.accessHook = () => {
      s.service.disconnect(s.users.admin, 1)
    }
    await assert.rejects(s.service.folders(s.users.admin, 'root'), errorStatus(409))
    assert.equal(folderReads, 0)
    assert.equal(s.service.status(s.users.admin).connected, false)
    assert.equal(s.service.status(s.users.admin).version, 2)
  } finally {
    s.db.close()
  }
})

test('Explicit disconnect switches new uploads local, preserves remote records and requires same-account reconnect', async () => {
  const s = setup()
  try {
    await s.connect()
    await s.service.selectFolder(s.users.admin, 'folder-one', 1)
    const remote = s.service.storageConfiguration().drive!
    const bytes = Buffer.from('qa-file')
    const file = {
      id: 'file-one',
      name: 'qa.pdf',
      mime: 'application/pdf',
      size: bytes.length,
    } as FileRecord
    const location = await remote.allocate(file, bytes)
    await remote.write(location, file, bytes)
    put(s.db, 'fileStorage', { id: file.id, location })
    assert.deepEqual(await remote.read(location, file), bytes)
    const disconnected = s.service.disconnect(s.users.admin, 2)
    assert.equal(disconnected.previousFilesUnavailable, true)
    assert.equal(s.service.storageConfiguration().mode, 'sqlite')
    await assert.rejects(
      s.service.storageConfiguration().drive!.read(location, file),
      errorStatus(503),
    )
    s.control.identity = 'wrong-google-account'
    assert.match((await s.connect()).location, /drive=error/)
    s.control.identity = 'google-centre'
    assert.match((await s.connect()).location, /drive=connected/)
    assert.deepEqual(await s.service.storageConfiguration().drive!.read(location, file), bytes)
    assert.equal(s.service.status(s.users.admin).uploadEnabled, false)
  } finally {
    s.db.close()
  }
})

test('Missing OAuth config or revoked provider token fails closed without claiming local storage', async () => {
  const s = setup()
  try {
    await s.connect()
    await s.service.selectFolder(s.users.admin, 'folder-one', 1)
    const noConfig = createDriveConnectionService(s.db)
    assert.equal(noConfig.storageConfiguration().mode, 'google-drive')
    assert.equal(noConfig.status(s.users.admin).authRequired, true)
    s.control.failAccess = true
    await assert.rejects(s.service.folders(s.users.admin, 'root'), errorStatus(503))
    assert.equal(s.service.status(s.users.admin).authRequired, true)
    assert.equal(s.service.status(s.users.admin).connected, false)
  } finally {
    s.db.close()
  }
})

test('Drive HTTP endpoints enforce admin auth and origin; callback alone accepts cross-site return', async () => {
  const s = setup()
  const server = createServer(s.db, undefined, undefined, undefined, s.service)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}/api/v1/portal/drive`
  try {
    assert.equal((await fetch(`${base}/status`)).status, 401)
    for (const role of ['teacher', 'assistant', 'student'] as const)
      assert.equal(
        (await fetch(`${base}/status`, { headers: { Authorization: `Bearer ${s.tokens[role]}` } }))
          .status,
        403,
      )
    const headers = {
      Authorization: `Bearer ${s.tokens.admin}`,
      'Content-Type': 'application/json',
    }
    assert.equal(
      (
        await fetch(`${base}/connect`, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://foreign.example' },
          body: '{"expectedVersion":0}',
        })
      ).status,
      403,
    )
    for (const origin of [undefined, 'http://localhost:5173']) {
      const rejected = await fetch(`${base}/connect`, {
        method: 'POST',
        headers: { ...headers, ...(origin ? { Origin: origin } : {}) },
        body: '{"expectedVersion":0}',
      })
      assert.equal(rejected.status, 409)
      assert.equal(rejected.headers.get('set-cookie'), null)
      assert.equal(
        s.db.prepare("SELECT COUNT(*) AS count FROM records WHERE kind='driveOAuthPending'").get()
          ?.count,
        0,
      )
    }
    const response = await fetch(`${base}/connect`, {
      method: 'POST',
      headers: { ...headers, Origin: 'http://127.0.0.1:5173' },
      body: '{"expectedVersion":0}',
    })
    assert.equal(response.status, 200)
    const cookie = response.headers.get('set-cookie')!
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    const body = (await response.json()) as { authorizationUrl: string }
    const state = new URL(body.authorizationUrl).searchParams.get('state')!
    const callback = await fetch(`${base}/callback?state=${state}&code=qa-code`, {
      headers: { Cookie: cookie.split(';')[0]!, 'Sec-Fetch-Site': 'cross-site' },
      redirect: 'manual',
    })
    assert.equal(callback.status, 303)
    assert.match(callback.headers.get('location')!, /drive=connected/)
    assert.equal(callback.headers.get('cache-control'), 'no-store')
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    s.db.close()
  }
})

for (const operation of ['list', 'select'] as const) {
  test(`Drive HTTP ${operation} rejects an admin session revoked during the Google request`, async () => {
    const s = setup()
    await s.connect()
    const server = createServer(s.db, undefined, undefined, undefined, s.service)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const base = `http://127.0.0.1:${address.port}/api/v1/portal/drive`
    const revoke = () => {
      s.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(s.tokens.admin))
    }
    if (operation === 'list') s.control.foldersHook = revoke
    else s.control.folderHook = revoke
    try {
      const headers = {
        Authorization: `Bearer ${s.tokens.admin}`,
        'Content-Type': 'application/json',
      }
      const response =
        operation === 'list'
          ? await fetch(`${base}/folders?parentId=root`, { headers })
          : await fetch(`${base}/folder`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ folderId: 'folder-one', expectedVersion: 1 }),
            })
      assert.equal(response.status, 401)
      const body = await response.text()
      assert.equal(body.includes('Submissions'), false)
      assert.equal(body.includes('private-'), false)
      // The account remains an active admin: the revoked session is the boundary.
      assert.equal(getAccount(s.db, s.users.admin.id)?.active, true)
      assert.equal(getAccount(s.db, s.users.admin.id)?.role, 'admin')
      const status = s.service.status(s.users.admin)
      assert.equal(status.version, 1)
      assert.equal(status.uploadEnabled, false)
      assert.equal(status.folder, null)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      s.db.close()
    }
  })
}

test('Integration status is authenticated and exposes configuration flags without provider secrets', async () => {
  const s = setup()
  const files = createFileService(s.db)
  const speaking = createSpeakingService(
    s.db,
    files,
    speakingConfigurationFromEnvironment({
      PORTAL_AI_ENABLED: 'false',
      PORTAL_AI_API_KEY: 'private-speaking-key-for-test',
    }),
  )
  const email = emailConfigurationFromEnvironment({
    PORTAL_EMAIL_ENABLED: 'false',
    PORTAL_EMAIL_PROVIDER: 'resend',
    PORTAL_EMAIL_API_KEY: 'private-email-key-for-test',
    PORTAL_EMAIL_FROM: 'sender@example.test',
  })
  const server = createServer(s.db, files, email, speaking, s.service)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}/api/v1/portal/integration-status`
  try {
    assert.equal((await fetch(url)).status, 401)
    for (const role of ['admin', 'teacher', 'assistant', 'student'] as const) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${s.tokens[role]}` },
      })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const text = await response.text()
      for (const secret of [
        'private-speaking-key-for-test',
        'private-email-key-for-test',
        s.config.clientSecret,
        'private-refresh-token',
        'private-access-token',
      ])
        assert.equal(text.includes(secret), false)
      const body = JSON.parse(text) as {
        speaking: { keyConfigured: boolean; enabled: boolean; reason: string }
        emailEnabled: boolean
        vocabularyAI: boolean
      }
      assert.deepEqual(Object.keys(body).sort(), ['emailEnabled', 'speaking', 'vocabularyAI'])
      assert.equal(body.speaking.keyConfigured, true)
      assert.equal(body.speaking.enabled, false)
      assert.equal(body.speaking.reason, 'disabled')
      assert.equal(body.emailEnabled, false)
      assert.equal(body.vocabularyAI, false)
      assert.equal('apiKey' in body.speaking, false)
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await speaking.stop()
    s.db.close()
  }
})
