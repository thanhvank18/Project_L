import assert from 'node:assert/strict'
import { test } from 'node:test'
import { speakingLimits } from '../shared/speaking.ts'
import {
  encodeSpeakingPcm16,
  SpeakingAudioError,
  type SpeakingAudioErrorCode,
} from '../src/features/live/speaking-pcm.ts'

// The browser adapter is exercised with Web Audio test doubles at runtime. Importing
// its URL keeps DOM declarations out of the server-only TypeScript compilation;
// tsconfig.app.json independently checks the real browser adapter.
const { normalizeSpeakingAudio } = (await import(
  new URL('../src/features/live/speaking-audio.ts', import.meta.url).href
)) as {
  normalizeSpeakingAudio: (
    blob: Blob,
    signal?: AbortSignal,
  ) => Promise<{ blob: Blob; durationSeconds: number }>
}

const errorCode = (code: SpeakingAudioErrorCode) => (error: unknown) =>
  error instanceof SpeakingAudioError && error.code === code
const samplesFor = (seconds: number) => new Float32Array(seconds * speakingLimits.sampleRate)
const ascii = (buffer: ArrayBuffer, start: number, length: number) =>
  new TextDecoder().decode(new Uint8Array(buffer, start, length))

function metadataDouble(
  duration: () => number = () => 3,
  afterSeek: () => number = duration,
  onMetadata?: () => void,
) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Audio')
  const create = URL.createObjectURL
  const revoke = URL.revokeObjectURL
  const stats = { created: 0, revoked: 0, paused: 0, cleared: 0, seeks: [] as number[] }
  const instances: MetadataAudio[] = []
  class MetadataAudio {
    duration = duration()
    src = ''
    preload = ''
    muted = false
    autoplay = true
    listeners = new Map<string, Set<() => void>>()
    constructor() {
      instances.push(this)
    }
    set currentTime(value: number) {
      stats.seeks.push(value)
      queueMicrotask(() => {
        this.duration = afterSeek()
        this.emit('durationchange')
        this.emit('seeked')
      })
    }
    addEventListener(type: string, listener: () => void) {
      const listeners = this.listeners.get(type) ?? new Set()
      listeners.add(listener)
      this.listeners.set(type, listeners)
    }
    removeEventListener(type: string, listener: () => void) {
      this.listeners.get(type)?.delete(listener)
    }
    emit(type: string) {
      for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
    }
    load() {
      if (!this.src) return
      assert.equal(this.preload, 'metadata')
      assert.equal(this.autoplay, false)
      assert.equal(this.muted, true)
      queueMicrotask(() => {
        onMetadata?.()
        this.emit('loadedmetadata')
      })
    }
    play() {
      assert.fail('Metadata preflight must never play audio')
    }
    pause() {
      stats.paused++
    }
    removeAttribute(name: string) {
      assert.equal(name, 'src')
      this.src = ''
      stats.cleared++
    }
  }
  Object.defineProperty(globalThis, 'Audio', { value: MetadataAudio, configurable: true })
  URL.createObjectURL = () => `blob:qa-audio-${++stats.created}`
  URL.revokeObjectURL = () => {
    stats.revoked++
  }
  return {
    stats,
    restore() {
      if (descriptor) Object.defineProperty(globalThis, 'Audio', descriptor)
      else Reflect.deleteProperty(globalThis, 'Audio')
      URL.createObjectURL = create
      URL.revokeObjectURL = revoke
      assert.equal(stats.created, stats.revoked)
      assert.equal(stats.created, stats.paused)
      assert.equal(stats.created, stats.cleared)
      for (const audio of instances)
        assert.ok([...audio.listeners.values()].every((listeners) => listeners.size === 0))
    },
  }
}

test('Speaking WAV headers describe complete PCM16 mono audio at 16 kHz', () => {
  const samples = samplesFor(3)
  samples[0] = 0.5
  samples[samples.length - 1] = -0.5
  const buffer = encodeSpeakingPcm16(samples)
  const view = new DataView(buffer)
  assert.equal(buffer.byteLength, 44 + samples.length * 2)
  assert.equal(ascii(buffer, 0, 4), 'RIFF')
  assert.equal(view.getUint32(4, true), buffer.byteLength - 8)
  assert.equal(ascii(buffer, 8, 4), 'WAVE')
  assert.equal(ascii(buffer, 12, 4), 'fmt ')
  assert.equal(view.getUint32(16, true), 16)
  assert.equal(view.getUint16(20, true), 1)
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), 16000)
  assert.equal(view.getUint32(28, true), 32000)
  assert.equal(view.getUint16(32, true), 2)
  assert.equal(view.getUint16(34, true), 16)
  assert.equal(ascii(buffer, 36, 4), 'data')
  assert.equal(view.getUint32(40, true), samples.length * 2)
  assert.equal(view.getInt16(44, true), 16384)
  assert.equal(view.getInt16(buffer.byteLength - 2, true), -16384)
})

test('Speaking encoder clamps finite samples without wrapping or mutating the recording', () => {
  const samples = samplesFor(3)
  samples.set([-5, -1, -0.5, 0, 0.5, 1, 5])
  const before = samples.slice()
  const buffer = encodeSpeakingPcm16(samples)
  const view = new DataView(buffer)
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => view.getInt16(44 + index * 2, true)),
    [-32768, -32768, -16384, 0, 16384, 32767, 32767],
  )
  assert.deepEqual(samples, before)
})

test('Speaking encoder rejects invalid samples and duration outside the complete allowed interval', () => {
  assert.throws(() => encodeSpeakingPcm16(new Float32Array()), errorCode('invalid_audio'))
  assert.throws(
    () =>
      encodeSpeakingPcm16(
        new Float32Array(speakingLimits.minSeconds * speakingLimits.sampleRate - 1),
      ),
    errorCode('too_short'),
  )
  assert.throws(
    () =>
      encodeSpeakingPcm16(
        new Float32Array(speakingLimits.maxSeconds * speakingLimits.sampleRate + 1),
      ),
    errorCode('too_long'),
  )
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const samples = samplesFor(3)
    samples[samples.length - 1] = invalid
    assert.throws(() => encodeSpeakingPcm16(samples), errorCode('invalid_audio'))
  }
  const maximum = encodeSpeakingPcm16(samplesFor(speakingLimits.maxSeconds))
  assert.equal(maximum.byteLength, 44 + speakingLimits.maxSeconds * speakingLimits.sampleRate * 2)
  assert.ok(maximum.byteLength <= speakingLimits.maxBytes)
})

test('Speaking preparation rejects empty, oversized, unsupported and cancelled input before decoding', async () => {
  await assert.rejects(normalizeSpeakingAudio(new Blob()), errorCode('invalid_audio'))
  await assert.rejects(
    normalizeSpeakingAudio(new Blob([new Uint8Array(speakingLimits.maxBytes + 1)])),
    errorCode('too_large'),
  )
  await assert.rejects(normalizeSpeakingAudio(new Blob(['not audio'])), errorCode('unsupported'))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    normalizeSpeakingAudio(new Blob(['not audio']), controller.signal),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  )
})

test('Speaking browser conversion configures mono 16 kHz rendering and closes its decoding context on every outcome', async () => {
  const metadata = metadataDouble(
    () => Infinity,
    () => 3,
  )
  const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const offlineDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext')
  const source = new Blob(['fictional compressed recording'], { type: 'audio/webm' })
  let closed = 0
  let duration = 3
  let invalid = false
  let decodeError = false
  let channelReads: number[] = []
  let rendered = 0
  class Decoder {
    state = 'running'
    async decodeAudioData(input: ArrayBuffer) {
      assert.equal(input.byteLength, source.size)
      if (decodeError) throw new Error('Unsupported codec')
      return {
        duration,
        numberOfChannels: 2,
        getChannelData(channel: number) {
          channelReads.push(channel)
          return new Float32Array([invalid ? NaN : 0.25, -0.25])
        },
      }
    }
    async close() {
      closed++
      this.state = 'closed'
    }
  }
  class Renderer {
    destination = {}
    readonly length: number
    constructor(channels: number, length: number, sampleRate: number) {
      this.length = length
      assert.equal(channels, 1)
      assert.equal(length, 48000)
      assert.equal(sampleRate, 16000)
    }
    createBufferSource() {
      return {
        buffer: undefined,
        connect: (destination: unknown) => assert.equal(destination, this.destination),
        start: (at: number) => assert.equal(at, 0),
      }
    }
    async startRendering() {
      rendered++
      return {
        length: this.length,
        getChannelData: (channel: number) => {
          assert.equal(channel, 0)
          return samplesFor(3)
        },
      }
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: Decoder, configurable: true })
  Object.defineProperty(globalThis, 'OfflineAudioContext', { value: Renderer, configurable: true })
  try {
    const result = await normalizeSpeakingAudio(source)
    assert.equal(result.durationSeconds, 3)
    assert.equal(result.blob.type, 'audio/wav')
    assert.equal(result.blob.size, 96044)
    assert.deepEqual(channelReads, [0, 1])
    assert.equal(closed, 1)
    assert.equal(rendered, 1)
    assert.equal(metadata.stats.seeks.length, 1)
    channelReads = []
    duration = 241
    await assert.rejects(normalizeSpeakingAudio(source), errorCode('too_long'))
    assert.equal(closed, 2)
    assert.equal(rendered, 1)
    assert.deepEqual(channelReads, [])
    duration = 3
    invalid = true
    await assert.rejects(normalizeSpeakingAudio(source), errorCode('invalid_audio'))
    assert.equal(closed, 3)
    invalid = false
    decodeError = true
    await assert.rejects(normalizeSpeakingAudio(source), errorCode('invalid_audio'))
    assert.equal(closed, 4)
  } finally {
    metadata.restore()
    if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (offlineDescriptor)
      Object.defineProperty(globalThis, 'OfflineAudioContext', offlineDescriptor)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  }
})

test('Cancelling decoding closes its context without producing an upload', async () => {
  const metadata = metadataDouble()
  const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const offlineDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext')
  const controller = new AbortController()
  let closed = false
  class Decoder {
    state = 'running'
    decodeAudioData() {
      queueMicrotask(() => controller.abort())
      return new Promise(() => undefined)
    }
    async close() {
      closed = true
      this.state = 'closed'
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: Decoder, configurable: true })
  Object.defineProperty(globalThis, 'OfflineAudioContext', {
    value: class {},
    configurable: true,
  })
  try {
    await assert.rejects(
      normalizeSpeakingAudio(new Blob(['recording']), controller.signal),
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    )
    assert.equal(closed, true)
  } finally {
    metadata.restore()
    if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (offlineDescriptor)
      Object.defineProperty(globalThis, 'OfflineAudioContext', offlineDescriptor)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  }
})

test('Metadata rejects overlong and unknown-duration recordings before allocating a decode context', async () => {
  const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const offlineDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext')
  let contexts = 0
  let duration = 3600
  const metadata = metadataDouble(() => duration)
  Object.defineProperty(globalThis, 'AudioContext', {
    value: class {
      constructor() {
        contexts++
      }
    },
    configurable: true,
  })
  Object.defineProperty(globalThis, 'OfflineAudioContext', { value: class {}, configurable: true })
  try {
    await assert.rejects(
      normalizeSpeakingAudio(new Blob(['compressed long audio'])),
      errorCode('too_long'),
    )
    assert.equal(contexts, 0)
    duration = Infinity
    await assert.rejects(
      normalizeSpeakingAudio(new Blob(['unknown duration webm'])),
      (error: unknown) =>
        error instanceof SpeakingAudioError &&
        error.code === 'invalid_audio' &&
        error.message.includes('duration could not be verified'),
    )
    assert.equal(contexts, 0)
    assert.equal(metadata.stats.seeks.length, 1)
  } finally {
    metadata.restore()
    if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (offlineDescriptor)
      Object.defineProperty(globalThis, 'OfflineAudioContext', offlineDescriptor)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  }
})

test('Cancelling metadata preflight releases its source and listeners before decoding', async () => {
  const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const offlineDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext')
  const controller = new AbortController()
  const metadata = metadataDouble(
    () => NaN,
    undefined,
    () => controller.abort(),
  )
  let contexts = 0
  Object.defineProperty(globalThis, 'AudioContext', {
    value: class {
      constructor() {
        contexts++
      }
    },
    configurable: true,
  })
  Object.defineProperty(globalThis, 'OfflineAudioContext', { value: class {}, configurable: true })
  try {
    await assert.rejects(
      normalizeSpeakingAudio(new Blob(['pending metadata']), controller.signal),
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    )
    assert.equal(contexts, 0)
  } finally {
    metadata.restore()
    if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (offlineDescriptor)
      Object.defineProperty(globalThis, 'OfflineAudioContext', offlineDescriptor)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  }
})

test('Unreadable metadata times out and releases the source without decoding', async () => {
  const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const offlineDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext')
  const metadata = metadataDouble(() => NaN)
  let contexts = 0
  Object.defineProperty(globalThis, 'AudioContext', {
    value: class {
      constructor() {
        contexts++
      }
    },
    configurable: true,
  })
  Object.defineProperty(globalThis, 'OfflineAudioContext', { value: class {}, configurable: true })
  try {
    await assert.rejects(
      normalizeSpeakingAudio(new Blob(['unreadable metadata'])),
      (error: unknown) =>
        error instanceof SpeakingAudioError &&
        error.message.includes('duration could not be verified'),
    )
    assert.equal(contexts, 0)
  } finally {
    metadata.restore()
    if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (offlineDescriptor)
      Object.defineProperty(globalThis, 'OfflineAudioContext', offlineDescriptor)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  }
})
