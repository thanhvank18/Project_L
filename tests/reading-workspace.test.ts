import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReadingDefinition, ReadingQuestion, ReadingResponse } from '../shared/reading.ts'
import {
  enumerateReadingQuestions,
  formatElapsed,
  isReadingAnswerComplete,
  isReadingComplete,
  readingProgress,
  nextReadingQuestion,
  reconcileReadingAnswers,
} from '../src/features/live/reading-helpers.ts'

const text = (value: string) => ({ vi: value, en: value })
function definition(): ReadingDefinition {
  return {
    startNumber: 14,
    groups: [
      {
        id: 'matching',
        title: text('Matching'),
        instructions: text('Choose the matching paragraph.'),
        questions: [
          {
            id: 'location',
            kind: 'single',
            prompt: text('The location of the discovery'),
            options: ['A', 'B', 'C'].map((id) => ({ id, label: text(`Paragraph ${id}`) })),
          },
          {
            id: 'research',
            kind: 'multiple',
            prompt: text('Choose TWO findings.'),
            selectCount: 2,
            options: ['found', 'tested', 'rejected'].map((id) => ({ id, label: text(id) })),
          },
        ],
      },
      {
        id: 'summary',
        title: text('Summary'),
        instructions: text('Write ONE WORD for each gap.'),
        questions: [
          {
            id: 'material',
            kind: 'short',
            prompt: text('The sample was made from ____.'),
            maxWords: 1,
          },
          { id: 'object', kind: 'short', prompt: text('It resembled a ____.'), maxWords: 1 },
        ],
      },
    ],
  }
}
const complete = (): ReadingResponse => ({
  location: 'A',
  research: ['found', 'tested'],
  material: 'stone',
  object: 'shell',
})
const question = (id: string, source = definition()): ReadingQuestion =>
  enumerateReadingQuestions(source).find((item) => item.question.id === id)!.question

test('review navigation wraps, ignores stale flags and finds incomplete multi-choice and word-limited answers', () => {
  const source = definition()
  const answers = { ...complete(), research: ['found'], material: 'two words' }
  assert.equal(nextReadingQuestion(source, answers, [], '', 'incomplete'), 'research')
  assert.equal(nextReadingQuestion(source, answers, [], 'research', 'incomplete'), 'material')
  assert.equal(nextReadingQuestion(source, answers, [], 'object', 'incomplete'), 'research')
  assert.equal(nextReadingQuestion(source, complete(), [], '', 'incomplete'), undefined)
  assert.equal(
    nextReadingQuestion(source, answers, ['deleted', 'material'], 'material', 'flagged'),
    'material',
  )
  assert.equal(nextReadingQuestion(source, answers, ['deleted'], '', 'flagged'), undefined)
  assert.equal(
    nextReadingQuestion({ startNumber: 1, groups: [] }, {}, [], '', 'incomplete'),
    undefined,
  )
})

test('question navigation numbers stay continuous across groups and a choose-TWO item consumes two slots', () => {
  const source = definition()
  const before = structuredClone(source)
  const numbered = enumerateReadingQuestions(source)
  assert.deepEqual(
    numbered.map(({ question, group, number, endNumber }) => ({
      id: question.id,
      group: group.id,
      number,
      endNumber,
    })),
    [
      { id: 'location', group: 'matching', number: 14, endNumber: 14 },
      { id: 'research', group: 'matching', number: 15, endNumber: 16 },
      { id: 'material', group: 'summary', number: 17, endNumber: 17 },
      { id: 'object', group: 'summary', number: 18, endNumber: 18 },
    ],
  )
  assert.deepEqual(source, before)
  assert.deepEqual(enumerateReadingQuestions(undefined), [])
})

test('progress awards numbered slots only to complete valid questions, without implying answer correctness', () => {
  const source = definition()
  assert.deepEqual(readingProgress(source, {}), {
    completedQuestions: 0,
    totalQuestions: 4,
    answeredSlots: 0,
    totalSlots: 5,
  })
  assert.deepEqual(
    readingProgress(source, { location: 'C', research: ['found'], material: 'two words' }),
    { completedQuestions: 1, totalQuestions: 4, answeredSlots: 1, totalSlots: 5 },
  )
  assert.deepEqual(
    readingProgress(source, { location: 'C', research: ['found', 'tested'], material: 'stone' }),
    { completedQuestions: 3, totalQuestions: 4, answeredSlots: 4, totalSlots: 5 },
  )
  assert.deepEqual(readingProgress(source, complete()), {
    completedQuestions: 4,
    totalQuestions: 4,
    answeredSlots: 5,
    totalSlots: 5,
  })
  assert.equal(isReadingComplete(source, complete()), true)
  assert.equal(isReadingComplete(source, { ...complete(), location: 'C' }), true)
  assert.equal(isReadingComplete(source, { ...complete(), ghost: 'invented' }), false)
  assert.equal(isReadingComplete(undefined, {}), false)
  assert.equal(isReadingComplete({ startNumber: 1, groups: [] }, {}), false)
})

test('choice completion rejects unknown options, duplicated picks, wrong shapes and incomplete or excessive picks', () => {
  const single = question('location')
  for (const answer of [undefined, '', 'D', ' A ', ['A']])
    assert.equal(isReadingAnswerComplete(single, answer), false)
  assert.equal(isReadingAnswerComplete(single, 'B'), true)
  const multiple = question('research')
  for (const answer of [
    undefined,
    '',
    'found',
    [],
    ['found'],
    ['found', 'found'],
    ['found', 'ghost'],
    ['found', 'tested', 'rejected'],
  ])
    assert.equal(isReadingAnswerComplete(multiple, answer), false)
  assert.equal(isReadingAnswerComplete(multiple, ['tested', 'found']), true)
  if (multiple.kind !== 'multiple') throw new Error('Invalid fixture')
  assert.equal(isReadingAnswerComplete({ ...multiple, selectCount: 0 }, []), false)
  assert.equal(isReadingAnswerComplete({ ...multiple, selectCount: 1.5 }, ['found']), false)
})

test('short-answer limits share whitespace word counting with the server and preserve answer spelling', () => {
  const short = question('material')
  for (const answer of [
    undefined,
    '',
    ' \t\n',
    'two words',
    'first\nsecond',
    ['stone'],
    'x'.repeat(2001),
  ])
    assert.equal(isReadingAnswerComplete(short, answer), false)
  for (const answer of ['stone', '  Stone\n', 'well-known', "don't", '2026'])
    assert.equal(isReadingAnswerComplete(short, answer), true)
  const typed = { material: '  Stone\n' }
  assert.deepEqual(reconcileReadingAnswers(definition(), definition(), typed), typed)
})

test('explicit version rebase keeps stable question IDs through renumbering, group and option reordering', () => {
  const old = definition()
  const next = structuredClone(old)
  next.startNumber = 1
  next.groups.reverse()
  const reordered = question('research', next)
  if (reordered.kind !== 'multiple') throw new Error('Invalid fixture')
  reordered.options.reverse()
  const answers = complete()
  const originalAnswers = structuredClone(answers)
  const result = reconcileReadingAnswers(old, next, answers)
  assert.deepEqual(result, answers)
  assert.deepEqual(answers, originalAnswers)
  assert.notEqual(result, answers)
  assert.notEqual(result.research, answers.research)
  ;(result.research as string[]).push('local-change')
  assert.deepEqual(answers, originalAnswers)
})

test('version rebase retains incomplete compatible drafts, but never truncates an excessive multiple answer', () => {
  const source = definition()
  const partial = { location: '', research: ['found'], material: ' ', object: 'shell' }
  assert.deepEqual(reconcileReadingAnswers(source, source, partial), partial)
  const excessive = { research: ['found', 'tested', 'rejected'] }
  assert.deepEqual(reconcileReadingAnswers(source, source, excessive), {})
  assert.deepEqual(excessive.research, ['found', 'tested', 'rejected'])
  assert.deepEqual(reconcileReadingAnswers(undefined, source, complete()), {})
  assert.deepEqual(reconcileReadingAnswers(source, undefined, complete()), {})
})

test('version rebase drops removed/new questions and incompatible prompts, options, counts or group instructions', () => {
  const original = definition()
  const checks: Array<(next: ReadingDefinition) => void> = [
    (next) => {
      question('research', next).prompt.en = 'A different question'
    },
    (next) => {
      const item = question('research', next)
      if (item.kind === 'multiple') item.options[0]!.label.en = 'Different option meaning'
    },
    (next) => {
      const item = question('research', next)
      if (item.kind === 'multiple') item.options.pop()
    },
    (next) => {
      const item = question('research', next)
      if (item.kind === 'multiple') item.selectCount = 1
    },
    (next) => {
      const group = next.groups[0]!
      group.questions[1] = {
        id: 'research',
        kind: 'short',
        prompt: text('Choose TWO findings.'),
        maxWords: 1,
      }
    },
    (next) => {
      next.groups[0]!.instructions.vi = 'Yêu cầu mới'
    },
    (next) => {
      next.groups[0]!.questions.pop()
    },
  ]
  for (const change of checks) {
    const next = structuredClone(original)
    change(next)
    assert.equal(
      Object.hasOwn(reconcileReadingAnswers(original, next, complete()), 'research'),
      false,
    )
  }
  const next = definition()
  const material = question('material', next)
  if (material.kind === 'short') material.maxWords = 2
  const answers: ReadingResponse = { ...complete(), unrelated: 'keep outside the rebase result' }
  const result = reconcileReadingAnswers(original, next, answers)
  assert.equal(Object.hasOwn(result, 'material'), false)
  assert.equal(Object.hasOwn(result, 'unrelated'), false)
  assert.equal(answers.material, 'stone')
})

test('elapsed duration floors subsecond ticks, is defensive for invalid values and never wraps at midnight', () => {
  for (const [seconds, expected] of [
    [0, '00:00:00'],
    [5.9, '00:00:05'],
    [59, '00:00:59'],
    [60, '00:01:00'],
    [3599, '00:59:59'],
    [3600, '01:00:00'],
    [86400, '24:00:00'],
    [360000, '100:00:00'],
    [-5, '00:00:00'],
    [NaN, '00:00:00'],
    [Infinity, '00:00:00'],
  ] as const)
    assert.equal(formatElapsed(seconds), expected)
})
