import assert from 'node:assert/strict'
import test from 'node:test'
import { lookupDictionary, parseDictionary } from '../src/features/live/dictionary.ts'

const definitions = [
  {
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [{ definition: 'A useful piece of advice.', example: 'I saved a study tip.' }],
      },
    ],
  },
]

test('dictionary ignores empty senses and repeated definitions while retaining different parts of speech', () => {
  const result = parseDictionary(
    [
      {
        meanings: [
          {
            partOfSpeech: ' noun ',
            definitions: [
              { definition: '  ' },
              { definition: ' A study plan. ', example: '  My own plan.  ' },
              { definition: 'A study plan.' },
            ],
          },
          { partOfSpeech: 'verb', definitions: [{ definition: 'A study plan.' }] },
        ],
      },
    ],
    'plan',
  )
  assert.deepEqual(result.meanings, [
    { part: 'noun', definition: 'A study plan.', example: 'My own plan.' },
    { part: 'verb', definition: 'A study plan.', example: '' },
  ])
  assert.throws(
    () => parseDictionary([{ meanings: [{ definitions: [{ definition: ' ' }] }] }], 'empty'),
    /dictionary-empty/,
  )
})

test('dictionary lookup sends only the explicit trimmed query without credentials or a referrer', async (context) => {
  const controller = new AbortController()
  const fetchMock = context.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      assert.equal(input, 'https://api.dictionaryapi.dev/api/v2/entries/en/study%20tip')
      assert.deepEqual(init, {
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      })
      return Response.json(definitions)
    },
  )
  const result = await lookupDictionary('  study tip  ', controller.signal)
  assert.equal(result.word, 'study tip')
  assert.equal(result.meanings[0]?.definition, 'A useful piece of advice.')
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('invalid and pre-cancelled dictionary queries never reach the provider', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => Response.json(definitions))
  await assert.rejects(
    lookupDictionary('a'.repeat(81), new AbortController().signal),
    /dictionary-query/,
  )
  await assert.rejects(
    lookupDictionary('https://example.com', new AbortController().signal),
    /dictionary-query/,
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(lookupDictionary('tip', controller.signal), { name: 'AbortError' })
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('dictionary distinguishes missing words from an unavailable service', async (context) => {
  const fetchMock = context.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 404 }),
  )
  await assert.rejects(
    lookupDictionary('missing', new AbortController().signal),
    /dictionary-empty/,
  )
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 503 }))
  await assert.rejects(lookupDictionary('tip', new AbortController().signal), /dictionary-service/)
})

test('dictionary stops reading oversized provider responses', async (context) => {
  let cancelled = false
  context.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(256 * 1024 + 1))
          },
          cancel() {
            cancelled = true
          },
        }),
      ),
  )
  await assert.rejects(lookupDictionary('tip', new AbortController().signal), /dictionary-service/)
  assert.equal(cancelled, true)
})

test('a lookup cancelled while its response arrives cannot return a stale definition', async (context) => {
  const controller = new AbortController()
  context.mock.method(globalThis, 'fetch', async () => {
    controller.abort()
    return Response.json(definitions)
  })
  await assert.rejects(lookupDictionary('tip', controller.signal), { name: 'AbortError' })
})
