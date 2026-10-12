import assert from 'node:assert/strict'
import test from 'node:test'
import type { Word } from '../shared/portal.ts'
import { initialVocabularyPractice } from '../shared/vocabulary.ts'
import { vocabularyQueue } from '../src/features/live/vocabulary-session.ts'

const now = '2026-10-10T12:00:00.000Z'
function word(id: string, dueAt: string | null, topic = 'Travel'): Word {
  return {
    id,
    word: id,
    meaning: 'meaning',
    example: '',
    topic,
    version: 1,
    practice: { ...initialVocabularyPractice(), dueAt },
  }
}
test('vocabulary queue scopes topic, includes new/overdue words and does not mutate notebook order', () => {
  const words = [
    word('future', '2026-10-11T12:00:00.000Z'),
    word('due', now),
    word('new', null),
    word('other', null, 'Work'),
    word('overdue', '2026-10-09T12:00:00.000Z'),
  ]
  assert.deepEqual(
    vocabularyQueue(words, now, 'Travel', 'due').map((item) => item.id),
    ['overdue', 'due', 'new'],
  )
  assert.equal(words[0]?.id, 'future')
  assert.equal(vocabularyQueue(words, now, '', 'all').length, 5)
})
test('vocabulary sessions are bounded and missing topics remain truly empty', () => {
  const words = Array.from({ length: 25 }, (_, i) => word(String(i), null))
  assert.equal(vocabularyQueue(words, now, '', 'due').length, 20)
  assert.equal(vocabularyQueue(words, now, 'Missing', 'due').length, 0)
  assert.equal(vocabularyQueue([], now, '', 'all').length, 0)
})
