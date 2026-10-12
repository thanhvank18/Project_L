import { speakingLimits } from '../../../shared/speaking.ts'
import {
  checkSpeakingDuration,
  checkSpeakingSamples,
  encodeSpeakingPcm16,
  SpeakingAudioError,
} from './speaking-pcm.ts'
export { encodeSpeakingPcm16, SpeakingAudioError } from './speaking-pcm.ts'
export type { SpeakingAudioErrorCode } from './speaking-pcm.ts'

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Audio preparation was cancelled.', 'AbortError')
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  checkAbort(signal)
  if (!signal) return promise
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('Audio preparation was cancelled.', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}

/** Read container metadata before allocating a decoded PCM buffer. Never play the source. */
function preflightDuration(blob: Blob, signal?: AbortSignal): Promise<void> {
  checkAbort(signal)
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(blob)
    let settled = false
    let soughtEnd = false
    const cleanup = () => {
      clearTimeout(timer)
      audio.removeEventListener('loadedmetadata', inspect)
      audio.removeEventListener('durationchange', inspect)
      audio.removeEventListener('seeked', seeked)
      audio.removeEventListener('error', failed)
      signal?.removeEventListener('abort', cancelled)
      try {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      } catch {
        // Some engines reject clearing a source while a metadata seek is pending.
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const unknownDuration = () =>
      finish(
        new SpeakingAudioError(
          'invalid_audio',
          'The recording duration could not be verified. Record again or choose an audio file with a known duration of 3 seconds to 4 minutes.',
        ),
      )
    const inspect = () => {
      if (settled) return
      if (Number.isFinite(audio.duration)) {
        try {
          checkSpeakingDuration(audio.duration)
          finish()
        } catch (error) {
          finish(error)
        }
      } else if (audio.duration === Infinity && !soughtEnd) {
        // MediaRecorder WebM often omits duration. A silent seek discovers the
        // actual end without decoding the entire recording with Web Audio.
        soughtEnd = true
        try {
          audio.currentTime = Number.MAX_SAFE_INTEGER
        } catch {
          unknownDuration()
        }
      }
    }
    const seeked = () => {
      inspect()
      if (!settled) unknownDuration()
    }
    const failed = () =>
      finish(new SpeakingAudioError('invalid_audio', 'The browser could not read this audio file.'))
    const cancelled = () =>
      finish(new DOMException('Audio preparation was cancelled.', 'AbortError'))
    audio.addEventListener('loadedmetadata', inspect)
    audio.addEventListener('durationchange', inspect)
    audio.addEventListener('seeked', seeked)
    audio.addEventListener('error', failed)
    signal?.addEventListener('abort', cancelled, { once: true })
    const timer = setTimeout(unknownDuration, 5000)
    try {
      audio.preload = 'metadata'
      audio.autoplay = false
      audio.muted = true
      audio.src = url
      audio.load()
    } catch {
      failed()
    }
  })
}

/** Browser-only conversion; no audio is uploaded by this helper. */
export async function normalizeSpeakingAudio(
  blob: Blob,
  signal?: AbortSignal,
): Promise<{ blob: Blob; durationSeconds: number }> {
  checkAbort(signal)
  if (!blob.size) throw new SpeakingAudioError('invalid_audio', 'The recording is empty.')
  if (blob.size > speakingLimits.maxBytes)
    throw new SpeakingAudioError('too_large', 'The recording exceeds the eight-megabyte limit.')
  if (
    typeof globalThis.Audio !== 'function' ||
    typeof globalThis.AudioContext !== 'function' ||
    typeof globalThis.OfflineAudioContext !== 'function' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof URL.revokeObjectURL !== 'function'
  )
    throw new SpeakingAudioError('unsupported', 'This browser cannot prepare audio for assessment.')

  let context: AudioContext | undefined
  try {
    await preflightDuration(blob, signal)
    checkAbort(signal)
    context = new AudioContext()
    const input = await abortable(blob.arrayBuffer(), signal)
    checkAbort(signal)
    const decoded = await abortable(context.decodeAudioData(input), signal)
    checkAbort(signal)
    checkSpeakingDuration(decoded.duration)
    if (!decoded.numberOfChannels)
      throw new SpeakingAudioError('invalid_audio', 'The recording contains no audio channels.')
    for (let channel = 0; channel < decoded.numberOfChannels; channel++)
      checkSpeakingSamples(decoded.getChannelData(channel))
    const length = Math.round(decoded.duration * speakingLimits.sampleRate)
    const offline = new OfflineAudioContext(1, length, speakingLimits.sampleRate)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start(0)
    const rendered = await abortable(offline.startRendering(), signal)
    checkAbort(signal)
    const wav = encodeSpeakingPcm16(rendered.getChannelData(0))
    checkAbort(signal)
    return {
      blob: new Blob([wav], { type: 'audio/wav' }),
      durationSeconds: rendered.length / speakingLimits.sampleRate,
    }
  } catch (error) {
    checkAbort(signal)
    if (error instanceof SpeakingAudioError) throw error
    throw new SpeakingAudioError('invalid_audio', 'This recording could not be decoded.', error)
  } finally {
    if (context && context.state !== 'closed') await context.close().catch(() => undefined)
  }
}
