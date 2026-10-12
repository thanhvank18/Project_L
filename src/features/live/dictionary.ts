export interface DictionaryMeaning {
  part: string
  definition: string
  example: string
}
export interface DictionaryEntry {
  word: string
  phonetic: string
  meanings: DictionaryMeaning[]
  sources: string[]
  licenses: { name: string; url: string }[]
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown, max = 2000) => (typeof value === 'string' ? value.slice(0, max) : '')
function safeLink(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
export function parseDictionary(value: unknown, word: string): DictionaryEntry {
  const entries = Array.isArray(value) ? value.slice(0, 4).map(record) : []
  const meanings: DictionaryMeaning[] = []
  const sources = new Set<string>()
  const licenses = new Map<string, string>()
  const seen = new Set<string>()
  for (const entry of entries) {
    for (const source of Array.isArray(entry.sourceUrls) ? entry.sourceUrls : []) {
      const url = safeLink(source)
      if (url) sources.add(url)
    }
    const license = record(entry.license)
    const licenseUrl = safeLink(license.url)
    if (licenseUrl && typeof license.name === 'string')
      licenses.set(licenseUrl, text(license.name, 100))
    for (const raw of Array.isArray(entry.meanings) ? entry.meanings : []) {
      const meaning = record(raw)
      for (const rawDefinition of Array.isArray(meaning.definitions) ? meaning.definitions : []) {
        const definition = record(rawDefinition)
        const detail = text(definition.definition).trim()
        const part = text(meaning.partOfSpeech, 40).trim()
        const key = `${part.toLowerCase()}\n${detail.toLowerCase()}`
        if (!detail || meanings.length >= 6 || seen.has(key)) continue
        seen.add(key)
        meanings.push({
          part,
          definition: detail,
          example: text(definition.example).trim(),
        })
      }
    }
  }
  if (!meanings.length) throw new Error('dictionary-empty')
  return {
    word,
    phonetic: text(entries[0]?.phonetic, 150),
    meanings,
    sources: [...sources].slice(0, 4),
    licenses: [...licenses].map(([url, name]) => ({ name, url })),
  }
}
export async function lookupDictionary(
  word: string,
  signal: AbortSignal,
): Promise<DictionaryEntry> {
  const query = word.trim()
  if (!/^[a-zA-Z][a-zA-Z '-]{0,79}$/.test(query)) throw new Error('dictionary-query')
  signal.throwIfAborted()
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`,
    { signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' },
  )
  if (response.status === 404) throw new Error('dictionary-empty')
  if (!response.ok || !response.body) throw new Error('dictionary-service')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      signal.throwIfAborted()
      if (next.done) break
      size += next.value.byteLength
      if (size > 256 * 1024) throw new Error('dictionary-service')
      chunks.push(next.value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  signal.throwIfAborted()
  return parseDictionary(JSON.parse(new TextDecoder().decode(bytes)), query)
}
