import { apiRequest, PortalApiError, readSessionToken } from '@/features/auth/client'
import type { FileRecord, Locale } from '../../../shared/portal'
import {
  speakingLimits,
  type SpeakingHistory,
  type SpeakingJob,
  type SpeakingProviderName,
} from '../../../shared/speaking'

export interface CreateSpeakingJobInput {
  assignmentId: string
  assignmentVersion: number
  kind: 'question' | 'assessment'
  locale: Locale
  requestId: string
  fileId?: string
  provider?: SpeakingProviderName
}

function assertSession(token: string | null, signal?: AbortSignal): asserts token is string {
  signal?.throwIfAborted()
  if (!token || token !== readSessionToken()) throw new PortalApiError('expired', 401)
}

async function sessionRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readSessionToken()
  const signal = options.signal ?? undefined
  assertSession(token, signal)
  try {
    const result = await apiRequest<T>(path, options)
    assertSession(token, signal)
    return result
  } catch (failure) {
    assertSession(token, signal)
    throw failure
  }
}

export function getSpeakingHistory(
  assignmentId: string,
  signal?: AbortSignal,
): Promise<SpeakingHistory> {
  return sessionRequest(`portal/speaking/assignments/${encodeURIComponent(assignmentId)}`, {
    signal,
  })
}

export function createSpeakingJob(
  input: CreateSpeakingJobInput,
  signal?: AbortSignal,
): Promise<SpeakingJob> {
  return sessionRequest('portal/speaking/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
}

export function cancelSpeakingJob(
  id: string,
  expectedVersion: number,
  signal?: AbortSignal,
): Promise<SpeakingJob> {
  return sessionRequest(`portal/speaking/jobs/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion }),
    signal,
  })
}

const audioTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
])

async function fetchPrivateAudio(path: string, signal?: AbortSignal): Promise<Blob> {
  const token = readSessionToken()
  assertSession(token, signal)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(`/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit',
      redirect: 'error',
      signal,
    })
    reader = response.body?.getReader()
    assertSession(token, signal)
    if (!response.ok) throw new PortalApiError('service', response.status)
    const mime = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!audioTypes.has(mime)) throw new PortalApiError('invalid-response', 422)
    const length = response.headers.get('Content-Length')
    if (length !== null) {
      const bytes = Number(length)
      if (!Number.isSafeInteger(bytes) || bytes < 1)
        throw new PortalApiError('invalid-response', 422)
      if (bytes > speakingLimits.maxBytes) throw new PortalApiError('service', 413)
    }
    if (!reader) throw new PortalApiError('invalid-response', 422)
    const chunks: ArrayBuffer[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      assertSession(token, signal)
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > speakingLimits.maxBytes) throw new PortalApiError('service', 413)
      chunks.push(new Uint8Array(chunk.value).buffer)
    }
    if (!size) throw new PortalApiError('invalid-response', 422)
    assertSession(token, signal)
    return new Blob(chunks, { type: mime })
  } catch (failure) {
    await reader?.cancel().catch(() => undefined)
    assertSession(token, signal)
    if (failure instanceof PortalApiError) throw failure
    throw new PortalApiError('network')
  } finally {
    reader?.releaseLock()
  }
}

export function fetchSpeakingAudio(jobId: string, signal?: AbortSignal): Promise<Blob> {
  return fetchPrivateAudio(`portal/speaking/jobs/${encodeURIComponent(jobId)}/audio`, signal)
}

export function fetchSpeakingSource(fileId: string, signal?: AbortSignal): Promise<Blob> {
  return fetchPrivateAudio(`portal/files/${encodeURIComponent(fileId)}`, signal)
}

export async function uploadSpeakingAudio(
  blob: Blob,
  classId: string,
  signal?: AbortSignal,
): Promise<FileRecord> {
  const token = readSessionToken()
  assertSession(token, signal)
  if (!blob.size || !['audio/wav', 'audio/x-wav', 'audio/wave'].includes(blob.type))
    throw new PortalApiError('invalid-response', 422)
  if (blob.size > speakingLimits.maxBytes) throw new PortalApiError('service', 413)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  assertSession(token, signal)
  let binary = ''
  for (let start = 0; start < bytes.length; start += 16384)
    binary += String.fromCharCode(...bytes.subarray(start, start + 16384))
  const record = await sessionRequest<FileRecord>('portal/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId,
      purpose: 'submission',
      name: `speaking-ai-${crypto.randomUUID()}.wav`,
      mime: 'audio/wav',
      dataBase64: btoa(binary),
    }),
    signal,
  })
  // The upload may be retained by the server; never attach it to another account's UI.
  assertSession(token, signal)
  return record
}
