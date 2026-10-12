import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Classroom, Role } from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, getPublicCourses, runAction, uploadFile } from './domain.ts'
import { get, put, transaction } from './domain-store.ts'
import { fileDigest, type RemoteFileStorage } from './drive-storage.ts'
import { createFileService } from './file-service.ts'
import { HttpError } from './errors.ts'
import { hashPassword, login, logout } from './auth.ts'
import { createServer } from './http.ts'

const pdf = Buffer.from('%PDF-1.7\nStudent original answer')
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
function account(db: Database, id: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, id)!
}
function setup(path = ':memory:') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  const other = account(db, 'other', 'student')
  const room = runAction(db, admin, {
    type: 'class.save',
    payload: {
      title: 'Private class',
      level: 'B1',
      description: '',
      active: true,
      teacherIds: [teacher.id],
      assistantIds: [assistant.id],
      studentIds: [student.id, other.id],
      expectedVersion: 0,
    },
  }).state.classes[0]!
  const metadata = {
    name: 'answer.pdf',
    mime: 'application/pdf',
    classId: room.id,
    purpose: 'submission' as const,
  }
  return { db, admin, teacher, assistant, student, other, room, metadata }
}
function fakeDrive(db: Database) {
  const calls = { allocate: 0, write: 0, read: 0, remove: 0 }
  const remote = new Map<string, Buffer>()
  const hooks = { allocate: () => {}, write: () => {}, read: () => {}, remove: () => {} }
  const drive: RemoteFileStorage = {
    async allocate(record, bytes) {
      calls.allocate++
      transaction(db, () => {})
      hooks.allocate()
      return {
        provider: 'google-drive',
        fileId: `drive-${record.id}`,
        folderId: 'centre-private-folder',
        sharedDriveId: 'centre-shared-drive',
        sha256: fileDigest(bytes),
      }
    },
    async write(location, _record, bytes) {
      calls.write++
      transaction(db, () => {})
      remote.set(location.fileId, bytes)
      hooks.write()
    },
    async read(location) {
      calls.read++
      transaction(db, () => {})
      hooks.read()
      return remote.get(location.fileId)!
    },
    async remove(location) {
      calls.remove++
      hooks.remove()
      remote.delete(location.fileId)
    },
  }
  return { drive, calls, hooks, remote }
}

test('Drive opt-in preserves local files/materials, uses private locations, and never falls back for missing providers', async () => {
  const { db, admin, teacher, student, metadata } = setup()
  try {
    const local = uploadFile(db, student, metadata, pdf)
    const fake = fakeDrive(db)
    const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
    const cloud = await service.upload(student, metadata, pdf)
    assert.deepEqual((await service.download(student, local.id)).bytes, pdf)
    assert.deepEqual((await service.download(student, cloud.id)).bytes, pdf)
    assert.equal(db.prepare('SELECT bytes FROM file_blobs WHERE id=?').get(cloud.id), undefined)
    assert.equal(get(db, 'fileStoragePending', cloud.id), undefined)
    await service.upload(teacher, { ...metadata, purpose: 'material' }, pdf)
    assert.equal(fake.calls.write, 1)
    for (const actor of [student, teacher, admin]) {
      const serialized = JSON.stringify(getPortalState(db, actor))
      assert.ok(!serialized.includes('centre-private-folder'))
      assert.ok(!serialized.includes(`drive-${cloud.id}`))
      assert.ok(!serialized.includes(fileDigest(pdf)))
    }
    assert.ok(!JSON.stringify(getPublicCourses(db)).includes('centre-private-folder'))
    await assert.rejects(
      createFileService(db, { mode: 'google-drive' }).upload(student, metadata, pdf),
      status(503),
    )
    await assert.rejects(createFileService(db).download(student, cloud.id), status(503))
    assert.deepEqual((await createFileService(db).download(student, local.id)).bytes, pdf)
    const localAgain = createFileService(db, { mode: 'sqlite', drive: fake.drive })
    assert.deepEqual((await localAgain.download(student, cloud.id)).bytes, pdf)
    await localAgain.upload(student, metadata, pdf)
    assert.equal(fake.calls.write, 1)
  } finally {
    db.close()
  }
})

test('invalid uploads and current role/membership failures are rejected before cloud access', async () => {
  const { db, teacher, assistant, student, room, metadata } = setup()
  try {
    const fake = fakeDrive(db)
    const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
    for (const actor of [teacher, assistant])
      await assert.rejects(service.upload(actor, metadata, pdf), status(403))
    await assert.rejects(
      service.upload(student, { ...metadata, name: '../file.pdf' }, pdf),
      status(400),
    )
    await assert.rejects(
      service.upload(student, metadata, Buffer.from('invalid file bytes')),
      status(400),
    )
    put(db, 'class', { ...room, studentIds: [] })
    await assert.rejects(service.upload(student, metadata, pdf), status(404))
    assert.equal(fake.calls.allocate, 0)
    assert.equal(fake.calls.write, 0)
  } finally {
    db.close()
  }
})

test('access revoked during allocation or upload prevents commit and cleans the known provider file', async () => {
  for (const phase of ['allocate', 'write'] as const) {
    const { db, student, room, metadata } = setup()
    try {
      const fake = fakeDrive(db)
      fake.hooks[phase] = () => {
        put(db, 'class', { ...room, studentIds: [] })
      }
      const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
      await assert.rejects(service.upload(student, metadata, pdf), status(404))
      assert.equal(fake.calls.write, phase === 'allocate' ? 0 : 1)
      assert.equal(fake.calls.remove, phase === 'allocate' ? 0 : 1)
      assert.equal(fake.remote.size, 0)
      assert.equal(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM records WHERE kind IN ('file','fileStorage','fileStoragePending')",
          )
          .get()!.n,
        0,
      )
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM file_blobs').get()!.n, 0)
    } finally {
      db.close()
    }
  }
})

test('ambiguous upload errors never commit; failed cleanup keeps a private recovery journal', async () => {
  const { db, student, metadata } = setup()
  try {
    const fake = fakeDrive(db)
    fake.hooks.write = () => {
      throw new Error('provider secret, response lost after upload')
    }
    fake.hooks.remove = () => {
      throw new Error('private provider failure')
    }
    const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
    await assert.rejects(
      service.upload(student, metadata, pdf),
      (error: unknown) =>
        error instanceof HttpError && error.status === 503 && !error.message.includes('secret'),
    )
    assert.equal(fake.calls.remove, 1)
    assert.equal(fake.remote.size, 1)
    const row = db.prepare("SELECT body FROM records WHERE kind='fileStoragePending'").get()!
    assert.equal((JSON.parse(String(row.body)) as { status: string }).status, 'cleanup-required')
    assert.equal(getPortalState(db, student).files.length, 0)
    assert.ok(!JSON.stringify(getPortalState(db, student)).includes('cleanup-required'))
  } finally {
    db.close()
  }
})

test('downloads recheck membership, active status and session guard after remote reads and verify immutable bytes', async () => {
  const { db, student, other, teacher, assistant, admin, room, metadata } = setup()
  try {
    const fake = fakeDrive(db)
    const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
    const file = await service.upload(student, metadata, pdf)
    for (const actor of [other, teacher, assistant, admin])
      await assert.rejects(service.download(actor, file.id), status(404))
    assert.equal(fake.calls.read, 0)
    fake.hooks.read = () => {
      put(db, 'class', { ...room, studentIds: [] })
    }
    await assert.rejects(service.download(student, file.id), status(404))
    put(db, 'class', room)
    fake.hooks.read = () => {
      db.prepare('UPDATE users SET active=0 WHERE id=?').run(student.id)
    }
    await assert.rejects(service.download(student, file.id), status(401))
    db.prepare('UPDATE users SET active=1 WHERE id=?').run(student.id)
    let sessionValid = true
    fake.hooks.read = () => {
      sessionValid = false
    }
    await assert.rejects(
      service.download(student, file.id, () => {
        if (!sessionValid) throw new HttpError(401, 'session_invalid', 'Sign in again.')
        return student
      }),
      status(401),
    )
    fake.hooks.read = () => {}
    fake.remote.set(`drive-${file.id}`, Buffer.from('%PDF-1.7\nExternal changed answer'))
    await assert.rejects(service.download(student, file.id), status(502))
  } finally {
    db.close()
  }
})

test('ambiguous writes retain recovery IDs after apparent cleanup; unconfirmed deletion after a confirmed write also retains them', async () => {
  for (const mode of ['unconfirmed-write', 'unconfirmed-delete'] as const) {
    const { db, student, room, metadata } = setup()
    try {
      const fake = fakeDrive(db)
      fake.hooks.write = () => {
        if (mode === 'unconfirmed-write') throw new Error('Response lost')
        put(db, 'class', { ...room, studentIds: [] })
      }
      if (mode === 'unconfirmed-delete')
        fake.hooks.remove = () => {
          throw new HttpError(503, 'storage_unavailable', 'Deletion unconfirmed.')
        }
      const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
      await assert.rejects(
        service.upload(student, metadata, pdf),
        status(mode === 'unconfirmed-write' ? 503 : 404),
      )
      const row = db.prepare("SELECT body FROM records WHERE kind='fileStoragePending'").get()!
      assert.equal((JSON.parse(String(row.body)) as { status: string }).status, 'cleanup-required')
      assert.equal(fake.calls.remove, 1)
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='file'").get()!.n, 0)
    } finally {
      db.close()
    }
  }
})

test('ownership cannot bypass a changed current role for local or Drive files', async () => {
  const { db, student, teacher, room, metadata } = setup()
  try {
    const fake = fakeDrive(db)
    const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
    const local = uploadFile(db, student, metadata, pdf)
    const remote = await service.upload(student, metadata, pdf)
    const material = uploadFile(db, teacher, { ...metadata, purpose: 'material' }, pdf)
    db.prepare('UPDATE users SET role=? WHERE id=?').run('assistant', student.id)
    db.prepare('UPDATE users SET role=? WHERE id=?').run('student', teacher.id)
    put(db, 'class', {
      ...room,
      teacherIds: [],
      assistantIds: [student.id],
      studentIds: [teacher.id],
    })
    for (const file of [local, remote])
      await assert.rejects(service.download(student, file.id), status(404))
    await assert.rejects(service.download(teacher, material.id), status(404))
    assert.equal(fake.calls.read, 0)
    assert.equal(getPortalState(db, student).files.length, 0)
    assert.equal(getPortalState(db, teacher).files.length, 0)
  } finally {
    db.close()
  }
})

test('HTTP rechecks real sessions after Drive upload and download awaits', async () => {
  const { db, student, metadata } = setup()
  const password = 'Isolated drive test password 123!'
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(
    await hashPassword(password),
    student.id,
  )
  const fake = fakeDrive(db)
  const service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
  const server = createServer(db, service)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}/api/v1/portal/files`
  try {
    const token = await login(db, { email: student.email, password }, 'local')
    fake.hooks.write = () => {
      logout(db, token)
    }
    const response = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...metadata, dataBase64: pdf.toString('base64') }),
    })
    assert.equal(response.status, 401)
    assert.equal(fake.remote.size, 0)
    assert.equal(getPortalState(db, student).files.length, 0)
    fake.hooks.write = () => {}
    const file = await service.upload(student, metadata, pdf)
    const nextToken = await login(db, { email: student.email, password }, 'local')
    fake.hooks.read = () => {
      logout(db, nextToken)
    }
    const download = await fetch(`${base}/${file.id}`, {
      headers: { Authorization: `Bearer ${nextToken}` },
    })
    assert.equal(download.status, 401)
    assert.equal(download.headers.get('content-disposition'), null)
    const body = await download.text()
    assert.ok(
      !body.includes('%PDF') &&
        !body.includes('centre-private-folder') &&
        !body.includes(`drive-${file.id}`),
    )
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    db.close()
  }
})

test('submitted Drive attachments preserve role boundaries and earlier revisions across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-drive-files-'))
  const path = join(directory, 'portal.sqlite')
  const fixture = setup(path)
  let db = fixture.db
  const { admin, teacher, assistant, student, other, room, metadata } = fixture
  const fake = fakeDrive(db)
  try {
    let service = createFileService(db, { mode: 'google-drive', drive: fake.drive })
    const first = await service.upload(student, metadata, pdf)
    const assignment = runAction(db, teacher, {
      type: 'assignment.save',
      payload: {
        classId: room.id,
        expectedVersion: 0,
        title: { vi: 'Bài viết', en: 'Writing' },
        instructions: { vi: 'Viết', en: 'Write' },
        skill: 'writing',
        dueAt: '',
        published: true,
        required: true,
        attachmentIds: [],
      },
    }).state.assignments[0]!
    const submit = (attachmentId: string, draftVersion: number, revision: number) => {
      runAction(db, student, {
        type: 'draft.save',
        payload: {
          assignmentId: assignment.id,
          assignmentVersion: assignment.version,
          expectedVersion: draftVersion - 1,
          answer: '',
          notes: '',
          attachmentIds: [attachmentId],
        },
      })
      return runAction(db, student, {
        type: 'submission.create',
        payload: {
          assignmentId: assignment.id,
          assignmentVersion: assignment.version,
          draftVersion,
          expectedRevision: revision - 1,
          requestId: `submission-${revision}`,
        },
      })
    }
    submit(first.id, 1, 1)
    for (const actor of [student, teacher, admin])
      assert.deepEqual((await service.download(actor, first.id)).bytes, pdf)
    for (const actor of [assistant, other])
      await assert.rejects(service.download(actor, first.id), status(404))
    const newer = Buffer.from('%PDF-1.7\nNewer answer revision')
    const second = await service.upload(student, metadata, newer)
    submit(second.id, 2, 2)
    assert.notEqual(first.id, second.id)
    assert.deepEqual(
      getPortalState(db, teacher).submissions.map((item) => item.attachmentIds),
      [[first.id], [second.id]],
    )
    db.close()
    db = openDatabase(path)
    const reader: RemoteFileStorage = {
      ...fake.drive,
      async read(location) {
        return fake.remote.get(location.fileId)!
      },
    }
    service = createFileService(db, { mode: 'google-drive', drive: reader })
    assert.deepEqual((await service.download(teacher, first.id)).bytes, pdf)
    assert.deepEqual((await service.download(teacher, second.id)).bytes, newer)
    const currentRoom = get<Classroom>(db, 'class', room.id)!
    put(db, 'class', { ...currentRoom, studentIds: [] })
    await assert.rejects(service.download(student, first.id), status(404))
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
