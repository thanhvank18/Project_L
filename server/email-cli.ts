import { resolve } from 'node:path'
import { openDatabase } from './db.ts'
import { all } from './domain-store.ts'
import { emailConfigurationFromEnvironment } from './email-config.ts'
import {
  emailQueueSummary,
  processEmailQueue,
  reconcileEmailQueue,
  retryEmailJob,
  type EmailJob,
} from './email-queue.ts'

const [command = 'status', id, ...extra] = process.argv.slice(2)
if (
  !['status', 'reconcile', 'retry', 'dispatch'].includes(command) ||
  extra.length ||
  (command === 'retry' ? !id : Boolean(id))
) {
  console.error('Usage: email-cli.ts status | reconcile | retry <job-id> | dispatch')
  process.exitCode = 1
} else {
  const config = emailConfigurationFromEnvironment()
  const db = openDatabase(resolve(process.env.PORTAL_DB_PATH ?? '.local/portal/portal.sqlite'))
  try {
    if (command === 'reconcile') reconcileEmailQueue(db, config)
    if (command === 'retry') retryEmailJob(db, id!)
    if (command === 'dispatch') {
      if (!config.enabled) throw new Error('Email delivery is disabled. No request was made.')
      await processEmailQueue(db, config)
    }
    console.info(
      JSON.stringify(
        {
          ...emailQueueSummary(db, config),
          jobs: all<EmailJob>(db, 'emailJob').map((job) => ({
            id: job.id,
            kind: job.kind,
            status: job.status,
            attempts: job.attempts,
            nextAttemptAt: job.nextAttemptAt,
            errorCode: job.errorCode,
          })),
        },
        null,
        2,
      ),
    )
  } catch {
    console.error(
      'Email operation failed; inspect local configuration and queue status. No credentials or provider error body are printed.',
    )
    process.exitCode = 1
  } finally {
    db.close()
  }
}
