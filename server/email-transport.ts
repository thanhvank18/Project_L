import { emailConfigurationReady, type EmailConfiguration } from './email-config.ts'

export interface EmailMessage {
  from: string
  to: string
  subject: string
  text: string
}

export interface EmailTransport {
  send(message: EmailMessage, idempotencyKey: string): Promise<{ id: string }>
}

export class EmailDeliveryError extends Error {
  readonly code: string
  readonly retryable: boolean
  constructor(code: string, retryable: boolean) {
    super(code)
    this.name = 'EmailDeliveryError'
    this.code = code
    this.retryable = retryable
  }
}

/** Construction is local. A request occurs only when the enabled worker calls send. */
export function createResendTransport(
  config: EmailConfiguration,
  fetcher: typeof fetch = fetch,
): EmailTransport {
  if (!config.enabled || !emailConfigurationReady(config))
    throw new Error('Email delivery is disabled or its local configuration is incomplete.')
  return {
    async send(message, idempotencyKey) {
      let response: Response
      try {
        response = await fetcher('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({ ...message, to: [message.to] }),
        })
      } catch {
        throw new EmailDeliveryError('provider_unavailable', true)
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new EmailDeliveryError(
          response.status === 429 ? 'provider_rate_limited' : 'provider_rejected',
          response.status === 429 || response.status >= 500,
        )
      }
      // No provider body or error text is stored: it may include recipient information.
      try {
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No body')
        const chunks: Uint8Array[] = []
        let size = 0
        while (true) {
          const part = await reader.read()
          if (part.done) break
          size += part.value.byteLength
          if (size > 65_536) {
            await reader.cancel()
            throw new Error('Body too large')
          }
          chunks.push(part.value)
        }
        const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (
          !data ||
          typeof data !== 'object' ||
          !('id' in data) ||
          typeof data.id !== 'string' ||
          !/^[\w-]{1,150}$/.test(data.id)
        )
          throw new Error('Invalid response')
        return { id: data.id }
      } catch {
        throw new EmailDeliveryError('provider_result_uncertain', true)
      }
    },
  }
}
