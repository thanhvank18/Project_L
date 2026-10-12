import type { ReadingDefinition, ReadingQuestion, ReadingResponse, Text } from '../shared/portal.ts'
import { readingLimits, readingWordCount } from '../shared/reading.ts'
import { enumValue, fail, integer, str, type Payload } from './domain-store.ts'

function object(value: unknown): Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(400, 'invalid_reading', 'Question content and responses must be objects.')
  return value as Payload
}

function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > maximum)
    fail(400, 'invalid_reading', 'Question lists must contain entries within the supported limit.')
  return value as unknown[]
}

function identifier(p: Payload, ids: Set<string>): string {
  const id = str(p, 'id', readingLimits.idLength)
  if (
    !/^[A-Za-z0-9_-]+$/.test(id) ||
    ['__proto__', 'constructor', 'prototype'].includes(id) ||
    ids.has(id)
  )
    fail(400, 'invalid_reading', 'Question identifiers must be safe and unique within their scope.')
  ids.add(id)
  return id
}

function text(p: Payload, key: string, maximum: number, empty = false): Text {
  const value = object(p[key])
  return { vi: str(value, 'vi', maximum, empty), en: str(value, 'en', maximum, empty) }
}

/** Canonical projection deliberately stores no answer keys or automatic grading settings. */
export function readingDefinition(value: unknown): ReadingDefinition {
  const p = object(value)
  const groupIds = new Set<string>()
  const questionIds = new Set<string>()
  let slots = 0
  const result: ReadingDefinition = {
    startNumber: integer(p, 'startNumber', 1, readingLimits.startNumber),
    groups: list(p.groups, readingLimits.groups).map((entry) => {
      const group = object(entry)
      return {
        id: identifier(group, groupIds),
        title: text(group, 'title', readingLimits.groupTitle),
        instructions: text(group, 'instructions', readingLimits.groupInstructions, true),
        questions: list(group.questions, readingLimits.slots).map((entry): ReadingQuestion => {
          const question = object(entry)
          const id = identifier(question, questionIds)
          const prompt = text(question, 'prompt', readingLimits.prompt)
          const kind = enumValue(question, 'kind', ['single', 'multiple', 'short'] as const)
          if (kind === 'short') {
            slots++
            return {
              id,
              prompt,
              kind,
              maxWords: integer(question, 'maxWords', 1, readingLimits.maxWords),
            }
          }
          const optionIds = new Set<string>()
          const options = list(question.options, readingLimits.options).map((entry) => {
            const option = object(entry)
            return {
              id: identifier(option, optionIds),
              label: text(option, 'label', readingLimits.optionLabel),
            }
          })
          if (options.length < 2)
            fail(400, 'invalid_reading', 'Choice questions need at least two options.')
          if (kind === 'single') {
            slots++
            return { id, prompt, kind, options }
          }
          const selectCount = integer(question, 'selectCount', 1, options.length)
          slots += selectCount
          return { id, prompt, kind, options, selectCount }
        }),
      }
    }),
  }
  if (
    slots > readingLimits.slots ||
    Buffer.byteLength(JSON.stringify(result), 'utf8') > readingLimits.definitionBytes
  )
    fail(400, 'invalid_reading', 'Question content exceeds its answer-slot or size limit.')
  return result
}

/** Empty values are omitted; drafts may be partial, while a submission must be complete. */
export function readingResponse(
  value: unknown,
  definition: ReadingDefinition,
  complete = false,
): ReadingResponse {
  const p = object(value)
  const questions = definition.groups.flatMap((group) => group.questions)
  const known = new Set(questions.map((question) => question.id))
  if (Object.keys(p).some((id) => !known.has(id)))
    fail(400, 'invalid_reading_answers', 'A response refers to an unknown question.')
  const result: ReadingResponse = {}
  for (const question of questions) {
    const answer = Object.hasOwn(p, question.id) ? p[question.id] : undefined
    if (question.kind === 'multiple') {
      if (answer === undefined) continue
      if (
        !Array.isArray(answer) ||
        answer.length > question.selectCount ||
        answer.some(
          (id) => typeof id !== 'string' || !question.options.some((option) => option.id === id),
        ) ||
        new Set(answer).size !== answer.length
      )
        fail(
          400,
          'invalid_reading_answers',
          'Multiple-choice responses must contain distinct valid options within the selection limit.',
        )
      const selected = answer as string[]
      if (selected.length) result[question.id] = [...selected]
    } else {
      if (answer === undefined) continue
      if (typeof answer !== 'string' || answer.length > readingLimits.response)
        fail(400, 'invalid_reading_answers', 'A single answer must be a bounded string.')
      const normalized = (answer as string).trim()
      if (
        question.kind === 'single' &&
        normalized &&
        !question.options.some((option) => option.id === normalized)
      )
        fail(400, 'invalid_reading_answers', 'Select a valid option for this question.')
      if (question.kind === 'short' && readingWordCount(normalized) > question.maxWords)
        fail(400, 'invalid_reading_answers', 'A short answer exceeds its word limit.')
      if (normalized) result[question.id] = normalized
    }
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > readingLimits.responseBytes)
    fail(400, 'invalid_reading_answers', 'Question responses exceed the size limit.')
  if (
    complete &&
    questions.some((question) => {
      const answer = result[question.id]
      return question.kind === 'multiple'
        ? !Array.isArray(answer) || answer.length !== question.selectCount
        : typeof answer !== 'string' || !answer.trim()
    })
  )
    fail(400, 'incomplete_reading', 'Answer every question before submitting.')
  return result
}
