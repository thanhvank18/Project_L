import assert from 'node:assert/strict'
import test from 'node:test'
import { openDatabase } from './db.ts'
import { tokenHash } from './auth.ts'
import { createServer } from './http.ts'
import { emailConfigurationFromEnvironment } from './email-config.ts'
const sessionToken = (role: string) => `test-email-${role}`.padEnd(43, 'a')

test('email status is admin-only, secret-free and immediately respects current account role', async () => {
  const db = openDatabase(':memory:')
  const config = emailConfigurationFromEnvironment({
    PORTAL_EMAIL_API_KEY: 'private-test-key',
    PORTAL_EMAIL_FROM: 'sender@example.test',
    PORTAL_EMAIL_PROVIDER: 'resend',
    PORTAL_EMAIL_PORTAL_ORIGIN: 'https://portal.example.test',
  })
  for (const role of ['admin', 'teacher', 'assistant', 'student']) {
    db.prepare(
      'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES (?,?,?,?,1,1,?,?)',
    ).run(
      role,
      role,
      `${role}@example.test`,
      role,
      new Date().toISOString(),
      'unused-test-password-hash',
    )
    db.prepare(
      'INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)',
    ).run(tokenHash(sessionToken(role)), role, Date.now(), Date.now() + 60000)
  }
  const server = createServer(db, undefined, config)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}/api/v1/portal/email-status`
  try {
    assert.equal((await fetch(url)).status, 401)
    for (const role of ['teacher', 'assistant', 'student'])
      assert.equal(
        (await fetch(url, { headers: { Authorization: `Bearer ${sessionToken(role)}` } })).status,
        403,
      )
    const result = await fetch(url, {
      headers: { Authorization: `Bearer ${sessionToken('admin')}` },
    })
    assert.equal(result.status, 200)
    const body = await result.text()
    assert.equal(JSON.parse(body).delivery, 'disabled')
    assert.equal(body.includes('private-test-key'), false)
    assert.equal(body.includes('sender@example.test'), false)
    db.prepare("UPDATE users SET role='student' WHERE id='admin'").run()
    assert.equal(
      (await fetch(url, { headers: { Authorization: `Bearer ${sessionToken('admin')}` } })).status,
      403,
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    db.close()
  }
})
