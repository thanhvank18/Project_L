import { demoVocabulary, portalDemoData } from './data.ts'
import type { LearningActions, PortalData, PortalState, VocabularyWord } from './types.ts'

export const PORTAL_STORAGE_KEY = 'project-l.learning-demo.v1'
export const MAX_DRAFT_LENGTH = 20_000
export const MAX_WORDS = 100
const MAX_STORAGE_LENGTH = 500_000

export interface PortalStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface PortalSnapshot {
  state: PortalState
  storageError: boolean
}

export type PortalAction =
  | { type: 'saveDraft'; assignmentId: string; text: string }
  | { type: 'submitAssignment'; assignmentId: string }
  | { type: 'bookSlot'; slotId: string }
  | { type: 'cancelBooking' }
  | { type: 'addWord'; word: VocabularyWord }
  | { type: 'removeWord'; id: string }
  | { type: 'reset' }

export function createInitialPortalState(): PortalState {
  return {
    version: 1,
    drafts: {},
    submittedIds: [],
    bookingSlotId: null,
    words: structuredClone(demoVocabulary),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    (allowEmpty || value.trim().length > 0)
  )
}

function validLocalizedText(value: unknown, maxLength: number, allowEmpty = false) {
  return (
    isRecord(value) &&
    validText(value.vi, maxLength, allowEmpty) &&
    validText(value.en, maxLength, allowEmpty)
  )
}

function cleanWord(value: unknown): VocabularyWord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value.id) ||
    !validText(value.word, 80) ||
    !validLocalizedText(value.meaning, 300) ||
    !validText(value.example, 500, true) ||
    !validLocalizedText(value.topic, 80, true)
  ) {
    return null
  }
  const meaning = value.meaning as VocabularyWord['meaning']
  const topic = value.topic as VocabularyWord['topic']
  return {
    id: value.id,
    word: value.word.trim(),
    meaning: { vi: meaning.vi.trim(), en: meaning.en.trim() },
    example: value.example.trim(),
    topic: { vi: topic.vi.trim(), en: topic.en.trim() },
  }
}

function wordIdentity(word: string) {
  return word.trim().normalize('NFKC').toLowerCase()
}

function canWrite(assignmentId: string, data: PortalData) {
  return data.assignments.some(
    (assignment) =>
      assignment.id === assignmentId &&
      (assignment.skill === 'reading' ||
        assignment.skill === 'writing' ||
        assignment.responseMode === 'text'),
  )
}

function validAssignmentId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value)
}

function isBookableSlot(slotId: string, data: PortalData) {
  const slot = data.slots.find((entry) => entry.id === slotId)
  if (!slot) return false
  const start = Date.parse(slot.start)
  const end = Date.parse(slot.end)
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start < end &&
    !data.sessions.some((session) => {
      const sessionStart = Date.parse(session.start)
      const sessionEnd = Date.parse(session.end)
      return start < sessionEnd && end > sessionStart
    })
  )
}

export function getPreparation(state: PortalState, data: PortalData) {
  const requiredIds = data.assignments
    .filter((assignment) => assignment.required)
    .map((assignment) => assignment.id)
  const submitted = requiredIds.filter((id) => state.submittedIds.includes(id)).length
  return { required: requiredIds.length, submitted, ready: submitted === requiredIds.length }
}

export function parsePortalState(
  raw: string,
  data: PortalData = portalDemoData,
): PortalState | null {
  if (raw.length > MAX_STORAGE_LENGTH) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.drafts) ||
    !Array.isArray(value.submittedIds) ||
    !Array.isArray(value.words) ||
    (value.bookingSlotId !== null && typeof value.bookingSlotId !== 'string')
  )
    return null

  const retainedIds = Array.isArray(value.draftTaskIds)
    ? [...new Set(value.draftTaskIds.filter(validAssignmentId))].slice(0, 500)
    : []
  const retained = new Set(retainedIds)
  const drafts: Record<string, string> = {}
  for (const [id, draft] of Object.entries(value.drafts)) {
    if (
      validAssignmentId(id) &&
      (canWrite(id, data) || retained.has(id)) &&
      validText(draft, MAX_DRAFT_LENGTH, true)
    )
      drafts[id] = draft
  }
  const submittedIds = [
    ...new Set(
      value.submittedIds.filter(
        (id): id is string =>
          typeof id === 'string' && canWrite(id, data) && Boolean(drafts[id]?.trim()),
      ),
    ),
  ]
  const words: VocabularyWord[] = []
  const wordIds = new Set<string>()
  const identities = new Set<string>()
  for (const entry of value.words) {
    if (words.length >= MAX_WORDS) break
    const word = cleanWord(entry)
    if (word && !wordIds.has(word.id) && !identities.has(wordIdentity(word.word))) {
      words.push(word)
      wordIds.add(word.id)
      identities.add(wordIdentity(word.word))
    }
  }
  return {
    version: 1,
    drafts,
    ...(retainedIds.length ? { draftTaskIds: retainedIds } : {}),
    submittedIds,
    bookingSlotId:
      typeof value.bookingSlotId === 'string' && isBookableSlot(value.bookingSlotId, data)
        ? value.bookingSlotId
        : null,
    words,
  }
}

export function readPortalStorage(
  storage: PortalStorage | null,
  data: PortalData = portalDemoData,
): PortalSnapshot {
  const fallback = () => ({ state: createInitialPortalState(), storageError: true })
  if (!storage) return fallback()
  try {
    const raw = storage.getItem(PORTAL_STORAGE_KEY)
    if (raw === null) return { state: createInitialPortalState(), storageError: false }
    const state = parsePortalState(raw, data)
    return state ? { state, storageError: false } : fallback()
  } catch {
    return fallback()
  }
}

export function reducePortalAction(
  state: PortalState,
  action: PortalAction,
  data: PortalData = portalDemoData,
): PortalState | null {
  switch (action.type) {
    case 'saveDraft': {
      if (!canWrite(action.assignmentId, data) || !validText(action.text, MAX_DRAFT_LENGTH, true))
        return null
      if (state.drafts[action.assignmentId] === action.text) return state
      return {
        ...state,
        drafts: { ...state.drafts, [action.assignmentId]: action.text },
        draftTaskIds: [...new Set([...(state.draftTaskIds ?? []), action.assignmentId])],
        submittedIds: state.submittedIds.filter((id) => id !== action.assignmentId),
      }
    }
    case 'submitAssignment': {
      if (!canWrite(action.assignmentId, data) || !state.drafts[action.assignmentId]?.trim())
        return null
      if (state.submittedIds.includes(action.assignmentId)) return state
      return { ...state, submittedIds: [...state.submittedIds, action.assignmentId] }
    }
    case 'bookSlot':
      // Reserving a sample slot is allowed before preparation is complete.
      // The UI uses getPreparation for access messaging; no meeting link exists.
      return isBookableSlot(action.slotId, data) ? { ...state, bookingSlotId: action.slotId } : null
    case 'cancelBooking':
      return { ...state, bookingSlotId: null }
    case 'addWord': {
      const word = cleanWord(action.word)
      if (!word) return null
      if (
        state.words.some(
          (entry) => entry.id === word.id || wordIdentity(entry.word) === wordIdentity(word.word),
        )
      )
        return state
      if (state.words.length >= MAX_WORDS) return null
      return { ...state, words: [...state.words, word] }
    }
    case 'removeWord':
      if (!state.words.some((word) => word.id === action.id)) return null
      return { ...state, words: state.words.filter((word) => word.id !== action.id) }
    case 'reset':
      return createInitialPortalState()
  }
}

export function createLearningStore(
  storage: PortalStorage | null,
  data: PortalData = portalDemoData,
) {
  let snapshot = readPortalStorage(storage, data)
  let currentData = data
  const listeners = new Set<() => void>()
  const dispatch = (action: PortalAction) => {
    const state = reducePortalAction(snapshot.state, action, currentData)
    if (!state) return false
    let storageError = false
    try {
      if (!storage) throw new Error('Local storage is unavailable')
      const serialized = JSON.stringify(state)
      if (serialized.length > MAX_STORAGE_LENGTH) throw new Error('Preview exceeds limit')
      storage.setItem(PORTAL_STORAGE_KEY, serialized)
    } catch {
      storageError = true
    }
    // Preserve text that a learner has typed, even when a draft cannot be saved.
    // Other actions become visible only after persistence succeeds.
    snapshot = {
      state: storageError && action.type !== 'saveDraft' ? snapshot.state : state,
      storageError,
    }
    listeners.forEach((listener) => listener())
    return !storageError
  }
  const actions: LearningActions = {
    saveDraft: (assignmentId, text) => dispatch({ type: 'saveDraft', assignmentId, text }),
    submitAssignment: (assignmentId) => dispatch({ type: 'submitAssignment', assignmentId }),
    bookSlot: (slotId) => dispatch({ type: 'bookSlot', slotId }),
    cancelBooking: () => dispatch({ type: 'cancelBooking' }),
    addWord: (word) => dispatch({ type: 'addWord', word }),
    removeWord: (id) => dispatch({ type: 'removeWord', id }),
    reset: () => dispatch({ type: 'reset' }),
  }
  return {
    actions,
    updateData: (nextData: PortalData) => {
      currentData = nextData
    },
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
