import assert from 'node:assert/strict'
import { test } from 'node:test'
import { submissionAnswer } from '../src/features/learning/submission.ts'

test('Reading submissions exclude private notes and require both answers', () => {
  const draft = JSON.stringify({
    answerOne: 'Small study sessions.',
    answerTwo: 'To discuss them.',
    notes: 'Private reminder.',
  })
  assert.deepEqual(JSON.parse(submissionAnswer('reading-01', draft)), {
    answerOne: 'Small study sessions.',
    answerTwo: 'To discuss them.',
  })
  assert.equal(submissionAnswer('reading-01', '{broken'), '')
  assert.equal(
    submissionAnswer(
      'reading-01',
      JSON.stringify({ answerOne: 'One', answerTwo: '  ', notes: 'Private' }),
    ),
    '',
  )
  assert.equal(submissionAnswer('reading-01', undefined), '')
})

test('Custom text responses are preserved verbatim', () => {
  const answer = 'My paragraph.\nA second line.'
  assert.equal(submissionAnswer('task-custom', answer), answer)
})
