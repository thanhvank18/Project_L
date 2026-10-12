import type { Lesson, MainReviewPreparation } from '../../../shared/portal.ts'

export function mainLessonSequence(lessons: Lesson[], classId: string): Lesson[] {
  return lessons
    .filter((lesson) => lesson.classId === classId && lesson.kind === 'class' && !lesson.cancelled)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
}

export function consultationReview(
  lessons: Lesson[],
  consultation: Pick<Lesson, 'classId' | 'reviewForLessonId' | 'startsAt' | 'endsAt'>,
) {
  const sequence = mainLessonSequence(lessons, consultation.classId)
  const index = sequence.findIndex((lesson) => lesson.id === consultation.reviewForLessonId)
  const target = sequence[index]
  const previous = sequence[index - 1]
  return {
    target,
    previous,
    valid: Boolean(
      target &&
      previous &&
      Date.parse(consultation.startsAt) >= Date.parse(previous.endsAt) &&
      Date.parse(consultation.endsAt) <= Date.parse(target.startsAt) &&
      Date.parse(consultation.endsAt) > Date.parse(consultation.startsAt),
    ),
  }
}

/** Client visibility is advisory; the server repeats the gate immediately before returning Zoom. */
export function mainReviewAllowsJoin(preparation: MainReviewPreparation | undefined): boolean {
  return preparation?.status === 'exempt' || preparation?.status === 'completed'
}

/** Capture these fields when opening the editor, then replace only after explicit conflict review. */
export function reviewConfirmationSnapshot(lessons: Lesson[], consultation: Lesson | undefined) {
  const review = consultation?.reviewForLessonId
    ? consultationReview(lessons, consultation)
    : undefined
  return {
    expectedReviewForLessonId: review?.target?.id ?? '',
    expectedReviewForLessonVersion: review?.target?.version ?? 0,
    expectedReviewedLessonId: review?.previous?.id ?? '',
    expectedReviewedLessonVersion: review?.previous?.version ?? 0,
  }
}
