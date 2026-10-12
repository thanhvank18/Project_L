import assert from 'node:assert/strict'
import test from 'node:test'
import { emailConfigurationFromEnvironment } from './email-config.ts'
import { createResendTransport, EmailDeliveryError } from './email-transport.ts'

const config = emailConfigurationFromEnvironment({
  PORTAL_EMAIL_ENABLED: 'true',
  PORTAL_EMAIL_PROVIDER: 'resend',
  PORTAL_EMAIL_FROM: 'teacher@example.org',
  PORTAL_EMAIL_API_KEY: 'fake-test-key',
  PORTAL_EMAIL_PORTAL_ORIGIN: 'https://portal.example.org',
})
const message = {
  from: config.from,
  to: 'learner@example.org',
  subject: 'Review',
  text: 'Open https://portal.example.org/learn#schedule',
}

test('Resend adapter is explicit, uses fixed HTTPS endpoint and idempotency header, without HTML/private data', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(options?.method, 'POST')
    assert.equal(options?.redirect, 'error')
    assert.equal(new Headers(options?.headers).get('Idempotency-Key'), 'stable-key')
    assert.ok(options?.signal)
    assert.deepEqual(JSON.parse(String(options?.body)), { ...message, to: [message.to] })
    return Response.json({ id: 'mock-provider-id' })
  }
  const adapter = createResendTransport(config, fetcher)
  assert.deepEqual(await adapter.send(message, 'stable-key'), { id: 'mock-provider-id' })
  assert.throws(() => createResendTransport({ ...config, enabled: false }, fetcher), /disabled/)
})

test('provider errors are sanitized and only transient/ambiguous results permit retry', async () => {
  for (const status of [400, 401, 429, 500]) {
    const adapter = createResendTransport(
      config,
      async () => new Response('recipient@example.org SECRET', { status }),
    )
    await assert.rejects(adapter.send(message, 'key'), (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError)
      assert.equal(error.retryable, status === 429 || status >= 500)
      assert.doesNotMatch(error.message, /SECRET|recipient@/)
      return true
    })
  }
  const uncertain = createResendTransport(config, async () => Response.json({ wrong: 'field' }))
  await assert.rejects(
    uncertain.send(message, 'key'),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.code === 'provider_result_uncertain' &&
      error.retryable,
  )
  const outage = createResendTransport(config, async () => {
    throw new Error('secret')
  })
  await assert.rejects(
    outage.send(message, 'key'),
    (error: unknown) =>
      error instanceof EmailDeliveryError && error.code === 'provider_unavailable',
  )
})
