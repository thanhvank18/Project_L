import assert from 'node:assert/strict'
import { test } from 'node:test'
import { vercelConfiguration } from '../deploy/vercel-config.ts'

test('Vercel routes a configured API through the same origin and preserves API paths', () => {
  const config = vercelConfiguration(' https://portal-api.up.railway.app/ ')
  assert.deepEqual(config.rewrites.slice(0, 2), [
    { source: '/api/v1', destination: 'https://portal-api.up.railway.app/api/v1' },
    { source: '/api/v1/:path*', destination: 'https://portal-api.up.railway.app/api/v1/:path*' },
  ])
  assert.equal(
    config.rewrites.some((rule) => rule.source === '/(.*)'),
    false,
  )
})

test('frontend preview never disguises a missing API or asset as a successful HTML page', () => {
  for (const value of [undefined, '', '   ']) {
    const config = vercelConfiguration(value)
    assert.equal(
      config.rewrites.some((rule) => rule.source.startsWith('/api')),
      false,
    )
    assert.equal(
      config.rewrites.some((rule) => rule.source.includes('*')),
      false,
    )
    for (const path of ['/vi', '/en', '/login', '/learn', '/dashboard', '/courses'])
      assert.ok(
        config.rewrites.some((rule) => rule.source === path && rule.destination === '/index.html'),
      )
  }
})

test('backend routing rejects credentials, local addresses and ambiguous URLs without echoing input', () => {
  for (const origin of [
    'http://portal-api.up.railway.app',
    'https://user:fixture-secret@portal-api.up.railway.app',
    'https://localhost:4003',
    'https://127.0.0.1:4003',
    'https://api.internal',
    'https://portal-api.up.railway.app/api/v1',
    'https://portal-api.up.railway.app/?key=fixture-secret',
    'https://portal-api.up.railway.app/#fragment',
    'not an origin',
  ]) {
    assert.throws(
      () => vercelConfiguration(origin),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes(origin) &&
        !error.message.includes('fixture-secret'),
    )
  }
})
