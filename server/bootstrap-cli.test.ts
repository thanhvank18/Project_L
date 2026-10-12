import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { openDatabase } from './db.ts'

test('bootstrap CLI writes private access beside the mounted database and never resets an existing admin', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-bootstrap-cli-'))
  const dbPath = join(directory, 'mounted-data', 'portal.sqlite')
  const accessPath = join(directory, 'mounted-data', 'admin-access.txt')
  const run = () =>
    spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        fileURLToPath(new URL('./bootstrap.ts', import.meta.url)),
        '--email',
        'admin@example.test',
        '--name',
        'Administrator',
      ],
      { cwd: directory, env: { ...process.env, PORTAL_DB_PATH: dbPath }, encoding: 'utf8' },
    )
  try {
    const first = run()
    assert.equal(first.status, 0, first.stderr)
    assert.equal(existsSync(accessPath), true)
    assert.equal(existsSync(join(directory, '.local', 'portal', 'admin-access.txt')), false)
    assert.equal(first.stdout.includes('Password:'), false)
    if (process.platform !== 'win32') assert.equal(statSync(accessPath).mode & 0o777, 0o600)
    const checksum = () => createHash('sha256').update(readFileSync(accessPath)).digest('hex')
    const original = checksum()
    const second = run()
    assert.equal(second.status, 0, second.stderr)
    assert.equal(checksum(), original)
    const db = openDatabase(dbPath)
    try {
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()!.count,
        1,
      )
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM records').get()!.count, 0)
    } finally {
      db.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
