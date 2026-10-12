import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadPortalData, portalDemoData } from '../src/features/learning/data.ts'
import {
  createInitialPortalState,
  createLearningStore,
  getPreparation,
  MAX_DRAFT_LENGTH,
  MAX_WORDS,
  parsePortalState,
  PORTAL_STORAGE_KEY,
  readPortalStorage,
  reducePortalAction,
} from '../src/features/learning/model.ts'
import type { PortalStorage } from '../src/features/learning/model.ts'
import type { VocabularyWord } from '../src/features/learning/types.ts'

function memoryStorage(initial?: string): PortalStorage & { values: Map<string, string> } {
  const values = new Map<string, string>(
    initial === undefined ? [] : [[PORTAL_STORAGE_KEY, initial]],
  )
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

test('sample data has four skills, two preparation requirements and independent loads', async () => {
  const data = await loadPortalData()
  assert.equal(data.assignments.length, 4)
  assert.deepEqual(
    data.assignments.filter((assignment) => assignment.required).map((assignment) => assignment.id),
    ['reading-01', 'writing-01'],
  )
  data.assignments.length = 0
  assert.equal((await loadPortalData()).assignments.length, 4)
  assert.equal(portalDemoData.sessions.length, 3)
  assert.equal(portalDemoData.slots.length, 4)
})

test('reservation is available before preparation; access readiness requires both real demo submissions', () => {
  const store = createLearningStore(memoryStorage())
  assert.deepEqual(getPreparation(store.getSnapshot().state, portalDemoData), {
    required: 2,
    submitted: 0,
    ready: false,
  })
  assert.equal(store.actions.bookSlot('slot-01'), true)
  assert.equal(store.getSnapshot().state.bookingSlotId, 'slot-01')
  assert.equal(store.actions.submitAssignment('reading-01'), false)
  assert.equal(store.actions.saveDraft('reading-01', '   '), true)
  assert.equal(store.actions.submitAssignment('reading-01'), false)
  assert.equal(store.actions.saveDraft('reading-01', 'The learner reviews their notes.'), true)
  assert.equal(store.actions.submitAssignment('reading-01'), true)
  assert.deepEqual(getPreparation(store.getSnapshot().state, portalDemoData), {
    required: 2,
    submitted: 1,
    ready: false,
  })
  assert.equal(store.actions.saveDraft('writing-01', 'A quiet space helps me concentrate.'), true)
  assert.equal(store.actions.submitAssignment('writing-01'), true)
  assert.equal(getPreparation(store.getSnapshot().state, portalDemoData).ready, true)
  assert.equal(store.getSnapshot().state.bookingSlotId, 'slot-01')
  assert.equal(store.actions.saveDraft('writing-01', 'A revised paragraph.'), true)
  assert.equal(getPreparation(store.getSnapshot().state, portalDemoData).ready, false)
})

test('unavailable audio tasks, unknown assignments and oversized drafts cannot submit', () => {
  const store = createLearningStore(memoryStorage())
  for (const id of ['listening-01', 'speaking-01', 'not-an-assignment', '__proto__']) {
    assert.equal(store.actions.saveDraft(id, 'Text'), false)
    assert.equal(store.actions.submitAssignment(id), false)
  }
  assert.equal(store.actions.saveDraft('reading-01', 'x'.repeat(MAX_DRAFT_LENGTH + 1)), false)
  assert.equal(store.actions.saveDraft('reading-01', 42 as unknown as string), false)
  assert.deepEqual(store.getSnapshot().state.drafts, {})
})

test('booking rejects unknown and overlapping slots; all sample slots avoid main classes', () => {
  const state = createInitialPortalState()
  assert.equal(reducePortalAction(state, { type: 'bookSlot', slotId: 'unknown' }), null)
  for (const slot of portalDemoData.slots)
    assert.ok(reducePortalAction(state, { type: 'bookSlot', slotId: slot.id }))
  const data = structuredClone(portalDemoData)
  data.slots.push({
    id: 'overlap',
    start: '2026-10-12T19:30:00+07:00',
    end: '2026-10-12T20:00:00+07:00',
    host: { vi: 'Mẫu', en: 'Demo' },
  })
  assert.equal(reducePortalAction(state, { type: 'bookSlot', slotId: 'overlap' }, data), null)
  const store = createLearningStore(memoryStorage())
  store.actions.bookSlot('slot-01')
  assert.equal(store.actions.cancelBooking(), true)
  assert.equal(store.getSnapshot().state.bookingSlotId, null)
})

test('corrupt storage, unknown versions and malformed draft containers recover safely', () => {
  for (const raw of [
    '{broken',
    'null',
    '[]',
    'x'.repeat(500_001),
    JSON.stringify({ ...createInitialPortalState(), version: 2 }),
    JSON.stringify({ ...createInitialPortalState(), drafts: [] }),
  ]) {
    const snapshot = readPortalStorage(memoryStorage(raw))
    assert.equal(snapshot.storageError, true)
    assert.deepEqual(snapshot.state, createInitialPortalState())
  }
  const malformed = JSON.stringify({
    ...createInitialPortalState(),
    drafts: { 'reading-01': { text: 'bad' }, 'writing-01': 'valid', unknown: 'unrecognized' },
    submittedIds: ['reading-01', 'writing-01', 'writing-01', 'speaking-01', 3],
    bookingSlotId: 'unknown',
  })
  const parsed = parsePortalState(malformed)
  assert.deepEqual(parsed?.drafts, { 'writing-01': 'valid' })
  assert.deepEqual(parsed?.submittedIds, ['writing-01'])
  assert.equal(parsed?.bookingSlotId, null)
})

test('repeat submissions and vocabulary additions stay unique across storage reloads', () => {
  const storage = memoryStorage()
  const store = createLearningStore(storage)
  store.actions.saveDraft('reading-01', 'My answer')
  store.actions.submitAssignment('reading-01')
  store.actions.submitAssignment('reading-01')
  const word = {
    id: 'word-review',
    word: 'review',
    meaning: { vi: 'ôn tập', en: 'to study something again' },
    example: '',
    topic: { vi: '', en: '' },
  }
  assert.equal(store.actions.addWord(word), true)
  assert.equal(store.actions.addWord(word), true)
  assert.equal(store.actions.addWord({ ...word, id: 'another-id', word: ' REVIEW ' }), true)
  const recovered = createLearningStore(storage).getSnapshot().state
  assert.deepEqual(recovered.submittedIds, ['reading-01'])
  assert.equal(recovered.words.length, 3)
})

test('vocabulary validation rejects malformed entries and enforces a size cap', () => {
  const state = createInitialPortalState()
  assert.equal(
    reducePortalAction(state, {
      type: 'addWord',
      word: { id: 'x', word: 'test' } as VocabularyWord,
    }),
    null,
  )
  const rawWords = Array.from({ length: MAX_WORDS + 10 }, (_, index) => ({
    ...state.words[0]!,
    id: `word-${index}`,
    word: `word ${index}`,
  }))
  const parsed = parsePortalState(JSON.stringify({ ...state, words: [...rawWords, { id: 'bad' }] }))
  assert.equal(parsed?.words.length, MAX_WORDS)
  assert.equal(reducePortalAction(parsed!, { type: 'addWord', word: state.words[1]! }), null)
})

test('failed drafts remain in memory but failed submission cannot change readiness; successful retry recovers', () => {
  let fail = true
  const storage = memoryStorage()
  const store = createLearningStore({
    getItem: storage.getItem,
    setItem: (key, value) => {
      if (fail) throw new Error('quota')
      storage.setItem(key, value)
    },
  })
  assert.equal(store.actions.saveDraft('writing-01', 'Keep this paragraph.'), false)
  assert.equal(store.getSnapshot().state.drafts['writing-01'], 'Keep this paragraph.')
  assert.equal(store.getSnapshot().storageError, true)
  assert.equal(store.actions.submitAssignment('writing-01'), false)
  assert.deepEqual(store.getSnapshot().state.submittedIds, [])
  assert.equal(getPreparation(store.getSnapshot().state, portalDemoData).submitted, 0)
  assert.equal(store.getSnapshot().state.drafts['writing-01'], 'Keep this paragraph.')
  assert.equal(store.getSnapshot().storageError, true)
  fail = false
  assert.equal(store.actions.submitAssignment('writing-01'), true)
  assert.equal(store.getSnapshot().storageError, false)
  assert.deepEqual(createLearningStore(storage).getSnapshot().state.submittedIds, ['writing-01'])
})

test('failed reservation, rescheduling and cancellation leave the existing booking unchanged', () => {
  let fail = true
  const storage = memoryStorage()
  const store = createLearningStore({
    getItem: storage.getItem,
    setItem: (key, value) => {
      if (fail) throw new Error('quota')
      storage.setItem(key, value)
    },
  })
  assert.equal(store.actions.bookSlot('slot-01'), false)
  assert.equal(store.getSnapshot().state.bookingSlotId, null)
  assert.equal(store.getSnapshot().storageError, true)
  fail = false
  assert.equal(store.actions.bookSlot('slot-01'), true)
  assert.equal(store.getSnapshot().storageError, false)
  fail = true
  assert.equal(store.actions.bookSlot('slot-02'), false)
  assert.equal(store.getSnapshot().state.bookingSlotId, 'slot-01')
  assert.equal(store.actions.cancelBooking(), false)
  assert.equal(store.getSnapshot().state.bookingSlotId, 'slot-01')
  assert.equal(store.getSnapshot().storageError, true)
  assert.equal(createLearningStore(storage).getSnapshot().state.bookingSlotId, 'slot-01')
  fail = false
  assert.equal(store.actions.cancelBooking(), true)
  assert.equal(store.getSnapshot().state.bookingSlotId, null)
  assert.equal(store.getSnapshot().storageError, false)
  assert.equal(createLearningStore(storage).getSnapshot().state.bookingSlotId, null)
})

test('failed vocabulary changes and reset preserve all prior state until a successful write', () => {
  let fail = false
  const storage = memoryStorage()
  const store = createLearningStore({
    getItem: storage.getItem,
    setItem: (key, value) => {
      if (fail) throw new Error('quota')
      storage.setItem(key, value)
    },
  })
  store.actions.saveDraft('reading-01', 'Previously saved answer.')
  store.actions.submitAssignment('reading-01')
  store.actions.bookSlot('slot-01')
  const before = structuredClone(store.getSnapshot().state)
  const word: VocabularyWord = {
    id: 'word-review',
    word: 'review',
    meaning: { vi: 'ôn tập', en: 'to study something again' },
    example: '',
    topic: { vi: '', en: '' },
  }
  fail = true
  assert.equal(store.actions.addWord(word), false)
  assert.deepEqual(store.getSnapshot().state, before)
  assert.equal(store.getSnapshot().storageError, true)
  assert.equal(store.actions.removeWord('word-curriculum'), false)
  assert.deepEqual(store.getSnapshot().state, before)
  assert.equal(store.getSnapshot().storageError, true)
  assert.equal(store.actions.reset(), false)
  assert.deepEqual(store.getSnapshot().state, before)
  assert.equal(store.getSnapshot().storageError, true)
  assert.deepEqual(createLearningStore(storage).getSnapshot().state, before)
  fail = false
  assert.equal(store.actions.addWord(word), true)
  assert.equal(store.getSnapshot().storageError, false)
  assert.equal(store.getSnapshot().state.words.length, before.words.length + 1)
  assert.equal(store.actions.removeWord('word-curriculum'), true)
  assert.equal(
    store.getSnapshot().state.words.some((entry) => entry.id === 'word-curriculum'),
    false,
  )
  assert.equal(store.actions.reset(), true)
  assert.deepEqual(createLearningStore(storage).getSnapshot().state, createInitialPortalState())
})

test('inaccessible storage is safe and reset only replaces this preview key', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
  assert.equal(readPortalStorage(broken).storageError, true)
  const transient = createLearningStore(null)
  assert.equal(transient.actions.bookSlot('slot-01'), false)
  assert.equal(transient.getSnapshot().state.bookingSlotId, null)
  assert.equal(transient.getSnapshot().storageError, true)
  const storage = memoryStorage()
  storage.values.set('unrelated-preference', 'preserve')
  const store = createLearningStore(storage)
  store.actions.saveDraft('reading-01', 'An answer')
  store.actions.reset()
  assert.deepEqual(store.getSnapshot().state, createInitialPortalState())
  assert.equal(storage.values.get('unrelated-preference'), 'preserve')
})

test('explicit text response mode supports custom tasks and all skills without implying audio support', () => {
  const data = structuredClone(portalDemoData)
  data.assignments = data.assignments.map((assignment) => ({
    ...assignment,
    id: `custom-${assignment.skill}`,
    responseMode: 'text',
  }))
  const storage = memoryStorage()
  const store = createLearningStore(storage, data)
  for (const assignment of data.assignments) {
    assert.equal(store.actions.saveDraft(assignment.id, `Text for ${assignment.skill}`), true)
    assert.equal(store.actions.submitAssignment(assignment.id), true)
  }
  const restored = createLearningStore(storage, data).getSnapshot().state
  assert.equal(restored.submittedIds.length, 4)
  assert.equal(restored.drafts['custom-speaking'], 'Text for speaking')
  assert.equal(restored.drafts['custom-listening'], 'Text for listening')
})

test('saved custom drafts survive a changing catalog and unrelated vocabulary writes', () => {
  const data = structuredClone(portalDemoData)
  data.assignments.push({ ...data.assignments[0]!, id: 'task-custom', responseMode: 'text' })
  const storage = memoryStorage()
  const store = createLearningStore(storage, data)
  assert.equal(store.actions.saveDraft('task-custom', 'Keep my custom task answer.'), true)
  const withoutCustomTask = createLearningStore(storage)
  assert.equal(
    withoutCustomTask.getSnapshot().state.drafts['task-custom'],
    'Keep my custom task answer.',
  )
  assert.equal(withoutCustomTask.actions.submitAssignment('task-custom'), false)
  assert.equal(withoutCustomTask.actions.removeWord('word-curriculum'), true)
  const recovered = createLearningStore(storage, data)
  assert.equal(recovered.getSnapshot().state.drafts['task-custom'], 'Keep my custom task answer.')
  assert.equal(recovered.actions.submitAssignment('task-custom'), true)
})

test('catalog updates retain unsaved text in memory while admitting newly published tasks', () => {
  const data = structuredClone(portalDemoData)
  data.assignments.push({ ...data.assignments[0]!, id: 'task-new', responseMode: 'text' })
  const storage = memoryStorage()
  let fail = true
  const store = createLearningStore({
    getItem: storage.getItem,
    setItem: (key, value) => {
      if (fail) throw new Error('Quota')
      storage.setItem(key, value)
    },
  })
  assert.equal(store.actions.saveDraft('writing-01', 'Unsaved typed answer'), false)
  store.updateData(data)
  assert.equal(store.getSnapshot().state.drafts['writing-01'], 'Unsaved typed answer')
  assert.equal(store.getSnapshot().storageError, true)
  assert.equal(store.actions.saveDraft('task-new', 'New task answer'), false)
  fail = false
  assert.equal(store.actions.submitAssignment('task-new'), true)
  const restored = createLearningStore(storage, data).getSnapshot().state
  assert.equal(restored.drafts['writing-01'], 'Unsaved typed answer')
  assert.equal(restored.drafts['task-new'], 'New task answer')
})
