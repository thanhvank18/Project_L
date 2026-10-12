import type {
  Account,
  ActionInput,
  ActionResult,
  Assignment,
  Attendance,
  AuditEntry,
  Booking,
  Classroom,
  Draft,
  EnrollmentRequest,
  FileRecord,
  Lesson,
  LiveState,
  Material,
  MeetingSource,
  Notification,
  PublicCourse,
  Submission,
  Unit,
} from '../shared/portal.ts'
import { saveStudyWorkspace, visibleStudyWorkspaces } from './study-workspace.ts'
import { readingDefinition, readingResponse } from './reading.ts'
import { deleteWord, reviewWord, saveWord, visibleWords } from './vocabulary.ts'
import {
  consultationOutcomes,
  saveConsultationOutcome,
  assertBookingNotFinalized,
  assertFinalizedLessonUnchanged,
  assertReviewRelationship,
  assertMainReviewCompleted,
  mainReviewPreparation,
} from './consultation-outcomes.ts'
import {
  accounts,
  all,
  authenticated,
  bilingual,
  bool,
  classroom,
  current,
  dateTime,
  enumValue,
  fail,
  get,
  id,
  integer,
  now,
  put,
  role,
  str,
  strings,
  transaction,
  visibleClass,
} from './domain-store.ts'
import type { Database, Payload } from './domain-store.ts'

type StoredLesson = Omit<Lesson, 'meetingSource' | 'reservedCount'> & {
  meetingSource?: MeetingSource
  meetingUrl: string
}
type StoredClassMeeting = { id: string; meetingUrl: string; version: number }
type StoredNotification = Notification & { recipientId: string }
type RequestRecord = { id: string; fingerprint: string; submissionId: string }

const requireRecord = <T>(db: Database, kind: string, key: string): T =>
  get<T>(db, kind, key) ?? fail(404, 'not_found', 'The requested record is unavailable.')

function attachmentIds(
  db: Database,
  actor: Account,
  p: Payload,
  classId: string,
  purpose: FileRecord['purpose'],
): string[] {
  return strings(p, 'attachmentIds', 12).map((key) => {
    const file = requireRecord<FileRecord>(db, 'file', key)
    if (
      file.classId !== classId ||
      file.purpose !== purpose ||
      (purpose === 'submission' && file.ownerId !== actor.id) ||
      !canReadFile(db, actor, file)
    )
      fail(403, 'forbidden', 'An attachment is not available for this record.')
    return key
  })
}

function canReadFile(
  db: Database,
  actor: Account,
  file: FileRecord,
  rooms = all<Classroom>(db, 'class').filter((room) => visibleClass(actor, room)),
): boolean {
  if (!rooms.some((room) => room.id === file.classId)) return false
  if (
    file.ownerId === actor.id &&
    ((file.purpose === 'submission' && actor.role === 'student') ||
      (file.purpose === 'material' && (actor.role === 'admin' || actor.role === 'teacher')))
  )
    return true
  if (file.purpose === 'material') {
    return (
      all<Material>(db, 'material').some(
        (item) =>
          item.classId === file.classId &&
          (actor.role !== 'student' || item.published) &&
          item.attachmentIds.includes(file.id),
      ) ||
      all<Assignment>(db, 'assignment').some(
        (item) =>
          item.classId === file.classId &&
          (actor.role !== 'student' || item.published) &&
          item.attachmentIds.includes(file.id),
      ) ||
      (rooms.some((room) => room.id === file.classId && room.active) &&
        all<Submission>(db, 'submission').some(
          (item) =>
            item.classId === file.classId &&
            (actor.role !== 'student' || item.studentId === actor.id) &&
            item.promptAttachmentIds?.includes(file.id),
        ))
    )
  }
  if (actor.role === 'student') return file.ownerId === actor.id
  if (actor.role === 'assistant') return false
  return all<Submission>(db, 'submission').some(
    (item) => item.classId === file.classId && item.attachmentIds.includes(file.id),
  )
}

/** Every collection is filtered before serialization; private drafts and meeting URLs never cross role boundaries. */
export function getPortalState(db: Database, suppliedActor: Account): LiveState {
  const actor = authenticated(db, suppliedActor)
  const classes = all<Classroom>(db, 'class')
    .filter((room) => visibleClass(actor, room))
    .map((room) => ({ ...room, enrollmentOpen: room.enrollmentOpen === true }))
  const classIds = new Set(classes.map((room) => room.id))
  const allowedUserIds = new Set([
    actor.id,
    ...classes.flatMap((room) =>
      actor.role === 'student'
        ? room.teacherIds
        : [...room.teacherIds, ...room.assistantIds, ...room.studentIds],
    ),
  ])
  const assignments = all<Assignment>(db, 'assignment').filter(
    (task) => classIds.has(task.classId) && (actor.role !== 'student' || task.published),
  )
  const taskIds = new Set(assignments.map((task) => task.id))
  const bookings = all<Booking>(db, 'booking')
  const reservedCounts = new Map<string, number>()
  for (const booking of bookings)
    if (booking.status === 'booked')
      reservedCounts.set(booking.lessonId, (reservedCounts.get(booking.lessonId) ?? 0) + 1)
  const lessons = all<StoredLesson>(db, 'lesson')
    .filter((lesson) => classIds.has(lesson.classId))
    .map(({ meetingUrl, ...lesson }) => {
      const stored = { ...lesson, meetingUrl }
      return {
        ...lesson,
        meetingSource: lessonMeetingSource(stored),
        hasMeeting: Boolean(resolveMeetingUrl(db, stored)),
        reservedCount: reservedCounts.get(lesson.id) ?? 0,
      }
    })
  const lessonIds = new Set(lessons.map((lesson) => lesson.id))
  return {
    user: actor,
    users: accounts(db).filter((user) => actor.role === 'admin' || allowedUserIds.has(user.id)),
    classes,
    classMeetings: classes.map((room) => {
      const meeting = get<StoredClassMeeting>(db, 'classMeeting', room.id)
      return {
        classId: room.id,
        hasMeeting: Boolean(meeting?.meetingUrl),
        version: meeting?.version ?? 0,
      }
    }),
    openClasses: getPublicCourses(db).filter((room) => room.enrollmentOpen),
    enrollmentRequests: all<EnrollmentRequest>(db, 'enrollmentRequest').filter(
      (request) =>
        actor.role === 'admin' || (actor.role === 'student' && request.studentId === actor.id),
    ),
    assignments,
    drafts: all<Draft>(db, 'draft').filter(
      (draft) =>
        actor.role === 'student' && draft.studentId === actor.id && taskIds.has(draft.assignmentId),
    ),
    studyWorkspaces: visibleStudyWorkspaces(db, actor, taskIds),
    submissions: all<Submission>(db, 'submission')
      .filter(
        (submission) =>
          classIds.has(submission.classId) &&
          (actor.role !== 'student' || submission.studentId === actor.id),
      )
      .map((submission) =>
        actor.role === 'assistant'
          ? {
              ...submission,
              answer: '',
              readingAnswers: undefined,
              attachmentIds: [],
              review: null,
            }
          : submission,
      ),
    materials: all<Material>(db, 'material').filter(
      (material) =>
        classIds.has(material.classId) && (actor.role !== 'student' || material.published),
    ),
    units: all<Unit>(db, 'unit').filter((unit) => classIds.has(unit.classId)),
    attendance: all<Attendance>(db, 'attendance').filter(
      (entry) =>
        classIds.has(entry.classId) && (actor.role !== 'student' || entry.studentId === actor.id),
    ),
    lessons,
    bookings: bookings.filter(
      (booking) =>
        lessonIds.has(booking.lessonId) &&
        (actor.role !== 'student' || booking.studentId === actor.id),
    ),
    consultationOutcomes: consultationOutcomes(db, actor),
    mainReviewPreparation: mainReviewPreparation(db, actor),
    words: visibleWords(db, actor),
    notifications: all<StoredNotification>(db, 'notification')
      .filter((notification) => notification.recipientId === actor.id)
      .map(({ id, title, body, createdAt, read }) => ({ id, title, body, createdAt, read })),
    files: all<FileRecord>(db, 'file').filter((file) => canReadFile(db, actor, file, classes)),
    audit: actor.role === 'admin' ? all<AuditEntry>(db, 'audit') : [],
    integrations: { email: false, zoom: false, ai: false },
    fetchedAt: now(),
  }
}

function notify(db: Database, recipients: string[], title: string, body: string) {
  const activeIds = new Set(
    accounts(db)
      .filter((account) => account.active)
      .map((account) => account.id),
  )
  for (const recipientId of new Set(recipients))
    if (activeIds.has(recipientId))
      put<StoredNotification>(db, 'notification', {
        id: id(),
        recipientId,
        title,
        body,
        createdAt: now(),
        read: false,
      })
}

function saveClass(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin'])
  const record = current<Classroom>(db, 'class', p)
  const teacherIds = strings(p, 'teacherIds')
  const assistantIds = strings(p, 'assistantIds')
  const studentIds = strings(p, 'studentIds')
  const users = accounts(db)
  for (const [ids, expectedRole] of [
    [teacherIds, 'teacher'],
    [assistantIds, 'assistant'],
    [studentIds, 'student'],
  ] as const) {
    if (
      ids.some(
        (key) =>
          !users.some((user) => user.id === key && user.role === expectedRole && user.active),
      )
    )
      fail(400, 'invalid_member', 'Class members must be active accounts with the matching role.')
  }
  put<Classroom>(db, 'class', {
    id: record.key,
    version: record.version,
    title: str(p, 'title', 200),
    level: str(p, 'level', 100, true),
    description: str(p, 'description', 5000, true),
    teacherIds,
    assistantIds,
    studentIds,
    active: bool(p, 'active'),
    listed: p.listed === undefined ? false : bool(p, 'listed'),
    enrollmentOpen:
      p.enrollmentOpen === undefined
        ? record.previous?.enrollmentOpen === true
        : bool(p, 'enrollmentOpen'),
  })
  return record.key
}

function requestEnrollment(db: Database, actor: Account, p: Payload): string {
  role(actor, ['student'])
  onlyFields(p, ['classId'])
  const room = requireRecord<Classroom>(db, 'class', str(p, 'classId', 150))
  if (!room.active || !room.listed || !room.enrollmentOpen)
    fail(409, 'enrollment_closed', 'This class is not accepting enrollment requests.')
  if (room.studentIds.includes(actor.id))
    fail(409, 'already_enrolled', 'You are already enrolled in this class.')
  if (
    all<EnrollmentRequest>(db, 'enrollmentRequest').some(
      (request) =>
        request.classId === room.id &&
        request.studentId === actor.id &&
        request.status === 'pending',
    )
  )
    fail(409, 'enrollment_pending', 'Your enrollment request is already awaiting approval.')
  const timestamp = now()
  const request: EnrollmentRequest = {
    id: id(),
    classId: room.id,
    classTitle: room.title,
    studentId: actor.id,
    status: 'pending',
    note: '',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  put(db, 'enrollmentRequest', request)
  notify(
    db,
    accounts(db)
      .filter((account) => account.role === 'admin')
      .map((account) => account.id),
    'Enrollment request / Yêu cầu đăng ký lớp',
    `${actor.name} · ${room.title}`,
  )
  return request.id
}

function cancelEnrollment(db: Database, actor: Account, p: Payload): string {
  role(actor, ['student'])
  onlyFields(p, ['id', 'expectedVersion'])
  const request = requireRecord<EnrollmentRequest>(db, 'enrollmentRequest', str(p, 'id', 150))
  if (request.studentId !== actor.id)
    fail(404, 'not_found', 'The enrollment request is unavailable.')
  if (request.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This enrollment request changed. Reload it before cancelling.')
  if (request.status !== 'pending')
    fail(409, 'enrollment_resolved', 'Only pending enrollment requests can be cancelled.')
  put<EnrollmentRequest>(db, 'enrollmentRequest', {
    ...request,
    status: 'cancelled',
    version: request.version + 1,
    updatedAt: now(),
  })
  return request.id
}

function reviewEnrollment(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin'])
  onlyFields(p, ['id', 'expectedVersion', 'decision', 'note'])
  const request = requireRecord<EnrollmentRequest>(db, 'enrollmentRequest', str(p, 'id', 150))
  if (request.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This enrollment request changed. Reload it before reviewing.')
  if (request.status !== 'pending')
    fail(409, 'enrollment_resolved', 'This enrollment request has already been resolved.')
  const decision = enumValue(p, 'decision', ['approved', 'rejected'])
  const note = p.note === undefined ? '' : str(p, 'note', 2000, true).trim()
  if (decision === 'approved') {
    const room = requireRecord<Classroom>(db, 'class', request.classId)
    if (!room.active || !room.listed || !room.enrollmentOpen)
      fail(
        409,
        'enrollment_closed',
        'Reopen enrollment for this class before approving the request.',
      )
    if (
      !accounts(db).some(
        (account) =>
          account.id === request.studentId && account.active && account.role === 'student',
      )
    )
      fail(409, 'student_unavailable', 'This account is no longer an active student.')
    if (!room.studentIds.includes(request.studentId))
      put<Classroom>(db, 'class', {
        ...room,
        studentIds: [...room.studentIds, request.studentId],
        version: room.version + 1,
      })
  }
  put<EnrollmentRequest>(db, 'enrollmentRequest', {
    ...request,
    status: decision,
    note,
    reviewedBy: actor.id,
    version: request.version + 1,
    updatedAt: now(),
  })
  notify(
    db,
    [request.studentId],
    decision === 'approved'
      ? 'Enrollment approved / Đăng ký lớp được duyệt'
      : 'Enrollment not approved / Đăng ký lớp chưa được duyệt',
    [request.classTitle, note].filter(Boolean).join(' · '),
  )
  return request.id
}

function saveAssignment(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin', 'teacher'])
  const classId = str(p, 'classId', 150)
  classroom(db, actor, classId, true)
  const record = current<Assignment>(db, 'assignment', p)
  if (record.previous && record.previous.classId !== classId)
    fail(400, 'invalid_payload', 'An assignment cannot be moved between classes.')
  const skill = enumValue(p, 'skill', ['reading', 'writing', 'listening', 'speaking'])
  const reading =
    p.reading === undefined
      ? record.previous?.reading
      : p.reading === null
        ? undefined
        : readingDefinition(p.reading)
  if (reading && skill !== 'reading' && skill !== 'listening')
    fail(
      400,
      'invalid_reading',
      'Structured questions require Reading or Listening; remove them explicitly before changing to another skill.',
    )
  const pasteRestricted =
    p.pasteRestricted === undefined
      ? (record.previous?.pasteRestricted ?? false)
      : bool(p, 'pasteRestricted')
  put<Assignment>(db, 'assignment', {
    id: record.key,
    classId,
    version: record.version,
    title: bilingual(p, 'title', 200),
    instructions: bilingual(p, 'instructions'),
    skill,
    ...(reading ? { reading } : {}),
    ...(skill === 'writing' ? { pasteRestricted } : {}),
    dueAt: dateTime(p, 'dueAt', true),
    published: bool(p, 'published'),
    required: bool(p, 'required'),
    attachmentIds: attachmentIds(db, actor, p, classId, 'material'),
    createdAt: record.previous?.createdAt ?? now(),
    updatedAt: now(),
  })
  return record.key
}

function studentAssignment(db: Database, actor: Account, p: Payload): Assignment {
  role(actor, ['student'])
  const task = requireRecord<Assignment>(db, 'assignment', str(p, 'assignmentId', 150))
  classroom(db, actor, task.classId)
  if (!task.published) fail(404, 'not_found', 'The assignment is not published.')
  if (integer(p, 'assignmentVersion', 1) !== task.version)
    fail(
      409,
      'assignment_changed',
      'The teacher updated this assignment. Reload the instructions before submitting.',
    )
  return task
}

function saveDraft(db: Database, actor: Account, p: Payload): string {
  const task = studentAssignment(db, actor, p)
  const key = `${actor.id}:${task.id}`
  const previous = get<Draft>(db, 'draft', key)
  const expectedVersion = integer(p, 'expectedVersion')
  if ((previous?.version ?? 0) !== expectedVersion)
    fail(409, 'conflict', 'Your draft was updated elsewhere. Reload before saving.')
  if (
    !task.reading &&
    p.readingAnswers !== undefined &&
    (!p.readingAnswers ||
      typeof p.readingAnswers !== 'object' ||
      Array.isArray(p.readingAnswers) ||
      Object.keys(p.readingAnswers).length)
  )
    fail(
      400,
      'invalid_reading_answers',
      'This assignment does not accept structured question responses.',
    )
  const readingAnswers = task.reading
    ? readingResponse(
        p.readingAnswers === undefined
          ? previous?.assignmentVersion === task.version
            ? (previous.readingAnswers ?? {})
            : {}
          : p.readingAnswers,
        task.reading,
      )
    : undefined
  put<Draft>(db, 'draft', {
    id: key,
    assignmentId: task.id,
    assignmentVersion: task.version,
    studentId: actor.id,
    answer: str(p, 'answer', 100000, true),
    ...(task.reading ? { reading: task.reading, readingAnswers } : {}),
    notes: str(p, 'notes', 50000, true),
    attachmentIds: attachmentIds(db, actor, p, task.classId, 'submission'),
    version: expectedVersion + 1,
    updatedAt: now(),
  })
  return key
}

function submit(db: Database, actor: Account, p: Payload): string {
  role(actor, ['student'])
  const requestId = str(p, 'requestId', 150)
  const fingerprint = JSON.stringify([
    str(p, 'assignmentId', 150),
    integer(p, 'assignmentVersion', 1),
    integer(p, 'draftVersion', 1),
    integer(p, 'expectedRevision'),
  ])
  const requestKey = `${actor.id}:${requestId}`
  const prior = get<RequestRecord>(db, 'submission-request', requestKey)
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      fail(
        409,
        'request_reused',
        'This request identifier was already used for a different submission.',
      )
    const existing = requireRecord<Submission>(db, 'submission', prior.submissionId)
    classroom(db, actor, existing.classId)
    return prior.submissionId
  }
  const task = studentAssignment(db, actor, p)
  const draft = requireRecord<Draft>(db, 'draft', `${actor.id}:${task.id}`)
  if (draft.version !== integer(p, 'draftVersion', 1) || draft.assignmentVersion !== task.version)
    fail(
      409,
      'conflict',
      'Your draft or assignment changed. Save the current draft before submitting.',
    )
  const readingAnswers = task.reading
    ? readingResponse(draft.readingAnswers ?? {}, task.reading, true)
    : undefined
  if (!task.reading && !draft.answer.trim() && !draft.attachmentIds.length)
    fail(400, 'empty_submission', 'Write an answer or attach your work before submitting.')
  attachmentIds(db, actor, { attachmentIds: draft.attachmentIds }, task.classId, 'submission')
  const promptAttachmentIds = attachmentIds(
    db,
    actor,
    { attachmentIds: task.attachmentIds },
    task.classId,
    'material',
  )
  const lastRevision = Math.max(
    0,
    ...all<Submission>(db, 'submission')
      .filter((item) => item.studentId === actor.id && item.assignmentId === task.id)
      .map((item) => item.revision),
  )
  if (lastRevision !== integer(p, 'expectedRevision'))
    fail(409, 'conflict', 'A newer submission already exists. Reload your submission history.')
  const submission: Submission = {
    id: id(),
    assignmentId: task.id,
    classId: task.classId,
    studentId: actor.id,
    revision: lastRevision + 1,
    assignmentVersion: task.version,
    title: task.title,
    instructions: task.instructions,
    skill: task.skill,
    ...(task.skill === 'writing' ? { pasteRestricted: task.pasteRestricted ?? false } : {}),
    answer: draft.answer,
    ...(task.reading ? { reading: task.reading, readingAnswers } : {}),
    promptAttachmentIds,
    attachmentIds: [...draft.attachmentIds],
    submittedAt: now(),
    review: null,
    version: 1,
  }
  put(db, 'submission', submission)
  put<RequestRecord>(db, 'submission-request', {
    id: requestKey,
    fingerprint,
    submissionId: submission.id,
  })
  notify(
    db,
    classroom(db, actor, task.classId).teacherIds,
    'New submission / Bài nộp mới',
    `${actor.name} · ${task.title.vi} / ${task.title.en} · #${submission.revision}`,
  )
  return submission.id
}

function review(db: Database, actor: Account, p: Payload): string {
  role(actor, ['teacher'])
  const submission = requireRecord<Submission>(db, 'submission', str(p, 'id', 150))
  classroom(db, actor, submission.classId, true)
  if (submission.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This submission changed. Reload it before reviewing.')
  if (submission.review)
    fail(409, 'already_reviewed', 'This revision already has a review. Reviews are permanent.')
  const score = p.score
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 9)
    fail(400, 'invalid_score', 'Score must be a number from 0 to 9.')
  put<Submission>(db, 'submission', {
    ...submission,
    version: submission.version + 1,
    review: {
      score: score as number,
      feedback: str(p, 'feedback', 20000),
      teacherId: actor.id,
      reviewedAt: now(),
    },
  })
  notify(
    db,
    [submission.studentId],
    'Your review is ready / Đã có nhận xét',
    `${submission.title.vi} / ${submission.title.en} · #${submission.revision}`,
  )
  return submission.id
}

function saveContent(
  db: Database,
  actor: Account,
  p: Payload,
  kind: 'material' | 'unit' | 'attendance',
): string {
  role(actor, ['admin', 'teacher'])
  const classId = str(p, 'classId', 150)
  const room = classroom(db, actor, classId, true)
  const existingAttendance =
    kind === 'attendance' && p.id === undefined
      ? all<Attendance>(db, 'attendance').find(
          (item) =>
            item.classId === classId && item.studentId === p.studentId && item.date === p.date,
        )
      : undefined
  const record = current<Material | Unit | Attendance>(
    db,
    kind,
    existingAttendance ? { ...p, id: existingAttendance.id } : p,
  )
  if (record.previous && record.previous.classId !== classId)
    fail(400, 'invalid_payload', 'Records cannot move between classes.')
  const base = { id: record.key, classId, version: record.version }
  if (kind === 'material')
    put<Material>(db, kind, {
      ...base,
      title: str(p, 'title', 200),
      content: str(p, 'content', 50000, true),
      attachmentIds: attachmentIds(db, actor, p, classId, 'material'),
      published: bool(p, 'published'),
    })
  if (kind === 'unit')
    put<Unit>(db, kind, {
      ...base,
      title: bilingual(p, 'title', 200),
      completed: bool(p, 'completed'),
    })
  if (kind === 'attendance') {
    const studentId = str(p, 'studentId', 150)
    if (
      !room.studentIds.includes(studentId) ||
      !accounts(db).some(
        (account) => account.id === studentId && account.active && account.role === 'student',
      )
    )
      fail(400, 'invalid_student', 'Select an active student enrolled in this class.')
    const date = str(p, 'date', 10)
    if (
      !/^\d{4}-\d\d-\d\d$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      fail(400, 'invalid_date', 'Attendance date must be a valid YYYY-MM-DD date.')
    const duplicate = all<Attendance>(db, kind).find(
      (item) =>
        item.classId === classId &&
        item.studentId === studentId &&
        item.date === date &&
        item.id !== record.key,
    )
    if (duplicate)
      fail(
        409,
        'conflict',
        'Attendance for this student and date already exists. Edit the existing record.',
      )
    put<Attendance>(db, kind, {
      ...base,
      studentId,
      date,
      status: enumValue(p, 'status', ['present', 'absent', 'late', 'unmarked']),
    })
  }
  return record.key
}

function overlap(
  a: Pick<Lesson, 'startsAt' | 'endsAt'>,
  b: Pick<Lesson, 'startsAt' | 'endsAt'>,
): boolean {
  return (
    Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt)
  )
}

function meetingUrl(p: Payload): string {
  const value = str(p, 'meetingUrl', 2000, true).trim()
  if (!value) return ''
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return fail(400, 'invalid_meeting_url', 'Enter a valid HTTPS Zoom meeting URL.')
  }
  if (
    parsed.protocol !== 'https:' ||
    (parsed.hostname !== 'zoom.us' && !parsed.hostname.endsWith('.zoom.us')) ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443') ||
    !/^\/(j|my)\//.test(parsed.pathname)
  )
    fail(400, 'invalid_meeting_url', 'Enter an HTTPS zoom.us meeting URL using /j/ or /my/.')
  return parsed.href
}

/** Legacy lessons keep their private override; unsupplied main-class links inherit the class. */
function lessonMeetingSource(lesson: StoredLesson): MeetingSource {
  return (
    lesson.meetingSource ??
    (lesson.meetingUrl ? 'lesson' : lesson.kind === 'class' ? 'class' : 'none')
  )
}

function resolveMeetingUrl(db: Database, lesson: StoredLesson): string {
  const source = lessonMeetingSource(lesson)
  if (source === 'class')
    return get<StoredClassMeeting>(db, 'classMeeting', lesson.classId)?.meetingUrl ?? ''
  return source === 'lesson' ? lesson.meetingUrl : ''
}

function lessonMeetingSettings(
  p: Payload,
  kind: Lesson['kind'],
  previous?: StoredLesson,
): { meetingSource: MeetingSource; meetingUrl: string } {
  if (p.meetingSource === undefined) {
    if (p.meetingUrl !== undefined) {
      const url = meetingUrl(p)
      return { meetingSource: url ? 'lesson' : 'none', meetingUrl: url }
    }
    return previous
      ? { meetingSource: lessonMeetingSource(previous), meetingUrl: previous.meetingUrl }
      : { meetingSource: kind === 'class' ? 'class' : 'none', meetingUrl: '' }
  }
  const source = enumValue(p, 'meetingSource', ['class', 'lesson', 'none'])
  const url = p.meetingUrl === undefined ? undefined : meetingUrl(p)
  if (source !== 'lesson') {
    if (url) fail(400, 'invalid_payload', 'Only a lesson-specific meeting may include a Zoom URL.')
    return { meetingSource: source, meetingUrl: '' }
  }
  const override =
    url ?? (previous && lessonMeetingSource(previous) === 'lesson' ? previous.meetingUrl : '')
  if (!override)
    fail(
      400,
      'invalid_meeting_url',
      'Enter a Zoom meeting URL or select a different meeting source.',
    )
  return { meetingSource: source, meetingUrl: override }
}

function onlyFields(p: Payload, allowed: string[]): void {
  if (Object.keys(p).some((key) => !allowed.includes(key)))
    fail(400, 'invalid_payload', 'This action contains unsupported fields.')
}

function saveClassMeeting(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin', 'teacher', 'assistant'])
  onlyFields(p, ['classId', 'expectedVersion', 'meetingUrl'])
  const classId = str(p, 'classId', 150)
  classroom(db, actor, classId)
  const previous = get<StoredClassMeeting>(db, 'classMeeting', classId)
  const expected = integer(p, 'expectedVersion')
  if ((previous?.version ?? 0) !== expected)
    fail(409, 'conflict', 'The class Zoom link changed. Reload it before saving your changes.')
  put<StoredClassMeeting>(db, 'classMeeting', {
    id: classId,
    version: expected + 1,
    meetingUrl: meetingUrl(p),
  })
  return classId
}

function saveLessonMeeting(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin', 'teacher', 'assistant'])
  onlyFields(p, ['id', 'expectedVersion', 'meetingSource', 'meetingUrl'])
  const previous = requireRecord<StoredLesson>(db, 'lesson', str(p, 'id', 150))
  classroom(db, actor, previous.classId)
  if (previous.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This lesson changed. Reload it before saving your Zoom settings.')
  enumValue(p, 'meetingSource', ['class', 'lesson', 'none'])
  const lesson = {
    ...previous,
    ...lessonMeetingSettings(p, previous.kind, previous),
    version: previous.version + 1,
  }
  lesson.hasMeeting = Boolean(resolveMeetingUrl(db, lesson))
  put(db, 'lesson', lesson)
  return lesson.id
}

function saveLesson(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin', 'teacher'])
  const classId = str(p, 'classId', 150)
  const room = classroom(db, actor, classId, true)
  const record = current<StoredLesson>(db, 'lesson', p)
  if (record.previous && record.previous.classId !== classId)
    fail(400, 'invalid_payload', 'Lessons cannot move between classes.')
  const startsAt = dateTime(p, 'startsAt')
  const endsAt = dateTime(p, 'endsAt')
  if (
    Date.parse(endsAt) <= Date.parse(startsAt) ||
    Date.parse(endsAt) - Date.parse(startsAt) > 24 * 60 * 60 * 1000
  )
    fail(400, 'invalid_time', 'A lesson must end after it starts and last at most 24 hours.')
  const hostId = str(p, 'hostId', 150)
  if (
    !room.teacherIds.includes(hostId) ||
    !accounts(db).some(
      (account) => account.id === hostId && account.active && account.role === 'teacher',
    )
  )
    fail(400, 'invalid_host', 'The host must be an active teacher assigned to this class.')
  const kind = enumValue(p, 'kind', ['class', 'consultation'])
  const reviewForLessonId =
    p.reviewForLessonId === undefined
      ? record.previous?.reviewForLessonId
      : str(p, 'reviewForLessonId', 150, true).trim() || undefined
  if (kind !== 'consultation' && reviewForLessonId)
    fail(400, 'invalid_payload', 'Only a consultation can be linked to a main lesson for review.')
  const capacity = integer(p, 'capacity', 1, 10000)
  if (kind === 'consultation' && capacity !== 1)
    fail(
      400,
      'invalid_capacity',
      'A one-to-one consultation must have capacity for exactly one student.',
    )
  const lesson: StoredLesson = {
    id: record.key,
    classId,
    version: record.version,
    title: str(p, 'title', 200),
    startsAt,
    endsAt,
    kind,
    reviewForLessonId,
    hostId,
    capacity,
    cancelled: bool(p, 'cancelled'),
    ...lessonMeetingSettings(p, kind, record.previous),
    hasMeeting: false,
  }
  lesson.hasMeeting = Boolean(resolveMeetingUrl(db, lesson))
  assertFinalizedLessonUnchanged(db, record.previous, lesson)
  if (
    !lesson.cancelled &&
    (!record.previous ||
      lesson.startsAt !== record.previous.startsAt ||
      lesson.endsAt !== record.previous.endsAt ||
      lesson.kind !== record.previous.kind ||
      lesson.reviewForLessonId !== record.previous.reviewForLessonId)
  )
    assertReviewRelationship(db, lesson)
  if (
    !lesson.cancelled &&
    all<StoredLesson>(db, 'lesson').some(
      (other) =>
        other.id !== lesson.id &&
        !other.cancelled &&
        (other.hostId === hostId ||
          (other.classId === classId && other.kind === 'class' && lesson.kind === 'class')) &&
        overlap(lesson, other),
    )
  )
    fail(409, 'schedule_conflict', 'This host or class already has a lesson at that time.')
  const bookings = all<Booking>(db, 'booking').filter(
    (booking) => booking.lessonId === lesson.id && booking.status === 'booked',
  )
  if (bookings.length > lesson.capacity)
    fail(
      409,
      'capacity_conflict',
      'Capacity cannot be lower than the number of existing reservations.',
    )
  if (
    bookings.length &&
    record.previous &&
    (lesson.startsAt !== record.previous.startsAt ||
      lesson.endsAt !== record.previous.endsAt ||
      lesson.kind !== record.previous.kind ||
      lesson.reviewForLessonId !== record.previous.reviewForLessonId)
  )
    fail(
      409,
      'bookings_exist',
      'Cancel existing reservations before changing this lesson time, kind or review target.',
    )
  put(db, 'lesson', lesson)
  if (lesson.cancelled)
    for (const booking of bookings)
      put<Booking>(db, 'booking', { ...booking, status: 'cancelled', version: booking.version + 1 })
  if (
    record.previous &&
    (lesson.cancelled !== record.previous.cancelled ||
      lesson.startsAt !== record.previous.startsAt ||
      lesson.endsAt !== record.previous.endsAt)
  )
    notify(db, room.studentIds, 'Lesson updated / Cập nhật buổi học', lesson.title)
  return lesson.id
}

function checkLessonHost(db: Database, room: Classroom, lesson: Pick<Lesson, 'hostId'>): void {
  if (
    !room.teacherIds.includes(lesson.hostId) ||
    !accounts(db).some(
      (account) => account.id === lesson.hostId && account.active && account.role === 'teacher',
    )
  )
    fail(
      409,
      'host_unavailable',
      'The lesson host is no longer available. Ask an administrator to assign an active teacher.',
    )
}

function createBooking(db: Database, actor: Account, p: Payload): string {
  role(actor, ['student'])
  const lesson = requireRecord<StoredLesson>(db, 'lesson', str(p, 'lessonId', 150))
  checkLessonHost(db, classroom(db, actor, lesson.classId), lesson)
  if (p.expectedVersion !== undefined && integer(p, 'expectedVersion', 1) !== lesson.version)
    fail(409, 'conflict', 'This lesson changed. Reload its schedule.')
  if (
    lesson.cancelled ||
    lesson.kind !== 'consultation' ||
    Date.parse(lesson.startsAt) <= Date.now()
  )
    fail(400, 'unavailable', 'This consultation is no longer available for booking.')
  assertReviewRelationship(db, lesson)
  const bookings = all<Booking>(db, 'booking').filter((booking) => booking.status === 'booked')
  if (bookings.some((booking) => booking.lessonId === lesson.id && booking.studentId === actor.id))
    fail(409, 'already_booked', 'You already reserved this consultation.')
  if (bookings.filter((booking) => booking.lessonId === lesson.id).length >= lesson.capacity)
    fail(409, 'full', 'This consultation is full.')
  const bookedLessonIds = new Set(
    bookings.filter((booking) => booking.studentId === actor.id).map((booking) => booking.lessonId),
  )
  const studentClassIds = new Set(
    all<Classroom>(db, 'class')
      .filter((room) => visibleClass(actor, room))
      .map((room) => room.id),
  )
  if (
    all<StoredLesson>(db, 'lesson').some(
      (other) =>
        !other.cancelled &&
        other.id !== lesson.id &&
        (bookedLessonIds.has(other.id) ||
          (other.kind === 'class' && studentClassIds.has(other.classId))) &&
        overlap(lesson, other),
    )
  )
    fail(409, 'schedule_conflict', 'This consultation overlaps your class or another reservation.')
  const booking: Booking = {
    id: id(),
    lessonId: lesson.id,
    studentId: actor.id,
    status: 'booked',
    version: 1,
    createdAt: now(),
  }
  put(db, 'booking', booking)
  return booking.id
}

function cancelBooking(db: Database, actor: Account, p: Payload): string {
  role(actor, ['student'])
  const booking = requireRecord<Booking>(db, 'booking', str(p, 'id', 150))
  if (booking.studentId !== actor.id) fail(404, 'not_found', 'The reservation is unavailable.')
  const lesson = requireRecord<StoredLesson>(db, 'lesson', booking.lessonId)
  classroom(db, actor, lesson.classId)
  if (booking.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This reservation changed. Reload it before cancelling.')
  assertBookingNotFinalized(db, booking.id)
  put<Booking>(db, 'booking', { ...booking, version: booking.version + 1, status: 'cancelled' })
  return booking.id
}

function joinLesson(db: Database, actor: Account, p: Payload): string {
  const lesson = requireRecord<StoredLesson>(db, 'lesson', str(p, 'id', 150))
  checkLessonHost(db, classroom(db, actor, lesson.classId), lesson)
  if (lesson.cancelled) fail(400, 'unavailable', 'This lesson was cancelled.')
  assertMainReviewCompleted(db, actor, lesson)
  if (actor.role === 'student' && lesson.kind === 'consultation') {
    assertReviewRelationship(db, lesson)
    if (
      !all<Booking>(db, 'booking').some(
        (booking) =>
          booking.lessonId === lesson.id &&
          booking.studentId === actor.id &&
          booking.status === 'booked',
      )
    )
      fail(403, 'booking_required', 'Reserve this consultation before joining.')
    const required = all<Assignment>(db, 'assignment').filter(
      (task) => task.classId === lesson.classId && task.published && task.required,
    )
    const submissions = all<Submission>(db, 'submission').filter(
      (submission) => submission.studentId === actor.id,
    )
    if (
      required.some(
        (task) =>
          !submissions.some(
            (submission) =>
              submission.assignmentId === task.id && submission.assignmentVersion === task.version,
          ),
      )
    )
      fail(
        403,
        'preparation_required',
        'Submit the current version of every required assignment before joining this consultation.',
      )
  }
  const url = resolveMeetingUrl(db, lesson)
  if (!url)
    fail(409, 'meeting_unconfigured', 'A Zoom meeting URL is not configured for this lesson yet.')
  return url
}

function createNotification(db: Database, actor: Account, p: Payload): string {
  role(actor, ['admin', 'teacher'])
  const recipientIds = strings(p, 'recipientIds')
  if (!recipientIds.length) fail(400, 'invalid_recipients', 'Select at least one recipient.')
  if (actor.role === 'teacher') {
    const room = classroom(db, actor, str(p, 'classId', 150), true)
    const allowed = new Set([...room.studentIds, ...room.teacherIds, ...room.assistantIds])
    if (recipientIds.some((key) => !allowed.has(key)))
      fail(403, 'forbidden', 'Teachers may send notifications only to their assigned class.')
  } else if (p.classId !== undefined) classroom(db, actor, str(p, 'classId', 150))
  if (
    recipientIds.some(
      (key) => !accounts(db).some((account) => account.id === key && account.active),
    )
  )
    fail(400, 'invalid_recipients', 'Recipients must be active accounts.')
  notify(db, recipientIds, str(p, 'title', 200), str(p, 'body', 10000))
  return ''
}

/** Commands are validated and committed atomically, including revision checks and notifications. */
export function runAction(db: Database, suppliedActor: Account, input: ActionInput): ActionResult {
  if (
    !input ||
    typeof input.type !== 'string' ||
    !input.payload ||
    typeof input.payload !== 'object' ||
    Array.isArray(input.payload)
  )
    fail(400, 'invalid_payload', 'Provide an action type and payload.')
  return transaction(db, () => {
    const actor = authenticated(db, suppliedActor)
    const p = input.payload
    let targetId = ''
    let result: Record<string, unknown> | undefined
    switch (input.type) {
      case 'class.save':
        targetId = saveClass(db, actor, p)
        break
      case 'consultation.outcome.save':
        targetId = saveConsultationOutcome(db, actor, p)
        break
      case 'class.meeting.save':
        targetId = saveClassMeeting(db, actor, p)
        break
      case 'enrollment.request':
        targetId = requestEnrollment(db, actor, p)
        break
      case 'enrollment.cancel':
        targetId = cancelEnrollment(db, actor, p)
        break
      case 'enrollment.review':
        targetId = reviewEnrollment(db, actor, p)
        break
      case 'assignment.save':
        targetId = saveAssignment(db, actor, p)
        break
      case 'draft.save':
        targetId = saveDraft(db, actor, p)
        break
      case 'study.save':
        targetId = saveStudyWorkspace(db, actor, p)
        break
      case 'submission.create':
        targetId = submit(db, actor, p)
        break
      case 'submission.review':
        targetId = review(db, actor, p)
        break
      case 'material.save':
        targetId = saveContent(db, actor, p, 'material')
        break
      case 'unit.save':
        targetId = saveContent(db, actor, p, 'unit')
        break
      case 'attendance.save':
        targetId = saveContent(db, actor, p, 'attendance')
        break
      case 'lesson.save':
        targetId = saveLesson(db, actor, p)
        break
      case 'lesson.meeting.save':
        targetId = saveLessonMeeting(db, actor, p)
        break
      case 'booking.create':
        targetId = createBooking(db, actor, p)
        break
      case 'booking.cancel':
        targetId = cancelBooking(db, actor, p)
        break
      case 'lesson.join':
        targetId = str(p, 'id', 150)
        result = { url: joinLesson(db, actor, p) }
        break
      case 'word.save':
        targetId = saveWord(db, actor, p)
        break
      case 'word.review':
        targetId = reviewWord(db, actor, p)
        break
      case 'word.delete':
        targetId = deleteWord(db, actor, p)
        break
      case 'notification.create':
        targetId = createNotification(db, actor, p)
        break
      case 'notification.read': {
        targetId = str(p, 'id', 150)
        const notification = requireRecord<StoredNotification>(db, 'notification', targetId)
        if (notification.recipientId !== actor.id)
          fail(404, 'not_found', 'The notification is unavailable.')
        put(db, 'notification', { ...notification, read: true })
        break
      }
      default:
        fail(400, 'unknown_action', 'This action is not supported.')
    }
    put<AuditEntry>(db, 'audit', {
      id: id(),
      actorId: actor.id,
      action: input.type,
      targetId,
      createdAt: now(),
    })
    return { state: getPortalState(db, actor), result: { id: targetId, ...result } }
  })
}

export function getPublicCourses(db: Database): PublicCourse[] {
  return all<Classroom>(db, 'class')
    .filter((room) => room.active && room.listed)
    .map(({ id: key, title, level, description, enrollmentOpen }) => ({
      id: key,
      title,
      level,
      description,
      enrollmentOpen: enrollmentOpen === true,
    }))
}

const allowedFile = (mime: string, bytes: Buffer): boolean => {
  if (mime === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime === 'image/png')
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === 'image/jpeg')
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (mime === 'audio/mpeg')
    return (
      bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
      (bytes.length >= 2 && bytes[0] === 255 && (bytes[1]! & 224) === 224)
    )
  if (mime === 'audio/wav' || mime === 'audio/x-wav')
    return (
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WAVE'
    )
  if (mime === 'audio/ogg' || mime === 'application/ogg')
    return bytes.subarray(0, 4).toString('ascii') === 'OggS'
  if (mime === 'audio/webm' || mime === 'video/webm')
    return bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
  return false
}

export type FileUploadMetadata = {
  name: string
  mime: string
  classId: string
  purpose: 'material' | 'submission'
}

export function validateFileUpload(
  db: Database,
  suppliedActor: Account,
  metadata: FileUploadMetadata,
  bytes: Buffer,
): Omit<FileRecord, 'id' | 'createdAt'> {
  const actor = authenticated(db, suppliedActor)
  if (!metadata || typeof metadata !== 'object')
    fail(400, 'invalid_payload', 'File metadata is required.')
  const p = metadata as unknown as Payload
  const purpose = enumValue(p, 'purpose', ['material', 'submission'])
  role(actor, purpose === 'material' ? ['admin', 'teacher'] : ['student'])
  const classId = str(p, 'classId', 150)
  classroom(db, actor, classId, purpose === 'material')
  const name = str(p, 'name', 200)
  if (
    [...name].some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        character === '/' ||
        character === '\\',
    ) ||
    name === '.' ||
    name === '..'
  )
    fail(400, 'invalid_filename', 'Use a filename without paths or control characters.')
  const mime = str(p, 'mime', 100).toLowerCase().split(';')[0]!.trim()
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 8 * 1024 * 1024)
    fail(400, 'invalid_file', 'Files must contain data and be no larger than 8 MB.')
  if (!allowedFile(mime, bytes))
    fail(400, 'unsupported_file', 'Upload a valid PDF, PNG, JPEG, MP3, WAV, WebM or OGG file.')
  return {
    classId,
    ownerId: actor.id,
    purpose,
    name,
    mime,
    size: bytes.length,
  }
}

export function persistFileRecord(db: Database, actor: Account, record: FileRecord): void {
  put(db, 'file', record)
  put<AuditEntry>(db, 'audit', {
    id: id(),
    actorId: actor.id,
    action: 'file.upload',
    targetId: record.id,
    createdAt: now(),
  })
}

export function uploadFile(
  db: Database,
  suppliedActor: Account,
  metadata: FileUploadMetadata,
  bytes: Buffer,
): FileRecord {
  return transaction(db, () => {
    const actor = authenticated(db, suppliedActor)
    const record: FileRecord = {
      ...validateFileUpload(db, actor, metadata, bytes),
      id: id(),
      createdAt: now(),
    }
    db.prepare('INSERT INTO file_blobs(id,bytes) VALUES(?,?)').run(record.id, bytes)
    persistFileRecord(db, actor, record)
    return record
  })
}

export function authorizedFileRecord(
  db: Database,
  suppliedActor: Account,
  key: string,
): FileRecord {
  const actor = authenticated(db, suppliedActor)
  const record = requireRecord<FileRecord>(db, 'file', key)
  if (!canReadFile(db, actor, record)) fail(404, 'not_found', 'The file is unavailable.')
  return record
}

export function getFile(
  db: Database,
  suppliedActor: Account,
  key: string,
): { record: FileRecord; bytes: Buffer } {
  const record = authorizedFileRecord(db, suppliedActor, key)
  const blob = db.prepare('SELECT bytes FROM file_blobs WHERE id = ?').get(key)
  if (!blob) fail(404, 'not_found', 'The file is unavailable.')
  return { record, bytes: Buffer.from(blob!.bytes as Uint8Array) }
}
