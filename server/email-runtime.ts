import type { Database } from './db.ts'
import { registerBeforeCommit } from './domain-store.ts'
import type { EmailConfiguration } from './email-config.ts'
import { processEmailQueue, reconcileEmailQueue } from './email-queue.ts'
import type { EmailTransport } from './email-transport.ts'

/** No outbound request is made when config.enabled is false (the default). */
export function startEmailRuntime(
  db: Database,
  config: EmailConfiguration,
  transport?: EmailTransport,
) {
  reconcileEmailQueue(db, config)
  const removeHook = registerBeforeCommit(db, () => reconcileEmailQueue(db, config))
  let stopped = false
  let pending: Promise<void> | undefined
  const tick = () => {
    if (stopped || pending) return
    pending = (async () => {
      try {
        reconcileEmailQueue(db, config)
        await processEmailQueue(db, config, transport)
      } catch {
        // Errors may carry secrets or recipient data; log a fixed operational code only.
        console.error('email_worker_failed')
      }
    })().finally(() => {
      pending = undefined
    })
  }
  const timer = setInterval(tick, 30_000)
  timer.unref()
  tick()
  return {
    pause() {
      stopped = true
      clearInterval(timer)
    },
    async stop() {
      stopped = true
      clearInterval(timer)
      removeHook()
      await pending
    },
  }
}
