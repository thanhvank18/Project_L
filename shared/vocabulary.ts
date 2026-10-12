import type { VocabularyPractice, VocabularyRating } from './portal.ts'

const day = 24 * 60 * 60 * 1000
const intervalDays = [1, 1, 3, 7, 14, 30] as const

export function initialVocabularyPractice(): VocabularyPractice {
  return { box: 0, reviewCount: 0, dueAt: null, lastReviewedAt: null, lastRating: null }
}

/** Fixed self-rating intervals, shared with previews; the server chooses the actual review time. */
export function nextVocabularyReview(
  practice: VocabularyPractice,
  rating: VocabularyRating,
  nowISO: string,
): VocabularyPractice {
  const timestamp = Date.parse(nowISO)
  if (!Number.isFinite(timestamp)) throw new RangeError('Review time must be a valid date.')
  if (!['again', 'hard', 'good', 'easy'].includes(rating))
    throw new RangeError('Review rating is not supported.')
  const currentBox = Math.min(5, Math.max(0, Math.trunc(practice.box)))
  const box =
    rating === 'again'
      ? 0
      : rating === 'hard'
        ? Math.max(0, currentBox - 1)
        : Math.min(5, currentBox + (rating === 'easy' ? 2 : 1))
  const interval =
    rating === 'again' ? 10 * 60 * 1000 : rating === 'hard' ? day : intervalDays[box]! * day
  return {
    box,
    reviewCount: practice.reviewCount + 1,
    dueAt: new Date(timestamp + interval).toISOString(),
    lastReviewedAt: new Date(timestamp).toISOString(),
    lastRating: rating,
  }
}
