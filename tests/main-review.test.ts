import assert from 'node:assert/strict'
import test from 'node:test'
import type { Lesson, MainReviewPreparation } from '../shared/portal.ts'
import {
  consultationReview,
  mainLessonSequence,
  mainReviewAllowsJoin,
  reviewConfirmationSnapshot,
} from '../src/features/live/main-review.ts'

function lesson(id: string, date: string, changes: Partial<Lesson> = {}): Lesson {
  return {
    id,
    classId: 'room',
    title: id,
    startsAt: `${date}T09:00:00Z`,
    endsAt: `${date}T10:00:00Z`,
    kind: 'class',
    hostId: 'teacher',
    capacity: 1,
    reservedCount: 0,
    cancelled: false,
    meetingSource: 'none',
    hasMeeting: false,
    version: 1,
    ...changes,
  }
}
test('review UI orders active main lessons consistently and skips cancelled, consultation and foreign records', () => {
  const first = lesson('first', '2030-01-01')
  const next = lesson('next', '2030-01-03')
  const records = [
    next,
    lesson('cancelled', '2029-12-01', { cancelled: true }),
    first,
    lesson('consultation', '2030-01-02', { kind: 'consultation' }),
    lesson('foreign', '2029-11-01', { classId: 'other' }),
  ]
  assert.deepEqual(
    mainLessonSequence(records, 'room').map((item) => item.id),
    ['first', 'next'],
  )
  const review = { ...lesson('review', '2030-01-02'), reviewForLessonId: next.id }
  assert.equal(consultationReview(records, review).previous?.id, first.id)
  assert.equal(consultationReview(records, review).valid, true)
  assert.equal(consultationReview(records, { ...review, reviewForLessonId: first.id }).valid, false)
  assert.equal(
    consultationReview(records, { ...review, reviewForLessonId: 'foreign' }).valid,
    false,
  )
  assert.equal(consultationReview(records, { ...review, startsAt: first.startsAt }).valid, false)
  assert.equal(consultationReview(records, { ...review, endsAt: next.endsAt }).valid, false)
  assert.equal(consultationReview(records, { ...review, startsAt: '' }).valid, false)
})

test('main Zoom entry fails closed without current server preparation and for every incomplete review status', () => {
  assert.equal(mainReviewAllowsJoin(undefined), false)
  for (const status of [
    'exempt',
    'required',
    'booked',
    'awaiting_confirmation',
    'completed',
    'no_show',
  ] as const) {
    const preparation: MainReviewPreparation = {
      lessonId: 'next',
      classId: 'room',
      studentId: 'student',
      status,
    }
    assert.equal(mainReviewAllowsJoin(preparation), status === 'exempt' || status === 'completed')
  }
})

test('confirmation snapshots detect renamed targets and inserted predecessors without mutating the open-editor baseline', () => {
  const first = lesson('first', '2030-01-01')
  const next = lesson('next', '2030-01-04')
  const review = lesson('review', '2030-01-03', {
    kind: 'consultation',
    reviewForLessonId: next.id,
  })
  const initial = reviewConfirmationSnapshot([first, next, review], review)
  const afterTargetEdit = reviewConfirmationSnapshot(
    [first, { ...next, version: 2 }, review],
    review,
  )
  assert.equal(initial.expectedReviewForLessonVersion, 1)
  assert.equal(afterTargetEdit.expectedReviewForLessonVersion, 2)
  const inserted = lesson('inserted', '2030-01-02')
  const afterInsertion = reviewConfirmationSnapshot([first, inserted, next, review], review)
  assert.equal(initial.expectedReviewedLessonId, first.id)
  assert.equal(afterInsertion.expectedReviewedLessonId, inserted.id)
  assert.equal(reviewConfirmationSnapshot([first, next], undefined).expectedReviewedLessonId, '')
})
