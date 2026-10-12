import { speakingLimits } from '../../../shared/speaking.ts'

export type SpeakingAudioErrorCode =
  'unsupported' | 'invalid_audio' | 'too_short' | 'too_long' | 'too_large'

export class SpeakingAudioError extends Error {
  readonly code: SpeakingAudioErrorCode

  constructor(code: SpeakingAudioErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'SpeakingAudioError'
    this.code = code
  }
}

export function checkSpeakingDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new SpeakingAudioError('invalid_audio', 'The recording has no valid audio duration.')
  if (seconds < speakingLimits.minSeconds)
    throw new SpeakingAudioError('too_short', 'Record at least three seconds of speech.')
  if (seconds > speakingLimits.maxSeconds)
    throw new SpeakingAudioError('too_long', 'The recording exceeds four minutes.')
}

export function checkSpeakingSamples(samples: Float32Array) {
  for (const sample of samples)
    if (!Number.isFinite(sample))
      throw new SpeakingAudioError('invalid_audio', 'The recording contains invalid audio samples.')
}

/** Encodes the complete 16 kHz mono signal. Oversized input is rejected, never truncated. */
export function encodeSpeakingPcm16(samples: Float32Array): ArrayBuffer {
  checkSpeakingDuration(samples.length / speakingLimits.sampleRate)
  const dataBytes = samples.length * 2
  if (dataBytes + 44 > speakingLimits.maxBytes)
    throw new SpeakingAudioError('too_large', 'The prepared recording exceeds the file limit.')
  checkSpeakingSamples(samples)
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, speakingLimits.sampleRate, true)
  view.setUint32(28, speakingLimits.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]!))
    view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
  }
  return buffer
}
