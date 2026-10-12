import {
  readingLimits,
  readingWordCount,
  type ReadingDefinition,
  type ReadingGroup,
  type ReadingQuestion,
  type ReadingResponse,
} from '../../../shared/reading.ts'

export interface NumberedReadingQuestion {
  question: ReadingQuestion
  group: ReadingGroup
  number: number
  endNumber: number
}

export function enumerateReadingQuestions(
  definition: ReadingDefinition | null | undefined,
): NumberedReadingQuestion[] {
  if (!definition) return []
  let number = definition.startNumber
  return definition.groups.flatMap((group) =>
    group.questions.map((question) => {
      const endNumber = number + (question.kind === 'multiple' ? question.selectCount : 1) - 1
      const item = { question, group, number, endNumber }
      number = endNumber + 1
      return item
    }),
  )
}

/** Drafts can be incomplete, but retain only correctly shaped values without trimming them. */
function isCompatibleDraftAnswer(
  question: ReadingQuestion,
  answer: ReadingResponse[string] | undefined,
): answer is ReadingResponse[string] {
  if (question.kind === 'multiple')
    return (
      Number.isInteger(question.selectCount) &&
      question.selectCount > 0 &&
      question.selectCount <= question.options.length &&
      Array.isArray(answer) &&
      answer.length <= question.selectCount &&
      new Set(answer).size === answer.length &&
      answer.every((id) => question.options.some((option) => option.id === id))
    )
  if (typeof answer !== 'string' || answer.length > readingLimits.response) return false
  if (question.kind === 'single')
    return answer === '' || question.options.some((option) => option.id === answer)
  return readingWordCount(answer) <= question.maxWords
}

export function isReadingAnswerComplete(
  question: ReadingQuestion,
  answer: ReadingResponse[string] | undefined,
): boolean {
  if (!isCompatibleDraftAnswer(question, answer)) return false
  return question.kind === 'multiple'
    ? Array.isArray(answer) && answer.length === question.selectCount
    : typeof answer === 'string' && Boolean(answer.trim())
}

export function readingProgress(
  definition: ReadingDefinition | null | undefined,
  answers: ReadingResponse,
) {
  const questions = enumerateReadingQuestions(definition)
  let completedQuestions = 0
  let answeredSlots = 0
  let totalSlots = 0
  for (const { question, number, endNumber } of questions) {
    const slots = endNumber - number + 1
    totalSlots += slots
    if (isReadingAnswerComplete(question, answers[question.id])) {
      completedQuestions += 1
      answeredSlots += slots
    }
  }
  return { completedQuestions, totalQuestions: questions.length, answeredSlots, totalSlots }
}

export function isReadingComplete(
  definition: ReadingDefinition | null | undefined,
  answers: ReadingResponse,
): boolean {
  const questions = enumerateReadingQuestions(definition)
  const ids = new Set(questions.map(({ question }) => question.id))
  return (
    questions.length > 0 &&
    Object.keys(answers).every((id) => ids.has(id)) &&
    questions.every(({ question }) => isReadingAnswerComplete(question, answers[question.id]))
  )
}

/** Continue after the focused question, wrapping once without skipping the only match. */
export function nextReadingQuestion(
  definition: ReadingDefinition,
  answers: ReadingResponse,
  flagged: readonly string[],
  activeId: string,
  filter: 'incomplete' | 'flagged',
): string | undefined {
  const entries = enumerateReadingQuestions(definition)
  const start = entries.findIndex(({ question }) => question.id === activeId)
  for (let offset = 1; offset <= entries.length; offset++) {
    const entry = entries[(start + offset) % entries.length]
    if (!entry) continue
    const { question } = entry
    if (
      filter === 'flagged'
        ? flagged.includes(question.id)
        : !isReadingAnswerComplete(question, answers[question.id])
    )
      return question.id
  }
  return undefined
}

/** Elapsed duration, not wall-clock time: hours deliberately continue beyond 24. */
export function formatElapsed(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

const sameText = (before: { vi: string; en: string }, after: { vi: string; en: string }) =>
  before.vi === after.vi && before.en === after.en

function sameQuestion(before: ReadingQuestion, after: ReadingQuestion): boolean {
  if (before.kind !== after.kind || !sameText(before.prompt, after.prompt)) return false
  if (before.kind === 'short' && after.kind === 'short') return before.maxWords === after.maxWords
  if (before.kind === 'short' || after.kind === 'short') return false
  if (
    before.kind === 'multiple' &&
    after.kind === 'multiple' &&
    before.selectCount !== after.selectCount
  )
    return false
  return (
    before.options.length === after.options.length &&
    before.options.every((option) => {
      const next = after.options.find((candidate) => candidate.id === option.id)
      return Boolean(next && sameText(option.label, next.label))
    })
  )
}

/**
 * Call only after the user explicitly accepts the new assignment version. Keep the
 * original editor state separately so discarded/incompatible input stays recoverable.
 * Passage text lives outside ReadingDefinition; the caller must disclose its change.
 * No answer is truncated, coerced or moved to a different question ID.
 */
export function reconcileReadingAnswers(
  previous: ReadingDefinition | null | undefined,
  next: ReadingDefinition | null | undefined,
  answers: ReadingResponse,
): ReadingResponse {
  const earlier = new Map(
    enumerateReadingQuestions(previous).map((item) => [item.question.id, item]),
  )
  return Object.fromEntries(
    enumerateReadingQuestions(next).flatMap(({ question, group }) => {
      const old = earlier.get(question.id)
      const answer = answers[question.id]
      if (
        !Object.hasOwn(answers, question.id) ||
        !old ||
        !sameText(old.group.instructions, group.instructions) ||
        !sameQuestion(old.question, question) ||
        !isCompatibleDraftAnswer(question, answer)
      )
        return []
      return [[question.id, Array.isArray(answer) ? [...answer] : answer]]
    }),
  )
}
