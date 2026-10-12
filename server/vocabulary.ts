import type { Account, Assignment, VocabularySource, Word } from '../shared/portal.ts'
import { initialVocabularyPractice, nextVocabularyReview } from '../shared/vocabulary.ts'
import {
  all,
  authenticated,
  classroom,
  current,
  enumValue,
  fail,
  get,
  integer,
  now,
  put,
  remove,
  role,
  str,
  type Database,
  type Payload,
} from './domain-store.ts'

type StoredWord = Omit<Word, 'practice'> & { ownerId: string; practice?: Word['practice'] }

function sourceForWord(
  db: Database,
  actor: Account,
  p: Payload,
  previous: StoredWord | undefined,
): VocabularySource | undefined {
  if (p.sourceAssignmentId === undefined) {
    if (p.sourceAssignmentVersion !== undefined || p.sourceContext !== undefined)
      fail(400, 'invalid_payload', 'Provide an assignment identifier for the vocabulary source.')
    return previous?.source
  }
  role(actor, ['student'])
  const assignmentId = str(p, 'sourceAssignmentId', 150)
  const assignment = get<Assignment>(db, 'assignment', assignmentId)
  if (!assignment || !assignment.published)
    fail(404, 'not_found', 'The source assignment is unavailable.')
  classroom(db, actor, assignment!.classId)
  const assignmentVersion = integer(p, 'sourceAssignmentVersion', 1)
  if (assignment!.version !== assignmentVersion)
    fail(
      409,
      'conflict',
      'The source assignment changed. Check the current text before saving the word.',
    )
  const context = str(p, 'sourceContext', 2000, true)
  if (
    context &&
    !assignment!.instructions.vi.includes(context) &&
    !assignment!.instructions.en.includes(context)
  )
    fail(400, 'invalid_payload', 'Vocabulary context must match text in the source assignment.')
  return {
    assignmentId,
    assignmentVersion,
    classId: assignment!.classId,
    skill: assignment!.skill,
    title: assignment!.title,
    context,
  }
}

export function saveWord(db: Database, suppliedActor: Account, p: Payload): string {
  const actor = authenticated(db, suppliedActor)
  if (p.id !== undefined && get<StoredWord>(db, 'word', str(p, 'id', 150))?.ownerId !== actor.id)
    fail(404, 'not_found', 'The word is unavailable.')
  const record = current<StoredWord>(db, 'word', p)
  const word = str(p, 'word', 150)
  const meaning = str(p, 'meaning', 2000)
  if (
    !record.previous &&
    actor.role === 'student' &&
    all<StoredWord>(db, 'word').some(
      (saved) =>
        saved.ownerId === actor.id &&
        saved.word.trim().toLowerCase() === word.trim().toLowerCase() &&
        saved.meaning.trim().toLowerCase() === meaning.trim().toLowerCase(),
    )
  )
    fail(409, 'duplicate_word', 'This word and meaning are already in your vocabulary notebook.')
  const resetPractice = record.previous?.word !== word || record.previous?.meaning !== meaning
  const source = sourceForWord(db, actor, p, record.previous)
  put<StoredWord>(db, 'word', {
    id: record.key,
    version: record.version,
    ownerId: actor.id,
    word,
    meaning,
    example: str(p, 'example', 3000, true),
    topic: str(p, 'topic', 150, true),
    practice: resetPractice
      ? initialVocabularyPractice()
      : (record.previous?.practice ?? initialVocabularyPractice()),
    ...(source ? { source } : {}),
  })
  return record.key
}

export function reviewWord(db: Database, actor: Account, p: Payload): string {
  role(actor, ['student'])
  const key = str(p, 'id', 150)
  const word = get<StoredWord>(db, 'word', key)
  if (!word || word.ownerId !== actor.id) fail(404, 'not_found', 'The word is unavailable.')
  if (word!.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This word changed. Reload it before reviewing.')
  const rating = enumValue(p, 'rating', ['again', 'hard', 'good', 'easy'] as const)
  put<StoredWord>(db, 'word', {
    ...word!,
    version: word!.version + 1,
    practice: nextVocabularyReview(word!.practice ?? initialVocabularyPractice(), rating, now()),
  })
  return key
}

export function deleteWord(db: Database, actor: Account, p: Payload): string {
  const key = str(p, 'id', 150)
  const word = get<StoredWord>(db, 'word', key)
  if (!word || word.ownerId !== actor.id) fail(404, 'not_found', 'The word is unavailable.')
  if (word!.version !== integer(p, 'expectedVersion', 1))
    fail(409, 'conflict', 'This word changed. Reload it before deleting.')
  remove(db, 'word', key)
  return key
}

export function visibleWords(db: Database, actor: Account): Word[] {
  return all<StoredWord>(db, 'word')
    .filter((word) => word.ownerId === actor.id)
    .map(({ id, word, meaning, example, topic, version, practice, source }) => ({
      id,
      word,
      meaning,
      example,
      topic,
      version,
      practice: practice ?? initialVocabularyPractice(),
      ...(source && actor.role === 'student' ? { source } : {}),
    }))
}
