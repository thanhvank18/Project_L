import { openDatabase } from './db.ts'
import { createServer } from './http.ts'
import { submissionStorageFromEnvironment } from './drive-storage.ts'
import { createFileService } from './file-service.ts'
import { emailConfigurationFromEnvironment } from './email-config.ts'
import { startEmailRuntime } from './email-runtime.ts'
import { createSpeakingService } from './speaking-service.ts'
import { runtimeConfigurationFromEnvironment } from './runtime-config.ts'
import {
  createDriveConnectionService,
  driveOAuthConfigFromEnvironment,
} from './drive-connection.ts'

const { host, port, dbPath } = runtimeConfigurationFromEnvironment()
const storage = submissionStorageFromEnvironment()
const emailConfiguration = emailConfigurationFromEnvironment()
const db = openDatabase(dbPath)
const emailRuntime = startEmailRuntime(db, emailConfiguration)
const drive = createDriveConnectionService(db, driveOAuthConfigFromEnvironment(dbPath), {
  fallback: storage,
})
const files = createFileService(db, () => drive.storageConfiguration())
const speaking = createSpeakingService(db, files)
const server = createServer(db, files, emailConfiguration, speaking, drive)
server.listen(port, host, () => {
  console.info(
    `Project_L portal API listening on http://${host === '::1' ? '[::1]' : host}:${port}`,
  )
})
let closing = false
function shutdown() {
  if (closing) return
  closing = true
  emailRuntime.pause()
  server.close(async () => {
    await emailRuntime.stop()
    await speaking.stop()
    db.close()
    process.exitCode = 0
  })
  setTimeout(() => {
    server.closeAllConnections()
  }, 5_000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
