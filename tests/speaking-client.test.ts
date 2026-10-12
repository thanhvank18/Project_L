import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

// Resolve the application's alias without changing production imports or tsconfig.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/'))
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    if (specifier === '../../../shared/speaking')
      return nextResolve(new URL('../shared/speaking.ts', import.meta.url).href, context)
    return nextResolve(specifier, context)
  },
})
const clientPath = new URL('../src/features/live/speaking-client.ts', import.meta.url).href
const client = (await import(clientPath)) as {
  getSpeakingHistory: (id: string, signal?: AbortSignal) => Promise<unknown>
  fetchSpeakingAudio: (id: string, signal?: AbortSignal) => Promise<Blob>
  fetchSpeakingSource: (id: string, signal?: AbortSignal) => Promise<Blob>
  uploadSpeakingAudio: (blob: Blob, classId: string, signal?: AbortSignal) => Promise<unknown>
}
hooks.deregister()

test('Speaking client keeps private audio and asynchronous results within the initiating session', async (t) => {
  const originalFetch = globalThis.fetch
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  let token = 'a'.repeat(43)
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify({ version: 1, accessToken: token }) },
  })
  try {
    await t.test(
      'history uses same-origin bearer authentication and rejects late account changes',
      async () => {
        token = 'a'.repeat(43)
        globalThis.fetch = async (path, options) => {
          assert.equal(path, '/api/v1/portal/speaking/assignments/task-1')
          assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${token}`)
          assert.equal(options?.credentials, 'omit')
          assert.equal(options?.redirect, 'error')
          token = 'b'.repeat(43)
          return Response.json({ jobs: [], configuration: { enabled: false } })
        }
        await assert.rejects(client.getSpeakingHistory('task-1'), { code: 'expired', status: 401 })
      },
    )

    await t.test('valid audio is a local blob and never follows provider redirects', async () => {
      token = 'a'.repeat(43)
      globalThis.fetch = async (path, options) => {
        assert.equal(path, '/api/v1/portal/speaking/jobs/job-1/audio')
        assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${token}`)
        assert.equal(options?.credentials, 'omit')
        assert.equal(options?.redirect, 'error')
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' },
        })
      }
      const blob = await client.fetchSpeakingAudio('job-1')
      assert.equal(blob.type, 'audio/mpeg')
      assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2, 3])
    })

    await t.test('non-audio and oversized streamed bodies are rejected and cancelled', async () => {
      let cancelled = 0
      const streaming = (mime: string, size: number) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(size))
            },
            cancel() {
              cancelled += 1
            },
          }),
          { headers: { 'Content-Type': mime } },
        )
      globalThis.fetch = async () => streaming('text/html', 100)
      await assert.rejects(client.fetchSpeakingSource('file-1'), { status: 422 })
      globalThis.fetch = async () => streaming('audio/wav', 8 * 1024 * 1024 + 1)
      await assert.rejects(client.fetchSpeakingSource('file-1'), { status: 413 })
      assert.equal(cancelled, 2)
    })

    await t.test('abort and session change during a source read discard bytes', async () => {
      const controller = new AbortController()
      controller.abort()
      let requests = 0
      globalThis.fetch = async () => {
        requests += 1
        token = 'b'.repeat(43)
        return new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/wav' } })
      }
      await assert.rejects(client.fetchSpeakingSource('file-1', controller.signal), {
        name: 'AbortError',
      })
      assert.equal(requests, 0)
      token = 'a'.repeat(43)
      await assert.rejects(client.fetchSpeakingSource('file-1'), { code: 'expired', status: 401 })
    })

    await t.test(
      'normalized upload uses submission scope and rejects an account change during decoding',
      async () => {
        token = 'a'.repeat(43)
        let uploads = 0
        globalThis.fetch = async (path, options) => {
          uploads += 1
          assert.equal(path, '/api/v1/portal/files')
          const body = JSON.parse(String(options?.body)) as Record<string, string>
          assert.equal(body.purpose, 'submission')
          assert.equal(body.classId, 'class-1')
          assert.equal(body.mime, 'audio/wav')
          assert.equal(body.dataBase64, 'AQID')
          assert.match(body.name!, /^speaking-ai-[\w-]+\.wav$/)
          return Response.json({ id: 'file-normalized' })
        }
        assert.deepEqual(
          await client.uploadSpeakingAudio(
            new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
            'class-1',
          ),
          { id: 'file-normalized' },
        )
        class ChangedSessionBlob extends Blob {
          override async arrayBuffer(): Promise<ArrayBuffer> {
            token = 'b'.repeat(43)
            return super.arrayBuffer()
          }
        }
        await assert.rejects(
          client.uploadSpeakingAudio(
            new ChangedSessionBlob(['RIFF'], { type: 'audio/wav' }),
            'class-1',
          ),
          { code: 'expired', status: 401 },
        )
        assert.equal(uploads, 1)
      },
    )
  } finally {
    globalThis.fetch = originalFetch
    if (storageDescriptor) Object.defineProperty(globalThis, 'sessionStorage', storageDescriptor)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})
