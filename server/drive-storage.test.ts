import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { FileRecord } from '../shared/portal.ts'
import {
  createDriveStorage,
  fileDigest,
  submissionStorageFromEnvironment,
  type RemoteFileLocation,
} from './drive-storage.ts'
import { HttpError } from './errors.ts'

const bytes = Buffer.from('%PDF-1.7\nPrivate assignment')
const record: FileRecord = {
  id: 'portal-file',
  classId: 'class',
  ownerId: 'student',
  purpose: 'submission',
  name: 'my answer.pdf',
  mime: 'application/pdf',
  size: bytes.length,
  createdAt: '2026-10-10T00:00:00.000Z',
}
const location: RemoteFileLocation = {
  provider: 'google-drive',
  fileId: 'remote-file-id',
  folderId: 'centre-folder',
  sharedDriveId: 'shared-drive',
  sha256: fileDigest(bytes),
}
const folder = {
  id: location.folderId,
  mimeType: 'application/vnd.google-apps.folder',
  driveId: location.sharedDriveId,
  trashed: false,
  capabilities: { canAddChildren: true },
}
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 })

function transport(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init })
    const response = responses.shift()
    if (response instanceof Error) throw response
    assert.ok(response, 'Unexpected provider request')
    return response
  }
  const drive = createDriveStorage({
    folderId: location.folderId,
    sharedDriveId: location.sharedDriveId!,
    requireSharedDrive: true,
    getAccessToken: async () => 'test-only-token',
    fetch,
  })
  return { calls, drive }
}

test('storage config is explicit, defaults local and rejects incomplete or unsafe credentials without disclosure', () => {
  assert.deepEqual(submissionStorageFromEnvironment({}), { mode: 'sqlite' })
  assert.throws(() => submissionStorageFromEnvironment({ PORTAL_SUBMISSION_STORAGE: 'other' }))
  assert.throws(() =>
    submissionStorageFromEnvironment({ PORTAL_SUBMISSION_STORAGE: 'google-drive' }),
  )
  const directory = mkdtempSync(join(tmpdir(), 'project-l-drive-config-'))
  const path = join(directory, 'credentials.json')
  const env = {
    PORTAL_SUBMISSION_STORAGE: 'google-drive',
    PORTAL_DRIVE_FOLDER_ID: 'centre-folder',
    PORTAL_DRIVE_AUTH_MODE: 'oauth',
    PORTAL_DRIVE_CREDENTIALS_FILE: path,
  }
  try {
    writeFileSync(
      path,
      JSON.stringify({
        type: 'external_account',
        credential_source: { url: 'https://example.test/secret' },
      }),
    )
    assert.throws(
      () => submissionStorageFromEnvironment(env),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes('example.test') &&
        error.message.includes('configuration'),
    )
    writeFileSync(
      path,
      JSON.stringify({
        type: 'authorized_user',
        client_id: 'test.apps.googleusercontent.com',
        client_secret: 'fixture-client-secret',
        refresh_token: 'fixture-refresh-token',
        token_uri: 'https://example.test/must-not-be-used',
      }),
    )
    assert.equal(submissionStorageFromEnvironment(env).mode, 'google-drive')
    assert.ok(
      submissionStorageFromEnvironment({ ...env, PORTAL_SUBMISSION_STORAGE: 'sqlite' }).drive,
    )
    assert.throws(() =>
      submissionStorageFromEnvironment({
        ...env,
        PORTAL_DRIVE_FOLDER_ID: 'https://drive.google.com/folder',
      }),
    )
    assert.throws(() =>
      submissionStorageFromEnvironment({ ...env, PORTAL_DRIVE_AUTH_MODE: 'service-account' }),
    )
    writeFileSync(path, 'fixture-secret-invalid-json')
    assert.throws(
      () => submissionStorageFromEnvironment(env),
      (error: unknown) => error instanceof Error && !error.message.includes('fixture-secret'),
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Drive adapter validates target, preallocates IDs and uploads privately through bounded resumable requests', async () => {
  const { drive, calls } = transport([
    json(folder),
    json({ ids: [location.fileId] }),
    new Response(null, {
      headers: {
        Location:
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-session',
      },
    }),
    json({ id: location.fileId, size: String(bytes.length) }),
    new Response(bytes),
    new Response(null, { status: 204 }),
  ])
  const allocated = await drive.allocate(record, bytes)
  assert.deepEqual(allocated, location)
  await drive.write(allocated, record, bytes)
  assert.deepEqual(await drive.read(allocated, record), bytes)
  await drive.remove(allocated)
  const metadata = JSON.parse(String(calls[2]!.init.body)) as Record<string, unknown>
  assert.equal(metadata.id, location.fileId)
  assert.equal(metadata.name, `${record.id}--${record.name}`)
  assert.deepEqual(metadata.parents, [location.folderId])
  assert.equal(metadata.permissions, undefined)
  assert.equal(metadata.ownerId, undefined)
  assert.equal(calls[3]!.init.method, 'PUT')
  assert.deepEqual(calls[3]!.init.body, bytes)
  assert.ok(calls.every((call) => new URL(call.url).origin === 'https://www.googleapis.com'))
  assert.ok(
    calls.every(
      (call) => call.init.redirect === 'error' && call.init.signal instanceof AbortSignal,
    ),
  )
  assert.ok(calls.every((call) => !call.url.includes('/permissions')))
  assert.equal(calls[5]!.init.method, 'DELETE')
})

test('wrong Shared Drive, inaccessible/non-folder targets and unsafe upload redirects fail before transmitting bytes', async () => {
  for (const invalid of [
    { ...folder, driveId: undefined },
    { ...folder, driveId: 'different-drive' },
    { ...folder, trashed: true },
    { ...folder, mimeType: 'application/pdf' },
    { ...folder, capabilities: { canAddChildren: false } },
  ]) {
    const { drive, calls } = transport([json(invalid)])
    await assert.rejects(drive.allocate(record, bytes), status(503))
    assert.equal(calls.length, 1)
  }
  for (const url of [
    'https://example.test/receive',
    'http://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=x',
    'https://www.googleapis.com/other?uploadType=resumable&upload_id=x',
  ]) {
    const { drive, calls } = transport([new Response(null, { headers: { Location: url } })])
    await assert.rejects(drive.write(location, record, bytes), status(503))
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.init.method, 'POST')
    assert.ok(!String(calls[0]!.init.body).includes('Private assignment'))
  }
})

test('downloads enforce exact bytes, digest and bounded responses; provider errors stay sanitized', async () => {
  for (const response of [
    new Response(Buffer.from('changed bytes')),
    new Response(bytes, { headers: { 'Content-Length': String(8 * 1024 * 1024 + 1) } }),
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1))
          controller.close()
        },
      }),
    ),
  ]) {
    const { drive } = transport([response])
    await assert.rejects(drive.read(location, record), status(502))
  }
  for (const response of [
    new Response('private provider error / token / folder', { status: 403 }),
    new Error('secret-token-and-private-url'),
  ]) {
    const { drive, calls } = transport([response])
    await assert.rejects(
      drive.read(location, record),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 503 &&
        !/token|folder|url/.test(error.message),
    )
    assert.equal(calls.length, 1)
  }
  const { drive } = transport([new Response(null, { status: 404 })])
  await assert.rejects(drive.remove(location), status(503))
})
