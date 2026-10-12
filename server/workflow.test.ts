import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { ActionResult, FileRecord, LiveState, Role, Skill } from '../shared/portal.ts'
import { hashPassword } from './auth.ts'
import { openDatabase } from './db.ts'
import { createServer } from './http.ts'

test('HTTP four-role learning workflow persists enrollment, all four skills, feedback, files, operations and meeting access', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-workflow-'))
  const databasePath = join(directory, 'workflow.sqlite')
  let db = openDatabase(databasePath)
  const password = 'Integration test password 123!'
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(
    'admin',
    'Test Admin',
    'admin@workflow.test',
    'admin',
    new Date().toISOString(),
    await hashPassword(password),
  )
  let server = createServer(db)
  let base = ''
  const start = async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    base = `http://127.0.0.1:${address.port}/api/v1`
  }
  const stop = async () => {
    if (server.listening)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
  }
  const api = async <T>(
    path: string,
    token = '',
    payload?: unknown,
    expected = 200,
  ): Promise<T> => {
    const response = await fetch(`${base}${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    })
    assert.equal(response.status, expected, `${path} status`)
    return (await response.json()) as T
  }
  const action = (token: string, type: string, payload: Record<string, unknown>) =>
    api<ActionResult>('/portal/actions', token, { type, payload })
  const state = (token: string) => api<LiveState>('/portal/state', token)
  const login = async (email: string) =>
    (await api<{ accessToken: string }>('/auth/login', '', { email, password })).accessToken
  const rejected = (
    token: string,
    type: string,
    payload: Record<string, unknown>,
    expected = 403,
  ) => api<{ error: string }>('/portal/actions', token, { type, payload }, expected)
  try {
    await start()
    const admin = await login('admin@workflow.test')
    const users: Record<string, { id: string; token: string }> = {}
    for (const [key, role] of [
      ['teacher', 'teacher'],
      ['assistant', 'assistant'],
      ['student', 'student'],
      ['outsider', 'student'],
    ] as const satisfies ReadonlyArray<readonly [string, Role]>) {
      const saved = await action(admin, 'user.create', {
        name: key,
        email: `${key}@workflow.test`,
        role,
        password,
        active: true,
      })
      users[key] = { id: String(saved.result!.id), token: await login(`${key}@workflow.test`) }
      assert.equal((await state(users[key]!.token)).user.role, role)
    }
    const teacher = users.teacher!
    const assistant = users.assistant!
    const student = users.student!
    const outsider = users.outsider!
    const room = (
      await action(admin, 'class.save', {
        expectedVersion: 0,
        title: 'Integration class',
        level: 'B1',
        description: 'Public summary',
        teacherIds: [teacher.id],
        assistantIds: [assistant.id],
        studentIds: [],
        active: true,
        listed: true,
        enrollmentOpen: true,
      })
    ).state.classes[0]!
    assert.equal((await state(student.token)).openClasses[0]!.id, room.id)
    const pending = (await action(student.token, 'enrollment.request', { classId: room.id })).state
      .enrollmentRequests[0]!
    assert.equal((await state(student.token)).classes.length, 0)
    await rejected(student.token, 'enrollment.review', {
      id: pending.id,
      expectedVersion: 1,
      decision: 'approved',
    })
    await action(admin, 'enrollment.review', {
      id: pending.id,
      expectedVersion: 1,
      decision: 'approved',
    })
    assert.equal((await state(student.token)).classes[0]!.id, room.id)
    assert.equal((await state(outsider.token)).classes.length, 0)

    const audio = Buffer.alloc(48)
    audio.write('RIFF', 0)
    audio.writeUInt32LE(40, 4)
    audio.write('WAVEfmt ', 8)
    audio.writeUInt32LE(16, 16)
    audio.writeUInt16LE(1, 20)
    audio.writeUInt16LE(1, 22)
    audio.writeUInt32LE(8000, 24)
    audio.writeUInt32LE(16000, 28)
    audio.writeUInt16LE(2, 32)
    audio.writeUInt16LE(16, 34)
    audio.write('data', 36)
    audio.writeUInt32LE(4, 40)
    const materialAudio = await api<FileRecord>(
      '/portal/files',
      teacher.token,
      {
        classId: room.id,
        purpose: 'material',
        name: 'listening.wav',
        mime: 'audio/wav',
        dataBase64: audio.toString('base64'),
      },
      201,
    )
    await action(teacher.token, 'material.save', {
      classId: room.id,
      title: 'Listening material',
      content: 'Listen and respond.',
      attachmentIds: [materialAudio.id],
      published: true,
      expectedVersion: 0,
    })
    await action(teacher.token, 'unit.save', {
      classId: room.id,
      title: { vi: 'Bốn kỹ năng', en: 'Four skills' },
      completed: false,
      expectedVersion: 0,
    })
    await action(teacher.token, 'attendance.save', {
      classId: room.id,
      studentId: student.id,
      date: '2026-10-10',
      status: 'present',
      expectedVersion: 0,
    })
    await rejected(assistant.token, 'attendance.save', {
      classId: room.id,
      studentId: student.id,
      date: '2026-10-11',
      status: 'present',
      expectedVersion: 0,
    })
    await action(assistant.token, 'class.meeting.save', {
      classId: room.id,
      expectedVersion: 0,
      meetingUrl: 'https://zoom.us/j/123456789?pwd=workflow-private',
    })
    const consultation = (
      await action(teacher.token, 'lesson.save', {
        classId: room.id,
        title: 'One-to-one review',
        kind: 'consultation',
        hostId: teacher.id,
        capacity: 1,
        cancelled: false,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 90000000).toISOString(),
        meetingSource: 'class',
        expectedVersion: 0,
      })
    ).state.lessons[0]!
    const skills: Skill[] = ['reading', 'writing', 'listening', 'speaking']
    const assignments = []
    for (const skill of skills) {
      const saved = await action(teacher.token, 'assignment.save', {
        classId: room.id,
        skill,
        title: { vi: `Bài ${skill}`, en: `${skill} task` },
        instructions: { vi: 'Hoàn thành bài tập.', en: 'Complete this task.' },
        dueAt: '',
        published: true,
        required: true,
        attachmentIds: skill === 'listening' ? [materialAudio.id] : [],
        expectedVersion: 0,
      })
      assignments.push(saved.state.assignments.find((item) => item.id === saved.result!.id)!)
    }
    const reservation = (
      await action(student.token, 'booking.create', {
        lessonId: consultation.id,
        expectedVersion: consultation.version,
      })
    ).state.bookings[0]!
    assert.equal(
      (await rejected(student.token, 'lesson.join', { id: consultation.id })).error,
      'preparation_required',
    )
    await rejected(outsider.token, 'lesson.join', { id: consultation.id }, 404)
    const speech = await api<FileRecord>(
      '/portal/files',
      student.token,
      {
        classId: room.id,
        purpose: 'submission',
        name: 'speaking.wav',
        mime: 'audio/wav',
        dataBase64: audio.toString('base64'),
      },
      201,
    )
    for (const assignment of assignments) {
      const speaking = assignment.skill === 'speaking'
      const savedDraft = (
        await action(student.token, 'draft.save', {
          assignmentId: assignment.id,
          assignmentVersion: assignment.version,
          expectedVersion: 0,
          answer: speaking ? '' : `Private ${assignment.skill} response`,
          notes: 'Private reflection, never submitted',
          attachmentIds: speaking ? [speech.id] : [],
        })
      ).state.drafts.find((item) => item.assignmentId === assignment.id)!
      const saved = await action(student.token, 'submission.create', {
        assignmentId: assignment.id,
        assignmentVersion: assignment.version,
        draftVersion: savedDraft.version,
        expectedRevision: 0,
        requestId: `workflow-${assignment.skill}`,
      })
      const submission = saved.state.submissions.find((item) => item.id === saved.result!.id)!
      assert.equal(submission.skill, assignment.skill)
      assert.ok(!JSON.stringify(submission).includes('Private reflection'))
      if (assignment.skill === 'reading') {
        await rejected(admin, 'submission.review', {
          id: submission.id,
          expectedVersion: 1,
          score: 8,
          feedback: 'Unauthorized',
        })
        await rejected(assistant.token, 'submission.review', {
          id: submission.id,
          expectedVersion: 1,
          score: 8,
          feedback: 'Unauthorized',
        })
      }
      await action(teacher.token, 'submission.review', {
        id: submission.id,
        expectedVersion: 1,
        score: 7.5,
        feedback: `Private feedback for ${assignment.skill}`,
      })
    }
    const assistantState = await state(assistant.token)
    assert.equal(assistantState.submissions.length, 4)
    assert.ok(
      assistantState.submissions.every(
        (item) => !item.answer && item.attachmentIds.length === 0 && item.review === null,
      ),
    )
    assert.equal(assistantState.drafts.length, 0)
    assert.equal((await state(outsider.token)).submissions.length, 0)
    assert.equal(
      (
        await fetch(`${base}/portal/files/${speech.id}`, {
          headers: { Authorization: `Bearer ${assistant.token}` },
        })
      ).status,
      404,
    )
    const teacherDownload = await fetch(`${base}/portal/files/${speech.id}`, {
      headers: { Authorization: `Bearer ${teacher.token}` },
    })
    assert.equal(teacherDownload.status, 200)
    assert.deepEqual(Buffer.from(await teacherDownload.arrayBuffer()), audio)
    await action(assistant.token, 'lesson.meeting.save', {
      id: consultation.id,
      expectedVersion: consultation.version,
      meetingSource: 'lesson',
      meetingUrl: 'https://zoom.us/j/987654321?pwd=private-review',
    })
    assert.equal(
      (await action(student.token, 'lesson.join', { id: consultation.id })).result!.url,
      'https://zoom.us/j/987654321?pwd=private-review',
    )
    await action(teacher.token, 'notification.create', {
      classId: room.id,
      recipientIds: [student.id],
      title: 'Study reminder',
      body: 'Review your teacher feedback.',
    })
    const notice = (await state(student.token)).notifications.find(
      (item) => item.title === 'Study reminder',
    )!
    await action(student.token, 'notification.read', { id: notice.id })
    const word = (
      await action(student.token, 'word.save', {
        word: 'practice',
        meaning: 'luyện tập',
        example: 'Practice every day.',
        topic: 'Learning',
        expectedVersion: 0,
      })
    ).state.words[0]!
    assert.equal(word.practice.reviewCount, 0)
    const reviewPayload = { id: word.id, expectedVersion: word.version, rating: 'good' }
    await rejected('', 'word.review', reviewPayload, 401)
    await rejected(outsider.token, 'word.review', reviewPayload, 404)
    await rejected(teacher.token, 'word.review', reviewPayload)
    await rejected(assistant.token, 'word.review', reviewPayload)
    await rejected(admin, 'word.review', reviewPayload)
    const reviewedWord = (await action(student.token, 'word.review', reviewPayload)).state.words[0]!
    assert.equal(reviewedWord.practice.reviewCount, 1)
    assert.equal(reviewedWord.practice.box, 1)
    assert.equal(reviewedWord.version, word.version + 1)
    await rejected(student.token, 'word.review', reviewPayload, 409)
    assert.deepEqual((await state(student.token)).words, [reviewedWord])
    assert.equal((await state(teacher.token)).words.length, 0)
    assert.equal((await state(admin)).words.length, 0)

    await stop()
    db.close()
    db = openDatabase(databasePath)
    server = createServer(db)
    await start()
    const persisted = await state(student.token)
    assert.deepEqual(
      persisted.submissions.map((item) => item.skill),
      skills,
    )
    assert.ok(persisted.submissions.every((item) => item.review?.score === 7.5))
    assert.equal(persisted.drafts.length, 4)
    assert.ok(
      persisted.drafts.every((item) => item.notes === 'Private reflection, never submitted'),
    )
    assert.equal(persisted.attendance[0]!.status, 'present')
    assert.equal(persisted.units[0]!.title.en, 'Four skills')
    assert.equal(persisted.materials[0]!.attachmentIds[0], materialAudio.id)
    assert.equal(persisted.bookings[0]!.id, reservation.id)
    assert.equal(persisted.lessons[0]!.reservedCount, 1)
    assert.equal(persisted.notifications.find((item) => item.id === notice.id)!.read, true)
    assert.equal(persisted.words[0]!.word, 'practice')
    assert.deepEqual(persisted.words[0]!.practice, reviewedWord.practice)
    assert.equal(persisted.words[0]!.version, reviewedWord.version)
    assert.equal(persisted.enrollmentRequests[0]!.status, 'approved')
    assert.ok(!JSON.stringify(persisted).includes('zoom.us'))
    assert.ok(!JSON.stringify(await api('/public/courses')).includes('studentIds'))
    const persistedFile = await fetch(`${base}/portal/files/${speech.id}`, {
      headers: { Authorization: `Bearer ${student.token}` },
    })
    assert.equal(persistedFile.status, 200)
    assert.deepEqual(Buffer.from(await persistedFile.arrayBuffer()), audio)
    await action(admin, 'user.update', { ...persisted.user, active: false })
    await api('/portal/state', student.token, undefined, 401)
    await api('/auth/login', '', { email: persisted.user.email, password }, 401)
  } finally {
    await stop()
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
