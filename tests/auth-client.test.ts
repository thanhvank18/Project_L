import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/'))
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    return nextResolve(specifier, context)
  },
})
const clientPath = new URL('../src/features/auth/client.ts', import.meta.url).href
const client = (await import(clientPath)) as {
  signIn: (email: string, password: string) => Promise<unknown>
}
hooks.deregister()

test('login preserves a distinct retry message for busy verification and failed-attempt throttling', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const [body, code] of [
      [{ error: 'LOGIN_BUSY', message: 'Do not display raw server text' }, 'login-busy'],
      [{ error: 'RATE_LIMITED' }, 'rate-limited'],
      [{ error: 'unknown' }, 'rate-limited'],
      [null, 'rate-limited'],
    ] as const) {
      globalThis.fetch = async () => Response.json(body, { status: 429 })
      await assert.rejects(client.signIn('learner@example.test', 'QA password only'), {
        code,
        status: 429,
      })
    }
    globalThis.fetch = async () => new Response('Upstream is busy', { status: 429 })
    await assert.rejects(client.signIn('learner@example.test', 'QA password only'), {
      code: 'rate-limited',
      status: 429,
    })
    globalThis.fetch = async () => Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
    await assert.rejects(client.signIn('learner@example.test', 'QA password only'), {
      code: 'credentials',
      status: 401,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
