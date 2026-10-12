import { createHash } from 'node:crypto'
import type {
  Account,
  Assignment,
  StudyAnnotation,
  StudyMapNode,
  StudyStroke,
  StudyWorkspace,
} from '../shared/portal.ts'
import { studyLimits } from '../shared/study.ts'
import { readingLimits } from '../shared/reading.ts'
import {
  all,
  authenticated,
  classroom,
  enumValue,
  fail,
  get,
  integer,
  now,
  put,
  role,
  str,
  type Database,
  type Payload,
} from './domain-store.ts'

function object(value: unknown, field: string): Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(400, 'invalid_study', `${field} must be an object.`)
  return value as Payload
}

function list(value: unknown, field: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    fail(400, 'invalid_study', `${field} must be a list with at most ${maximum} entries.`)
  return value as unknown[]
}

function entryId(p: Payload, ids: Set<string>): string {
  const value = str(p, 'id', studyLimits.idLength)
  if (!/^[A-Za-z0-9_-]+$/.test(value) || ids.has(value))
    fail(
      400,
      'invalid_study',
      'Study entry identifiers must be valid and unique within their list.',
    )
  ids.add(value)
  return value
}

function textBoundary(text: string, offset: number): boolean {
  if (offset === 0 || offset === text.length) return true
  const previous = text.charCodeAt(offset - 1)
  const current = text.charCodeAt(offset)
  return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff)
}

function annotations(value: unknown, assignment: Assignment): StudyAnnotation[] {
  const values = list(value, 'annotations', studyLimits.annotations)
  if (values.length && assignment.skill !== 'reading' && assignment.skill !== 'listening')
    fail(
      400,
      'invalid_study',
      'Prompt annotations are supported for Reading and Listening assignments.',
    )
  const ids = new Set<string>()
  return values.map((value) => {
    const p = object(value, 'annotation')
    const id = entryId(p, ids)
    const locale = enumValue(p, 'locale', ['vi', 'en'] as const)
    const prompt = assignment.instructions[locale]
    const start = integer(p, 'start', 0, prompt.length)
    const end = integer(p, 'end', 1, prompt.length)
    const quote = str(p, 'quote', studyLimits.annotationQuote)
    if (
      start >= end ||
      !textBoundary(prompt, start) ||
      !textBoundary(prompt, end) ||
      prompt.slice(start, end) !== quote
    )
      fail(400, 'invalid_study', 'An annotation must match its exact prompt range and language.')
    return { id, locale, start, end, quote, note: str(p, 'note', studyLimits.annotationNote, true) }
  })
}

function readingReview(
  value: unknown,
  assignment: Assignment,
): NonNullable<StudyWorkspace['readingReview']> {
  if (!['reading', 'listening'].includes(assignment.skill) || !assignment.reading)
    fail(400, 'invalid_study', 'Review markers require structured Reading or Listening questions.')
  const p = object(value, 'readingReview')
  const ids = list(p.flaggedQuestionIds, 'readingReview.flaggedQuestionIds', readingLimits.slots)
  const known = new Set(
    assignment.reading!.groups.flatMap((group) => group.questions.map((question) => question.id)),
  )
  if (
    ids.some((id) => typeof id !== 'string' || !known.has(id)) ||
    new Set(ids).size !== ids.length
  )
    fail(400, 'invalid_study', 'Review markers must identify distinct current questions.')
  return { flaggedQuestionIds: ids as string[] }
}

function nodes(value: unknown): StudyMapNode[] {
  const ids = new Set<string>()
  const result = list(value, 'mindMap.nodes', studyLimits.nodes).map((value) => {
    const p = object(value, 'node')
    return {
      id: entryId(p, ids),
      parentId: p.parentId === null ? null : str(p, 'parentId', studyLimits.idLength),
      text: str(p, 'text', studyLimits.nodeText),
    }
  })
  if (!result.length) return result
  if (result.filter((node) => node.parentId === null).length !== 1)
    fail(400, 'invalid_study', 'A mind map must have exactly one root node.')
  const byId = new Map(result.map((node) => [node.id, node]))
  for (const node of result) {
    let parentId = node.parentId
    const visited = new Set([node.id])
    while (parentId !== null) {
      const parent = byId.get(parentId)
      if (!parent || visited.has(parentId))
        fail(400, 'invalid_study', 'Mind map parents must exist and cannot form cycles.')
      visited.add(parentId)
      parentId = parent!.parentId
    }
  }
  return result
}

function strokes(value: unknown): StudyStroke[] {
  const ids = new Set<string>()
  let total = 0
  return list(value, 'mindMap.strokes', studyLimits.strokes).map((value) => {
    const p = object(value, 'stroke')
    const id = entryId(p, ids)
    const points = list(p.points, 'stroke.points', studyLimits.pointsPerStroke)
    total += points.length
    if (!points.length || total > studyLimits.totalPoints)
      fail(400, 'invalid_study', 'Strokes must contain points within the total drawing limit.')
    return {
      id,
      points: points.map((value) => {
        const point = object(value, 'point')
        const { x, y } = point
        if (
          typeof x !== 'number' ||
          typeof y !== 'number' ||
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < 0 ||
          x > 1 ||
          y < 0 ||
          y > 1
        )
          fail(
            400,
            'invalid_study',
            'Drawing coordinates must be finite numbers between zero and one.',
          )
        return { x: x as number, y: y as number }
      }),
    }
  })
}

/** Called inside runAction's transaction. The storage identity is never supplied by the browser. */
export function saveStudyWorkspace(db: Database, suppliedActor: Account, p: Payload): string {
  const actor = authenticated(db, suppliedActor)
  role(actor, ['student'])
  const assignmentId = str(p, 'assignmentId', 150)
  const assignment = get<Assignment>(db, 'assignment', assignmentId)
  if (!assignment || !assignment.published) fail(404, 'not_found', 'The assignment is unavailable.')
  classroom(db, actor, assignment!.classId)
  const assignmentVersion = integer(p, 'assignmentVersion', 1)
  if (assignment!.version !== assignmentVersion)
    fail(409, 'conflict', 'This assignment changed. Keep your notes and open its current version.')
  if (!['reading', 'listening', 'writing'].includes(assignment!.skill))
    fail(400, 'invalid_study', 'This assignment does not support a study workspace.')
  const key = `study_${createHash('sha256')
    .update(JSON.stringify([actor.id, assignmentId, assignmentVersion]))
    .digest('hex')}`
  const previous = get<StudyWorkspace>(db, 'studyWorkspace', key)
  const expected = integer(p, 'expectedVersion')
  if ((previous?.version ?? 0) !== expected)
    fail(
      409,
      'conflict',
      'Your study notes changed elsewhere. Keep your input and reload the saved version.',
    )
  const map = object(p.mindMap, 'mindMap')
  const workspace: StudyWorkspace = {
    id: key,
    assignmentId,
    assignmentVersion,
    studentId: actor.id,
    version: expected + 1,
    annotations: annotations(p.annotations, assignment!),
    mindMap: { nodes: nodes(map.nodes), strokes: strokes(map.strokes) },
    // Older clients save notes/maps without this additive field. Preserve their existing markers.
    ...(p.readingReview === undefined
      ? previous?.readingReview && { readingReview: previous.readingReview }
      : { readingReview: readingReview(p.readingReview, assignment!) }),
    updatedAt: now(),
  }
  if (Buffer.byteLength(JSON.stringify(workspace), 'utf8') > studyLimits.payloadBytes)
    fail(400, 'invalid_study', 'Study notes exceed the workspace size limit.')
  put(db, 'studyWorkspace', workspace)
  return key
}

export function visibleStudyWorkspaces(
  db: Database,
  actor: Account,
  assignmentIds: ReadonlySet<string>,
): StudyWorkspace[] {
  if (actor.role !== 'student') return []
  return all<StudyWorkspace>(db, 'studyWorkspace').filter(
    (workspace) => workspace.studentId === actor.id && assignmentIds.has(workspace.assignmentId),
  )
}
