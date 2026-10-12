import { speakingLimits } from '../shared/speaking.ts'
import { HttpError } from './errors.ts'

/** Parse and bound the actual PCM stream; client duration/MIME are never trusted. */
export function inspectSpeakingWav(bytes: Buffer): { durationSeconds: number; silent: boolean } {
  const invalid = () =>
    new HttpError(422, 'speaking_audio_format', 'Use a 16 kHz mono 16-bit PCM WAV recording.')
  if (
    bytes.length < 44 ||
    bytes.length > speakingLimits.maxBytes ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WAVE' ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    throw invalid()
  let format = false
  let data: Buffer | undefined
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const name = bytes.toString('ascii', offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > bytes.length) throw invalid()
    if (name === 'fmt ') {
      if (
        format ||
        size < 16 ||
        bytes.readUInt16LE(start) !== 1 ||
        bytes.readUInt16LE(start + 2) !== 1 ||
        bytes.readUInt32LE(start + 4) !== speakingLimits.sampleRate ||
        bytes.readUInt32LE(start + 8) !== 32000 ||
        bytes.readUInt16LE(start + 12) !== 2 ||
        bytes.readUInt16LE(start + 14) !== 16
      )
        throw invalid()
      format = true
    }
    if (name === 'data') {
      if (data || size % 2) throw invalid()
      data = bytes.subarray(start, start + size)
    }
    offset = start + size + (size % 2)
  }
  if (!format || !data || offset !== bytes.length) throw invalid()
  const durationSeconds = data.length / 32000
  if (durationSeconds < speakingLimits.minSeconds || durationSeconds > speakingLimits.maxSeconds)
    throw new HttpError(
      422,
      'speaking_audio_duration',
      'Speaking AI accepts recordings from 3 seconds to 4 minutes.',
    )
  let sum = 0
  for (let index = 0; index < data.length; index += 2) sum += (data.readInt16LE(index) / 32768) ** 2
  // Only reject near-digital silence here; intelligibility remains an audio-model decision.
  return { durationSeconds, silent: Math.sqrt(sum / (data.length / 2)) < 0.0003 }
}
