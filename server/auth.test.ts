import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  authenticate,
  changePassword,
  hashPassword,
  login,
  logout,
  runUserAction,
  tokenHash,
  verifyPassword,
} from './auth.ts'
import { bootstrapAdmin } from './bootstrap.ts'
import { getAccount, listAccounts, openDatabase, type Database } from './db.ts'
import { HttpError } from './errors.ts'
import { createServer } from './http.ts'
import { runAction } from './domain.ts'

const password = 'Test password 123!'
const encoded = await hashPassword(password)

function seed(db: Database, id: string, role: string, active = true): void {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES (?,?,?,?,?,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, active ? 1 : 0, new Date().toISOString(), encoded)
}

function status(code: number): (error: unknown) => boolean {
  return (error) => error instanceof HttpError && error.status === code
}

test('password hashes use random salts and reject an incorrect password', async () => {
  const second = await hashPassword(password)
  assert.notEqual(encoded, second)
  assert.equal(await verifyPassword(password, encoded), true)
  assert.equal(await verifyPassword('Wrong password', encoded), false)
  assert.equal(await verifyPassword(password, 'malformed'), false)
  assert.equal(await verifyPassword('x'.repeat(257), encoded), false)
})

test('sessions persist across restarts, store only a hash, expire and revoke on logout', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-auth-'))
  const path = join(directory, 'portal.sqlite')
  let db = openDatabase(path)
  try {
    seed(db, 'student', 'student')
    const token = await login(db, { email: 'STUDENT@example.test', password }, 'local', 1000)
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    const session = db.prepare('SELECT * FROM sessions').get()!
    assert.equal(session.token_hash, tokenHash(token))
    assert.notEqual(session.token_hash, token)
    assert.equal(authenticate(db, token, 1001).id, 'student')
    db.close()
    db = openDatabase(path)
    assert.equal(authenticate(db, token, 1002).id, 'student')
    assert.throws(() => authenticate(db, token, Number(session.expires_at)), status(401))
    logout(db, token)
    assert.throws(() => authenticate(db, token, 1003), status(401))
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('wrong credentials and disabled accounts never receive a session', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'student', 'student')
    seed(db, 'disabled', 'student', false)
    await assert.rejects(
      login(db, { email: 'student@example.test', password: 'incorrect' }, 'local'),
      status(401),
    )
    await assert.rejects(
      login(db, { email: 'missing@example.test', password }, 'local'),
      status(401),
    )
    await assert.rejects(
      login(db, { email: 'disabled@example.test', password }, 'local'),
      status(401),
    )
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n, 0)
  } finally {
    db.close()
  }
})

test('authentication checks current active status and role on every request', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'student', 'student')
    const token = await login(db, { email: 'student@example.test', password }, 'local')
    db.prepare("UPDATE users SET role='teacher' WHERE id='student'").run()
    assert.equal(authenticate(db, token).role, 'teacher')
    db.prepare("UPDATE users SET active=0 WHERE id='student'").run()
    assert.throws(() => authenticate(db, token), status(401))
  } finally {
    db.close()
  }
})

test('login throttling survives reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-throttle-'))
  const path = join(directory, 'portal.sqlite')
  let db = openDatabase(path)
  try {
    db.prepare('INSERT INTO auth_attempts(key,count,expires_at) VALUES (?,?,?)').run(
      `email:${tokenHash('student@example.test')}`,
      10,
      Date.now() + 60_000,
    )
    db.close()
    db = openDatabase(path)
    await assert.rejects(
      login(db, { email: 'student@example.test', password }, 'local'),
      status(429),
    )
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('successful logins do not accumulate shared-proxy failures or erase other accounts failures', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'student', 'student')
    const addressKey = `address:${tokenHash('shared-proxy')}`
    for (let index = 0; index < 61; index += 1) {
      const token = await login(db, { email: 'student@example.test', password }, 'shared-proxy')
      logout(db, token)
    }
    assert.equal(
      db.prepare('SELECT count FROM auth_attempts WHERE key = ?').get(addressKey),
      undefined,
    )
    await assert.rejects(
      login(db, { email: 'other@example.test', password: 'incorrect' }, 'shared-proxy'),
      status(401),
    )
    await login(db, { email: 'student@example.test', password }, 'shared-proxy')
    assert.equal(
      db.prepare('SELECT count FROM auth_attempts WHERE key = ?').get(addressKey)?.count,
      1,
    )
    db.prepare('UPDATE auth_attempts SET count = 60 WHERE key = ?').run(addressKey)
    await assert.rejects(
      login(db, { email: 'student@example.test', password }, 'shared-proxy'),
      status(429),
    )
  } finally {
    db.close()
  }
})

test('concurrent login verification is bounded and releases capacity after success and failure', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'student', 'student')
    const successes = Array.from({ length: 8 }, () =>
      login(db, { email: 'student@example.test', password }, 'shared-proxy'),
    )
    await assert.rejects(
      login(db, { email: 'student@example.test', password }, 'shared-proxy'),
      (error: unknown) => error instanceof HttpError && error.code === 'LOGIN_BUSY',
    )
    await Promise.all(successes)
    const failures = Array.from({ length: 8 }, (_, index) =>
      login(db, { email: `missing-${index}@example.test`, password }, 'shared-proxy'),
    )
    assert.equal(
      (await Promise.allSettled(failures)).every((result) => result.status === 'rejected'),
      true,
    )
    const token = await login(db, { email: 'student@example.test', password }, 'shared-proxy')
    assert.equal(authenticate(db, token).id, 'student')
    assert.equal(
      db
        .prepare('SELECT count FROM auth_attempts WHERE key = ?')
        .get(`address:${tokenHash('shared-proxy')}`)?.count,
      8,
    )
  } finally {
    db.close()
  }
})

test('account mutations enforce administrator access and current permissions', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'admin', 'admin')
    seed(db, 'student', 'student')
    const admin = getAccount(db, 'admin')!
    const student = getAccount(db, 'student')!
    const input = {
      type: 'user.create',
      payload: { name: 'Teacher', email: 'teacher@example.test', role: 'teacher', password },
    }
    await assert.rejects(runUserAction(db, student, input), status(403))
    const result = await runUserAction(db, admin, input)
    assert.equal(getAccount(db, String(result?.id))?.role, 'teacher')
    assert.equal(JSON.stringify(listAccounts(db)).includes('password'), false)
    db.prepare("UPDATE users SET role='student' WHERE id='admin'").run()
    await assert.rejects(runUserAction(db, admin, input), status(403))
  } finally {
    db.close()
  }
})

test('account edits reject stale versions and own admin lockout, revoke changed role sessions', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'admin', 'admin')
    seed(db, 'student', 'student')
    const admin = getAccount(db, 'admin')!
    const student = getAccount(db, 'student')!
    const token = await login(db, { email: student.email, password }, 'local')
    await assert.rejects(
      runUserAction(db, admin, { type: 'user.update', payload: { ...student, version: 0 } }),
      status(409),
    )
    await assert.rejects(
      runUserAction(db, admin, { type: 'user.update', payload: { ...admin, active: false } }),
      status(400),
    )
    await assert.rejects(
      runUserAction(db, admin, { type: 'user.update', payload: { ...admin, role: 'student' } }),
      status(400),
    )
    await runUserAction(db, admin, {
      type: 'user.update',
      payload: { ...student, role: 'teacher' },
    })
    assert.throws(() => authenticate(db, token), status(401))
    assert.equal(getAccount(db, student.id)?.version, 2)
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='audit'").get()!.n, 1)
  } finally {
    db.close()
  }
})

test('password changes preserve the current session and revoke other sessions', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'student', 'student')
    const one = await login(db, { email: 'student@example.test', password }, 'local')
    const two = await login(db, { email: 'student@example.test', password }, 'local')
    const student = authenticate(db, one)
    await assert.rejects(
      changePassword(db, student, one, {
        currentPassword: 'wrong',
        newPassword: 'New password 456!',
      }),
      status(400),
    )
    assert.equal(authenticate(db, one).id, student.id)
    await changePassword(db, student, one, {
      currentPassword: password,
      newPassword: 'New password 456!',
    })
    assert.equal(authenticate(db, one).id, student.id)
    assert.throws(() => authenticate(db, two), status(401))
    await assert.rejects(login(db, { email: student.email, password }, 'local'), status(401))
    assert.equal(
      authenticate(
        db,
        await login(db, { email: student.email, password: 'New password 456!' }, 'local'),
      ).id,
      student.id,
    )
  } finally {
    db.close()
  }
})

test('bootstrap writes one private access file and never overwrites an existing administrator', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-bootstrap-'))
  const accessPath = join(directory, 'admin-access.txt')
  const db = openDatabase(join(directory, 'portal.sqlite'))
  try {
    assert.equal(await bootstrapAdmin(db, 'admin@gmail.com', 'Administrator', accessPath), true)
    const contents = readFileSync(accessPath, 'utf8')
    const issued = contents.match(/Password: (.+)/)?.[1]
    assert.ok(issued && issued.length >= 16)
    const row = db.prepare('SELECT * FROM users').get()!
    assert.equal(row.email, 'admin@gmail.com')
    assert.equal(await verifyPassword(issued, String(row.password_hash)), true)
    assert.equal(await bootstrapAdmin(db, 'other@example.test', 'Other', accessPath), false)
    assert.equal(readFileSync(accessPath, 'utf8'), contents)
    assert.equal(listAccounts(db).length, 1)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records').get()!.n, 0)
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('HTTP login, profile and logout enforce authentication and bounded JSON requests', async () => {
  const db = openDatabase(':memory:')
  seed(db, 'student', 'student')
  const server = createServer(db)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}/api/v1`
  try {
    const health = await fetch(`${base}/health`)
    assert.equal(health.status, 200)
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(health.headers.get('access-control-allow-origin'), null)
    assert.equal((await fetch(`${base}/portal/state`)).status, 401)
    assert.equal(
      (await fetch(`${base}/health`, { headers: { Origin: 'https://untrusted.example' } })).status,
      403,
    )
    assert.equal((await fetch(`${base}/auth/login`, { method: 'POST', body: '{}' })).status, 415)
    assert.equal(
      (
        await fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'broken JSON',
        })
      ).status,
      400,
    )
    const loginResponse = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.test', password }),
    })
    assert.equal(loginResponse.status, 200)
    const { accessToken } = (await loginResponse.json()) as { accessToken: string }
    const headers = { Authorization: `Bearer ${accessToken}` }
    const profile = (await (await fetch(`${base}/users/me`, { headers })).json()) as Record<
      string,
      unknown
    >
    assert.equal(profile.id, 'student')
    assert.equal(profile.role, 'student')
    assert.equal(profile.isActive, true)
    assert.equal(profile.password_hash, undefined)
    const oversized = await fetch(`${base}/portal/actions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }),
    })
    assert.equal(oversized.status, 413)
    assert.equal((await fetch(`${base}/auth/logout`, { method: 'POST', headers })).status, 200)
    assert.equal((await fetch(`${base}/users/me`, { headers })).status, 401)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    db.close()
  }
})

test('session revocation during asynchronous password hashing prevents account mutations', async () => {
  const db = openDatabase(':memory:')
  try {
    seed(db, 'admin', 'admin')
    const token = await login(db, { email: 'admin@example.test', password }, 'local')
    const admin = authenticate(db, token)
    const mutation = runUserAction(
      db,
      admin,
      {
        type: 'user.create',
        payload: {
          name: 'Blocked user',
          email: 'blocked@example.test',
          role: 'student',
          active: true,
          password,
        },
      },
      () => {
        authenticate(db, token)
      },
    )
    logout(db, token)
    await assert.rejects(mutation, status(401))
    assert.equal(listAccounts(db).length, 1)
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='audit'").get()!.n, 0)
    const freshToken = await login(db, { email: admin.email, password }, 'local')
    const change = changePassword(db, admin, freshToken, {
      currentPassword: password,
      newPassword: 'Changed password 456!',
    })
    logout(db, freshToken)
    await assert.rejects(change, status(401))
    const row = db.prepare('SELECT password_hash FROM users WHERE id=?').get(admin.id)!
    assert.equal(await verifyPassword(password, String(row.password_hash)), true)
  } finally {
    db.close()
  }
})

test('HTTP rejects sessions revoked while command, upload and password bodies are streaming', async () => {
  const db = openDatabase(':memory:')
  seed(db, 'student', 'student')
  seed(db, 'admin', 'admin')
  const room = runAction(db, getAccount(db, 'admin')!, {
    type: 'class.save',
    payload: {
      expectedVersion: 0,
      title: 'Upload class',
      level: '',
      description: '',
      teacherIds: [],
      assistantIds: [],
      studentIds: ['student'],
      active: true,
    },
  }).state.classes[0]!
  const server = createServer(db)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const requests = [
    {
      route: 'portal/actions',
      body: {
        type: 'word.save',
        payload: {
          expectedVersion: 0,
          word: 'blocked',
          meaning: 'blocked',
          example: '',
          topic: '',
        },
      },
    },
    {
      route: 'portal/files',
      body: {
        classId: room.id,
        purpose: 'submission',
        name: 'work.pdf',
        mime: 'application/pdf',
        dataBase64: Buffer.from('%PDF-1.7\nData').toString('base64'),
      },
    },
    {
      route: 'auth/password',
      body: { currentPassword: password, newPassword: 'Changed password 456!' },
    },
  ]
  try {
    for (const attempt of requests) {
      const token = await login(db, { email: 'student@example.test', password }, 'local')
      const body = JSON.stringify(attempt.body)
      const receivedHeaders = new Promise<void>((resolve) => {
        server.once('request', () => resolve())
      })
      const client = request(`http://127.0.0.1:${address.port}/api/v1/${attempt.route}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      })
      const responseStatus = new Promise<number | undefined>((resolve, reject) => {
        client.once('error', reject)
        client.once('response', (response) => {
          response.resume()
          response.once('end', () => resolve(response.statusCode))
          response.once('error', reject)
        })
      })
      try {
        client.write(body.slice(0, 1))
        await Promise.race([
          receivedHeaders,
          responseStatus.then(() => {
            throw new Error('The request ended before its body was received.')
          }),
        ])
        logout(db, token)
        client.end(body.slice(1))
        assert.equal(await responseStatus, 401, attempt.route)
      } finally {
        client.destroy()
      }
    }
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind IN ('word','file')").get()!.n,
      0,
    )
    const row = db.prepare("SELECT password_hash FROM users WHERE id='student'").get()!
    assert.equal(await verifyPassword(password, String(row.password_hash)), true)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    db.close()
  }
})
