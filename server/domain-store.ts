import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Account, Classroom, Role, Text } from '../shared/portal.ts'
import { HttpError } from './errors.ts'

export type Database = DatabaseSync
export type Payload = Record<string, unknown>
export const fail = (status: number, code: string, message: string): never => {
  throw new HttpError(status, code, message)
}
export const now = () => new Date().toISOString()
export const id = () => randomUUID()
export const all = <T>(db: Database, kind: string): T[] =>
  db
    .prepare('SELECT body FROM records WHERE kind = ? ORDER BY rowid')
    .all(kind)
    .map((row) => JSON.parse(String(row.body)) as T)
export const get = <T>(db: Database, kind: string, key: string): T | undefined => {
  const row = db.prepare('SELECT body FROM records WHERE kind = ? AND id = ?').get(kind, key)
  return row ? (JSON.parse(String(row.body)) as T) : undefined
}
export const put = <T extends { id: string; version?: number }>(
  db: Database,
  kind: string,
  item: T,
) => {
  db.prepare(
    'INSERT INTO records(kind,id,body,version) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body,version=excluded.version',
  ).run(kind, item.id, JSON.stringify(item), item.version ?? 1)
}
export const remove = (db: Database, kind: string, key: string) => {
  db.prepare('DELETE FROM records WHERE kind = ? AND id = ?').run(kind, key)
}
export const accounts = (db: Database): Account[] =>
  db
    .prepare('SELECT id,name,email,role,active,version,created_at FROM users')
    .all()
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role) as Role,
      active: Boolean(row.active),
      version: Number(row.version),
      createdAt: String(row.created_at),
    }))
export const authenticated = (db: Database, actor: Account) => {
  const current = accounts(db).find((user) => user.id === actor.id && user.active)
  return current ?? fail(401, 'session_invalid', 'Sign in again to continue.')
}
const beforeCommitHooks = new WeakMap<Database, () => void>()
/** One runtime-owned outbox hook; tests without a runtime retain their existing behavior. */
export function registerBeforeCommit(db: Database, hook: () => void): () => void {
  if (beforeCommitHooks.has(db)) throw new Error('A before-commit hook is already registered.')
  beforeCommitHooks.set(db, hook)
  return () => {
    if (beforeCommitHooks.get(db) === hook) beforeCommitHooks.delete(db)
  }
}
export const transaction = <T>(db: Database, work: () => T): T => {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    beforeCommitHooks.get(db)?.()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export const str = (p: Payload, key: string, max = 5000, empty = false): string => {
  const value = p[key]
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()))
    fail(
      400,
      'invalid_payload',
      `${key} must be ${empty ? 'a' : 'a nonempty'} string of at most ${max} characters.`,
    )
  return value as string
}
export const integer = (
  p: Payload,
  key: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number => {
  const value = p[key]
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max)
    fail(400, 'invalid_payload', `${key} must be an integer between ${min} and ${max}.`)
  return value as number
}
export const bool = (p: Payload, key: string): boolean => {
  if (typeof p[key] !== 'boolean') fail(400, 'invalid_payload', `${key} must be true or false.`)
  return p[key] as boolean
}
export const strings = (p: Payload, key: string, max = 1000): string[] => {
  const value = p[key]
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((v) => typeof v !== 'string' || !v || v.length > 150) ||
    new Set(value).size !== value.length
  )
    fail(400, 'invalid_payload', `${key} must be a list of unique identifiers.`)
  return value as string[]
}
export const bilingual = (p: Payload, key: string, max = 20000): Text => {
  const value = p[key]
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(400, 'invalid_payload', `${key} needs Vietnamese and English text.`)
  return { vi: str(value as Payload, 'vi', max), en: str(value as Payload, 'en', max) }
}
export const enumValue = <T extends string>(p: Payload, key: string, options: readonly T[]): T => {
  const value = str(p, key, 50)
  return options.includes(value as T)
    ? (value as T)
    : fail(400, 'invalid_payload', `${key} is not supported.`)
}
export const dateTime = (p: Payload, key: string, allowEmpty = false): string => {
  const value = str(p, key, 80, allowEmpty)
  if (!value && allowEmpty) return ''
  if (!/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value)))
    fail(400, 'invalid_payload', `${key} must be an ISO date and time.`)
  return new Date(value).toISOString()
}
export const current = <T extends { id: string; version: number }>(
  db: Database,
  kind: string,
  p: Payload,
): { previous: T | undefined; key: string; version: number } => {
  const key = p.id === undefined ? id() : str(p, 'id', 150)
  const previous = get<T>(db, kind, key)
  const expected = integer(p, 'expectedVersion')
  if ((p.id !== undefined && !previous) || (previous?.version ?? 0) !== expected)
    fail(
      409,
      'conflict',
      'This record changed. Reload it and try again; your input has not been saved.',
    )
  return { previous, key, version: expected + 1 }
}
export const visibleClass = (actor: Account, room: Classroom): boolean =>
  actor.role === 'admin' ||
  (room.active &&
    (actor.role === 'teacher'
      ? room.teacherIds.includes(actor.id)
      : actor.role === 'assistant'
        ? room.assistantIds.includes(actor.id)
        : room.studentIds.includes(actor.id)))
export const classroom = (db: Database, actor: Account, key: string, edit = false): Classroom => {
  const room = get<Classroom>(db, 'class', key)
  if (!room || !visibleClass(actor, room)) fail(404, 'not_found', 'The class is unavailable.')
  if (
    edit &&
    actor.role !== 'admin' &&
    (actor.role !== 'teacher' || !room!.teacherIds.includes(actor.id))
  )
    fail(403, 'forbidden', 'Only an assigned teacher can change this class content.')
  return room!
}
export const role = (actor: Account, roles: Role[]) => {
  if (!roles.includes(actor.role))
    fail(403, 'forbidden', 'Your account cannot perform this action.')
}
