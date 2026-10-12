import type { Account, FileRecord } from '../shared/portal.ts'
import type { Database } from './db.ts'
import {
  authorizedFileRecord,
  getFile,
  persistFileRecord,
  uploadFile,
  validateFileUpload,
  type FileUploadMetadata,
} from './domain.ts'
import { authenticated, get, id, now, put, remove, transaction } from './domain-store.ts'
import {
  fileDigest,
  storageUnavailable,
  type RemoteFileLocation,
  type SubmissionStorageConfiguration,
} from './drive-storage.ts'
import { HttpError } from './errors.ts'

type StoredFileLocation = { id: string; location: RemoteFileLocation }
interface PendingUpload extends StoredFileLocation {
  createdAt: string
  status: 'pending' | 'cleanup-required'
}

/** Cloud work happens outside transactions; every commit and disclosure rechecks current access. */
export function createFileService(
  db: Database,
  configured: SubmissionStorageConfiguration | (() => SubmissionStorageConfiguration) = {
    mode: 'sqlite',
  },
) {
  return {
    async upload(
      suppliedActor: Account,
      metadata: FileUploadMetadata,
      bytes: Buffer,
      reauthorize: () => Account = () => authenticated(db, suppliedActor),
    ): Promise<FileRecord> {
      const actor = reauthorize()
      const configuration = typeof configured === 'function' ? configured() : configured
      const validated = validateFileUpload(db, actor, metadata, bytes)
      if (metadata.purpose !== 'submission' || configuration.mode === 'sqlite')
        return uploadFile(db, actor, metadata, bytes)
      const drive = configuration.drive
      if (!drive) throw storageUnavailable()
      const record: FileRecord = { ...validated, id: id(), createdAt: now() }
      let location: RemoteFileLocation | undefined
      let writeAttempted = false
      let writeConfirmed = false
      try {
        location = await drive.allocate(record, bytes)
        const pending: PendingUpload = {
          id: record.id,
          location,
          createdAt: now(),
          status: 'pending',
        }
        // Persist the preallocated provider ID before transmitting bytes, including for ambiguous failures.
        transaction(db, () => {
          validateFileUpload(db, reauthorize(), metadata, bytes)
          put(db, 'fileStoragePending', pending)
        })
        writeAttempted = true
        await drive.write(location, record, bytes)
        writeConfirmed = true
        transaction(db, () => {
          const currentActor = reauthorize()
          validateFileUpload(db, currentActor, metadata, bytes)
          persistFileRecord(db, currentActor, record)
          put<StoredFileLocation>(db, 'fileStorage', { id: record.id, location: location! })
          remove(db, 'fileStoragePending', record.id)
        })
        return record
      } catch (error) {
        if (location && writeAttempted) {
          let cleanupRequired = writeAttempted && !writeConfirmed
          try {
            await drive.remove(location)
          } catch {
            cleanupRequired = true
          }
          if (cleanupRequired) {
            // An unconfirmed upload may finish after deletion reports 404. Retain its ID for reconciliation.
            put<PendingUpload>(db, 'fileStoragePending', {
              id: record.id,
              location,
              createdAt: now(),
              status: 'cleanup-required',
            })
          } else remove(db, 'fileStoragePending', record.id)
        } else if (location) remove(db, 'fileStoragePending', record.id)
        if (error instanceof HttpError) throw error
        throw storageUnavailable()
      }
    },
    async download(
      suppliedActor: Account,
      key: string,
      reauthorize: () => Account = () => authenticated(db, suppliedActor),
    ): Promise<{ record: FileRecord; bytes: Buffer }> {
      const actor = reauthorize()
      const configuration = typeof configured === 'function' ? configured() : configured
      const record = authorizedFileRecord(db, actor, key)
      const stored = get<StoredFileLocation>(db, 'fileStorage', key)
      if (!stored) return getFile(db, actor, key)
      const drive = configuration.drive
      if (!drive) throw storageUnavailable()
      let bytes: Buffer
      try {
        bytes = await drive.read(stored.location, record)
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw storageUnavailable()
      }
      const currentRecord = authorizedFileRecord(db, reauthorize(), key)
      if (
        !Buffer.isBuffer(bytes) ||
        bytes.length !== currentRecord.size ||
        bytes.length > 8 * 1024 * 1024 ||
        fileDigest(bytes) !== stored.location.sha256
      )
        throw new HttpError(
          502,
          'file_integrity',
          'The stored file could not be verified. Contact an administrator.',
        )
      return { record: currentRecord, bytes }
    },
  }
}

export type FileService = ReturnType<typeof createFileService>
