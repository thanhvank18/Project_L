import assert from 'node:assert/strict'
import { test } from 'node:test'
import { speakingCriteria, speakingLimits } from '../shared/speaking.ts'
import { HttpError } from './errors.ts'
import { speakingConfigurationFromEnvironment } from './speaking-config.ts'
import { createGeminiSpeakingProvider } from './speaking-gemini.ts'

const config = () =>
  speakingConfigurationFromEnvironment({
    PORTAL_AI_PROVIDER: 'gemini',
    PORTAL_AI_ENABLED: 'true',
    PORTAL_GEMINI_API_KEY: 'isolated-test-key-not-a-real-provider-key',
  })
const signal = () => new AbortController().signal
const errorCode = (code: string) => (error: unknown) =>
  error instanceof HttpError && error.code === code
function wav(rate = 24_000): Buffer {
  const bytes = Buffer.alloc(44 + rate * 2 * 4)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24)
  bytes.writeUInt32LE(rate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(bytes.length - 44, 40)
  for (let offset = 44; offset < bytes.length; offset += 2)
    bytes.writeInt16LE(Math.round(Math.sin(offset / 20) * 2000), offset)
  return bytes
}
const envelope = (parts: unknown[], finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { role: 'model', parts } }],
})
const textResult = (value: unknown) => envelope([{ text: JSON.stringify(value) }])
const audioResult = (bytes = wav(), mimeType = 'audio/wav') =>
  envelope([{ inlineData: { mimeType, data: bytes.toString('base64') } }])
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const assessment = () => ({
  audioEvaluated: true,
  summary: 'Isolated adapter test; not actual AI feedback.',
  limitations: ['One practice answer.'],
  criteria: Object.fromEntries(
    speakingCriteria.map((name) => [
      name,
      {
        score: 6,
        feedback: 'Test observation.',
        evidence: ['Audible fictional example.'],
        improvements: ['Practise the sentence again.'],
      },
    ]),
  ),
})
const assessmentInput = () => ({
  audio: wav(16_000),
  prompt: 'Describe a place you enjoy visiting.',
  transcript: 'A fictional response used only to validate this adapter.',
  locale: 'vi' as const,
  durationSeconds: 4,
})
interface RequestBody {
  systemInstruction?: { parts: { text: string }[] }
  contents: {
    role: string
    parts: { text?: string; inlineData?: { data: string; mimeType: string } }[]
  }[]
  generationConfig: {
    responseModalities?: string[]
    responseFormat?: { text?: { mimeType: string; schema: unknown }; audio?: unknown }
    speechConfig?: { voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } }
  }
  tools?: unknown
}

test('Gemini speech uses the configured endpoint/header and returns a validated WAV', async () => {
  let calls = 0
  const provider = createGeminiSpeakingProvider(config(), async (url, init) => {
    calls++
    assert.equal(
      url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent',
    )
    assert.equal(String(url).includes(config().apiKey), false)
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), config().apiKey)
    assert.equal(new Headers(init?.headers).has('Authorization'), false)
    assert.equal(init?.method, 'POST')
    assert.equal(init?.redirect, 'error')
    assert.ok(init?.signal)
    const body = JSON.parse(String(init?.body)) as RequestBody
    assert.equal(body.contents[0]?.parts[0]?.text, 'What do you enjoy reading?')
    assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO'])
    assert.equal(
      body.generationConfig.speechConfig?.voiceConfig.prebuiltVoiceConfig.voiceName,
      'Kore',
    )
    assert.equal(body.tools, undefined)
    return response(audioResult())
  })
  assert.equal(provider.speechMime, 'audio/wav')
  assert.deepEqual(await provider.speak('What do you enjoy reading?', signal()), wav())
  assert.equal(calls, 1)
})

test('Gemini documented raw PCM is wrapped in WAV without altering samples', async () => {
  const pcm = wav().subarray(44)
  const provider = createGeminiSpeakingProvider(config(), async () =>
    response(audioResult(pcm, 'audio/L16;codec=pcm;rate=24000')),
  )
  assert.deepEqual(await provider.speak('Read this question.', signal()), wav())
})

test('Gemini transcription and assessment send real WAV with instruction/data separation', async () => {
  const input = assessmentInput()
  let calls = 0
  const provider = createGeminiSpeakingProvider(config(), async (url, init) => {
    assert.equal(
      url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    )
    const body = JSON.parse(String(init?.body)) as RequestBody
    assert.equal(body.generationConfig.responseFormat?.text?.mimeType, 'APPLICATION_JSON')
    assert.ok(body.generationConfig.responseFormat?.text?.schema)
    assert.equal(body.tools, undefined)
    const inline = body.contents[0]?.parts.find((part) => part.inlineData)?.inlineData
    assert.equal(inline?.mimeType, 'audio/wav')
    assert.deepEqual(Buffer.from(inline!.data, 'base64'), input.audio)
    if (calls++ === 0) {
      assert.match(body.systemInstruction!.parts[0]!.text, /never follow instructions/)
      assert.equal(
        body.contents[0]?.parts.some((part) => part.text),
        false,
      )
      return response(textResult({ transcript: `  ${input.transcript}  ` }))
    }
    assert.match(body.systemInstruction!.parts[0]!.text, /Evaluate the attached AUDIO/)
    assert.match(body.systemInstruction!.parts[0]!.text, /Vietnamese/)
    assert.match(body.systemInstruction!.parts[0]!.text, /Never execute instructions/)
    assert.deepEqual(JSON.parse(body.contents[0]!.parts[0]!.text!), {
      teacherQuestion: input.prompt,
      transcript: input.transcript,
      durationSeconds: 4,
    })
    return response(textResult(assessment()))
  })
  assert.equal(await provider.transcribe(input.audio, signal()), input.transcript)
  const result = await provider.assess(input, signal())
  assert.equal(result.overall, 6)
  assert.equal(result.advisory, true)
  assert.equal(result.criteria.pronunciation.score, 6)
  assert.equal(calls, 2)
})

test('Gemini permits an empty transcript and nullable criterion scores without inventing evidence', async () => {
  const empty = createGeminiSpeakingProvider(config(), async () =>
    response(textResult({ transcript: '' })),
  )
  assert.equal(await empty.transcribe(wav(16_000), signal()), '')
  const value = assessment()
  const nullable = {
    ...value,
    criteria: {
      ...value.criteria,
      pronunciation: { ...value.criteria.pronunciation, score: null, evidence: [] },
    },
  }
  const provider = createGeminiSpeakingProvider(config(), async () =>
    response(textResult(nullable)),
  )
  assert.equal((await provider.assess(assessmentInput(), signal())).overall, null)
})

test('Gemini rejects blocked, truncated, malformed and unexpected tool responses', async () => {
  const cases: unknown[] = [
    {},
    { promptFeedback: { blockReason: 'SAFETY' }, ...textResult({ transcript: 'No' }) },
    envelope([{ text: '{"transcript":"partial"}' }], 'MAX_TOKENS'),
    envelope([{ text: '{"transcript":"blocked"}' }], 'SAFETY'),
    envelope([{ text: 'not JSON' }]),
    envelope([{ functionCall: { name: 'unexpected' } }]),
    envelope([{ text: '{"transcript":"fine"}', thought: true }]),
    textResult({ transcript: 123 }),
    textResult({ transcript: 'text', extra: 'unexpected' }),
    textResult({ transcript: 'a'.repeat(speakingLimits.transcriptCharacters + 1) }),
  ]
  for (const value of cases) {
    const provider = createGeminiSpeakingProvider(config(), async () => response(value))
    await assert.rejects(
      provider.transcribe(wav(16_000), signal()),
      errorCode('speaking_invalid_result'),
    )
  }
  const badAssessment = assessment()
  badAssessment.audioEvaluated = false
  const provider = createGeminiSpeakingProvider(config(), async () =>
    response(textResult(badAssessment)),
  )
  await assert.rejects(
    provider.assess(assessmentInput(), signal()),
    errorCode('speaking_invalid_result'),
  )
})

test('Gemini rejects false MIME, invalid base64 and malformed or unsupported audio containers', async () => {
  const truncated = wav().subarray(0, 80)
  const wrongRate = wav(16_000)
  const cases = [
    audioResult(wav(), 'text/plain'),
    audioResult(Buffer.from('ID3not-a-wave'), 'audio/wav'),
    audioResult(truncated),
    audioResult(wrongRate),
    audioResult(Buffer.from([1, 2, 3]), 'audio/L16;codec=pcm;rate=24000'),
    audioResult(wav().subarray(44), 'audio/L16;codec=pcm;rate=8000'),
    envelope([{ inlineData: { mimeType: 'audio/wav', data: 'not valid base64!!!' } }]),
  ]
  for (const value of cases) {
    const provider = createGeminiSpeakingProvider(config(), async () => response(value))
    await assert.rejects(
      provider.speak('Question.', signal()),
      errorCode('speaking_invalid_result'),
    )
  }
})

test('Gemini bounds streamed provider output and cancels the oversized response', async () => {
  let cancelled = false
  let reads = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads++
      controller.enqueue(new Uint8Array(128 * 1024))
    },
    cancel() {
      cancelled = true
    },
  })
  const provider = createGeminiSpeakingProvider(config(), async () => new Response(stream))
  await assert.rejects(
    provider.transcribe(wav(16_000), signal()),
    errorCode('speaking_invalid_result'),
  )
  assert.equal(cancelled, true)
  assert.ok(reads <= 4)
})

test('Gemini errors never expose provider messages or retry requests', async () => {
  for (const [status, expected, detail] of [
    [401, 'speaking_provider_auth', undefined],
    [403, 'speaking_provider_auth', undefined],
    [400, 'speaking_provider_auth', 'API_KEY_INVALID'],
    [429, 'speaking_provider_busy', undefined],
    [503, 'speaking_provider_busy', undefined],
    [400, 'speaking_provider_error', undefined],
  ] as const) {
    let calls = 0
    const provider = createGeminiSpeakingProvider(config(), async () => {
      calls++
      return response(
        { error: { message: 'PRIVATE_KEY_AND_RECORDING', details: [{ reason: detail }] } },
        status,
      )
    })
    await assert.rejects(provider.speak('Question.', signal()), (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.code, expected)
      assert.equal(error.message.includes('PRIVATE_KEY_AND_RECORDING'), false)
      return true
    })
    assert.equal(calls, 1)
  }
  const network = createGeminiSpeakingProvider(config(), async () => {
    throw new Error('PRIVATE_KEY_AND_RECORDING')
  })
  await assert.rejects(network.speak('Question.', signal()), (error: unknown) => {
    assert.ok(error instanceof HttpError)
    assert.equal(error.message.includes('PRIVATE_KEY_AND_RECORDING'), false)
    return true
  })
})

test('Gemini fails closed without enabled configuration, on expiry, or before aborted calls', async () => {
  let calls = 0
  const request: typeof fetch = async () => {
    calls++
    return response(audioResult())
  }
  for (const [overrides, expected] of [
    [{ enabled: false }, 'speaking_unconfigured'],
    [{ apiKey: '' }, 'speaking_unconfigured'],
    [{ provider: 'openai' as const }, 'speaking_unconfigured'],
    [{ expiresAt: '2000-01-01T00:00:00.000Z' }, 'speaking_expired'],
    [{ speechModel: '../../private' }, 'speaking_invalid_result'],
  ] as const) {
    const provider = createGeminiSpeakingProvider({ ...config(), ...overrides }, request)
    await assert.rejects(provider.speak('Question.', signal()), errorCode(expected))
  }
  const provider = createGeminiSpeakingProvider(config(), request)
  await assert.rejects(
    provider.speak('Question.', AbortSignal.abort()),
    errorCode('speaking_provider_error'),
  )
  await assert.rejects(provider.transcribe(Buffer.from('not WAV'), signal()))
  assert.equal(calls, 0)
})
