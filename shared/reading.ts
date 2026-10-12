import type { Text } from './portal.ts'

export interface ReadingOption {
  id: string
  label: Text
}

interface ReadingQuestionBase {
  id: string
  prompt: Text
}

export type ReadingQuestion = ReadingQuestionBase &
  (
    | { kind: 'single'; options: ReadingOption[] }
    | { kind: 'multiple'; options: ReadingOption[]; selectCount: number }
    | { kind: 'short'; maxWords: number }
  )

export interface ReadingGroup {
  id: string
  title: Text
  instructions: Text
  questions: ReadingQuestion[]
}

export interface ReadingDefinition {
  startNumber: number
  groups: ReadingGroup[]
}

export type ReadingResponse = Record<string, string | string[]>

export const readingLimits = {
  startNumber: 1000,
  groups: 20,
  slots: 40,
  options: 26,
  maxWords: 20,
  idLength: 80,
  groupTitle: 300,
  groupInstructions: 3000,
  prompt: 3000,
  optionLabel: 500,
  response: 2000,
  definitionBytes: 200 * 1024,
  responseBytes: 80 * 1024,
} as const

/** A hyphenated word is one token; whitespace separates words. */
export function readingWordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0
}
