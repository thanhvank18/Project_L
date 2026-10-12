import type { Assignment, LiveState, Skill, Submission, Word } from '../../../shared/portal.ts'

const skills: Skill[] = ['reading', 'writing', 'listening', 'speaking']
const soonWindow = 48 * 60 * 60 * 1000
const timestamp = (value: string) => Date.parse(value)
const deadline = (assignment: Assignment) => {
  const value = timestamp(assignment.dueAt)
  return Number.isFinite(value) ? value : Infinity
}
const pairKey = (studentId: string, assignmentId: string) => `${studentId}\0${assignmentId}`

export function latestSubmissions(submissions: Submission[]): Submission[] {
  const latest = new Map<string, Submission>()
  for (const submission of submissions) {
    const key = pairKey(submission.studentId, submission.assignmentId)
    const previous = latest.get(key)
    if (!previous || submission.revision > previous.revision) latest.set(key, submission)
  }
  return [...latest.values()]
}

export function vocabularyDueCount(words: Word[], now: number): number {
  return words.filter((word: Word & { practice?: { dueAt: string | null } }) => {
    const dueAt = word.practice?.dueAt
    return !dueAt || timestamp(dueAt) <= now
  }).length
}

export function learningInsights(state: LiveState, classId = '', now = timestamp(state.fetchedAt)) {
  const student = state.user.role === 'student'
  const assistant = state.user.role === 'assistant'
  const classes = state.classes.filter(
    (room) =>
      room.active &&
      (!classId || room.id === classId) &&
      (!student || room.studentIds.includes(state.user.id)),
  )
  const classIds = new Set(classes.map((room) => room.id))
  const assignments = state.assignments.filter(
    (task) => task.published && classIds.has(task.classId),
  )
  const tasks = new Map(assignments.map((task) => [task.id, task]))
  const currentSubmissions = state.submissions.filter((submission) => {
    const task = tasks.get(submission.assignmentId)
    const room = classes.find((item) => item.id === submission.classId)
    return (
      task?.classId === submission.classId &&
      task.version === submission.assignmentVersion &&
      room?.studentIds.includes(submission.studentId) &&
      (!student || submission.studentId === state.user.id)
    )
  })
  const latest = latestSubmissions(currentSubmissions)
  const submittedPairs = new Set(latest.map((item) => pairKey(item.studentId, item.assignmentId)))
  const pending = student
    ? assignments
        .filter((task) => !submittedPairs.has(pairKey(state.user.id, task.id)))
        .sort((a, b) => deadline(a) - deadline(b) || a.id.localeCompare(b.id))
        .map((assignment) => ({
          assignment,
          urgency:
            deadline(assignment) < now
              ? ('overdue' as const)
              : deadline(assignment) <= now + soonWindow
                ? ('soon' as const)
                : ('later' as const),
          hasDraft: state.drafts.some(
            (draft) =>
              draft.studentId === state.user.id &&
              draft.assignmentId === assignment.id &&
              draft.assignmentVersion === assignment.version,
          ),
          changed: state.submissions.some(
            (item) => item.studentId === state.user.id && item.assignmentId === assignment.id,
          ),
        }))
    : []
  // Assistants receive redacted submissions: a null review never means "ungraded" for them.
  const pendingReviews = assistant
    ? []
    : latest
        .filter((item) => !item.review)
        .sort((a, b) => timestamp(a.submittedAt) - timestamp(b.submittedAt))
        .map(({ id, assignmentId, studentId, classId, title, revision, submittedAt }) => ({
          id,
          assignmentId,
          studentId,
          classId,
          title,
          revision,
          submittedAt,
        }))
  const progress = student
    ? skills.map((skill) => {
        const skillTasks = assignments.filter((task) => task.skill === skill)
        const reviewed = latestSubmissions(currentSubmissions.filter((item) => item.review)).filter(
          (item) => tasks.get(item.assignmentId)?.skill === skill,
        )
        return {
          skill,
          assigned: skillTasks.length,
          submitted: skillTasks.filter((task) =>
            submittedPairs.has(pairKey(state.user.id, task.id)),
          ).length,
          reviewed: reviewed.length,
          average: reviewed.length
            ? reviewed.reduce((sum, item) => sum + (item.review?.score ?? 0), 0) / reviewed.length
            : null,
        }
      })
    : []
  const followUpStudentIds = new Set<string>()
  const preparation = student
    ? []
    : classes.map((room) => {
        const required = assignments.filter((task) => task.classId === room.id && task.required)
        const students = state.users.filter(
          (user) => user.active && user.role === 'student' && room.studentIds.includes(user.id),
        )
        let ready = 0
        let missing = 0
        const followUps: {
          studentId: string
          tasks: Pick<Assignment, 'id' | 'title'>[]
          nextReview: { id: string; title: string; startsAt: string } | null
        }[] = []
        for (const learner of students) {
          const outstandingTasks = required.filter(
            (task) => !submittedPairs.has(pairKey(learner.id, task.id)),
          )
          const outstanding = outstandingTasks.length
          missing += outstanding
          if (outstanding) {
            followUpStudentIds.add(learner.id)
            const reservations = new Set(
              state.bookings
                .filter((item) => item.studentId === learner.id && item.status === 'booked')
                .map((item) => item.lessonId),
            )
            const nextReview = state.lessons
              .filter(
                (item) =>
                  item.classId === room.id &&
                  item.kind === 'consultation' &&
                  !item.cancelled &&
                  timestamp(item.endsAt) > now &&
                  reservations.has(item.id),
              )
              .sort((a, b) => timestamp(a.startsAt) - timestamp(b.startsAt))[0]
            followUps.push({
              studentId: learner.id,
              tasks: outstandingTasks.map(({ id, title }) => ({ id, title })),
              nextReview: nextReview
                ? { id: nextReview.id, title: nextReview.title, startsAt: nextReview.startsAt }
                : null,
            })
          } else ready++
        }
        return {
          classId: room.id,
          title: room.title,
          required: required.length,
          students: students.length,
          ready,
          missing,
          followUps,
        }
      })
  const bookedIds = new Set(
    state.bookings
      .filter((booking) => booking.studentId === state.user.id && booking.status === 'booked')
      .map((booking) => booking.lessonId),
  )
  const upcoming = state.lessons
    .filter(
      (lesson) =>
        classIds.has(lesson.classId) &&
        !lesson.cancelled &&
        timestamp(lesson.endsAt) > now &&
        (!student || lesson.kind === 'class' || bookedIds.has(lesson.id)),
    )
    .sort((a, b) => timestamp(a.startsAt) - timestamp(b.startsAt))
  return {
    classes,
    assignments,
    pending,
    pendingReviews,
    progress,
    preparation,
    followUpStudents: followUpStudentIds.size,
    submitted: latest.length,
    upcoming,
    vocabularyDue: student ? vocabularyDueCount(state.words, now) : 0,
    enrollmentPending:
      state.user.role === 'admin'
        ? state.enrollmentRequests.filter(
            (request) => request.status === 'pending' && (!classId || request.classId === classId),
          ).length
        : 0,
  }
}
