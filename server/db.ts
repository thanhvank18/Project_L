import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Account, Role } from '../shared/portal.ts'

export type Database = DatabaseSync

export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL CHECK(role IN ('admin','teacher','assistant','student')),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS auth_attempts (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      body TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(kind,id)
    );
    CREATE TABLE IF NOT EXISTS file_blobs (
      id TEXT PRIMARY KEY,
      bytes BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS speaking_audio (
      id TEXT PRIMARY KEY,
      bytes BLOB NOT NULL
    );
  `)
  const version = db.prepare('PRAGMA user_version').get()
  if (Number(version?.user_version) < 1) db.exec('PRAGMA user_version = 1')
  return db
}

export function accountFromRow(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
    active: row.active === 1,
    version: Number(row.version),
    createdAt: String(row.created_at),
  }
}

export function getAccount(db: Database, id: string): Account | undefined {
  const row = db
    .prepare('SELECT id,name,email,role,active,version,created_at FROM users WHERE id = ?')
    .get(id)
  return row ? accountFromRow(row) : undefined
}

export function listAccounts(db: Database): Account[] {
  return db
    .prepare(
      'SELECT id,name,email,role,active,version,created_at FROM users ORDER BY created_at,id',
    )
    .all()
    .map(accountFromRow)
}

export function transaction<T>(db: Database, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = operation()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
