import type { Word } from '../../../shared/portal.ts'

export function vocabularyQueue(
  words: readonly Word[],
  now: string,
  topic: string,
  mode: 'due' | 'all',
): Word[] {
  const timestamp = Date.parse(now)
  return words
    .filter((word) => !topic || word.topic === topic)
    .filter(
      (word) =>
        mode === 'all' || !word.practice.dueAt || Date.parse(word.practice.dueAt) <= timestamp,
    )
    .sort((a, b) => {
      const rank = (word: Word) =>
        !word.practice.dueAt ? 1 : Date.parse(word.practice.dueAt) <= timestamp ? 0 : 2
      const priority = rank(a) - rank(b)
      if (priority) return priority
      const first = a.practice.dueAt ? Date.parse(a.practice.dueAt) : 0
      const second = b.practice.dueAt ? Date.parse(b.practice.dueAt) : 0
      return first - second || a.word.localeCompare(b.word) || a.id.localeCompare(b.id)
    })
    .slice(0, 20)
}
