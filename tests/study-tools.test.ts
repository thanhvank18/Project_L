import assert from 'node:assert/strict'
import test from 'node:test'
import { promptSegments, removeMapBranch, layoutMap } from '../src/features/live/study-helpers.ts'
import { createMutationQueue } from '../src/features/live/mutation-queue.ts'
import { parseDictionary } from '../src/features/live/dictionary.ts'

test('prompt highlights preserve text and merge overlapping ranges without moving annotations between locales', () => {
  const marks = [
    { id: 'a', locale: 'en' as const, start: 0, end: 5, quote: 'Hello', note: '' },
    { id: 'b', locale: 'en' as const, start: 3, end: 11, quote: 'lo world', note: '' },
  ]
  const parts = promptSegments('Hello world!', marks, 'en')
  assert.equal(parts.map((part) => part.text).join(''), 'Hello world!')
  assert.equal(
    parts
      .filter((part) => part.highlighted)
      .map((part) => part.text)
      .join(''),
    'Hello world',
  )
  assert.equal(
    promptSegments('Hello world!', marks, 'vi').some((part) => part.highlighted),
    false,
  )
  assert.equal(
    promptSegments('Different passage', marks, 'en').some((part) => part.highlighted),
    false,
  )
})
test('deleting a map branch removes descendants and preserves sibling ideas and drawing-independent layout', () => {
  const nodes = [
    { id: 'root', parentId: null, text: 'Root' },
    { id: 'a', parentId: 'root', text: 'A' },
    { id: 'b', parentId: 'root', text: 'B' },
    { id: 'aa', parentId: 'a', text: 'AA' },
  ]
  assert.deepEqual(
    removeMapBranch(nodes, 'a').map((node) => node.id),
    ['root', 'b'],
  )
  assert.equal(removeMapBranch(nodes, 'root').length, 0)
  const layout = layoutMap(nodes)
  assert.equal(layout.positions.size, 4)
  assert.ok(layout.positions.get('aa')!.x > layout.positions.get('a')!.x)
  assert.notEqual(layout.positions.get('a')!.y, layout.positions.get('b')!.y)
})
test('mutation queue serializes independent saves and recovers after a rejected request', async () => {
  const enqueue = createMutationQueue()
  const order: string[] = []
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  const first = enqueue(async () => {
    order.push('first-start')
    await wait
    order.push('first-end')
    throw new Error('network')
  })
  const second = enqueue(async () => {
    order.push('second')
    return 2
  })
  await Promise.resolve()
  assert.deepEqual(order, ['first-start'])
  release()
  await assert.rejects(first, /network/)
  assert.equal(await second, 2)
  assert.deepEqual(order, ['first-start', 'first-end', 'second'])
})
test('dictionary parsing bounds meanings and preserves provenance without allowing script links', () => {
  const result = parseDictionary(
    [
      {
        phonetic: '/word/',
        sourceUrls: ['javascript:alert(1)', 'https://en.wiktionary.org/wiki/word'],
        license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: Array.from({ length: 20 }, (_, index) => ({
              definition: `A unit of language, sense ${index + 1}.`,
              example: 'Choose a word.',
            })),
          },
        ],
      },
    ],
    'word',
  )
  assert.equal(result.meanings.length, 6)
  assert.deepEqual(result.sources, ['https://en.wiktionary.org/wiki/word'])
  assert.equal(result.licenses[0]?.name, 'CC BY-SA 3.0')
  assert.throws(
    () => parseDictionary({ title: 'No Definitions Found' }, 'unknown'),
    /dictionary-empty/,
  )
})
