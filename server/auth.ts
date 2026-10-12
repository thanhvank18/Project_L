import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import type { Account, ActionInput, Role } from '../shared/portal.ts'
import { accountFromRow, getAccount, transaction, type Database } from './db.ts'
import { HttpError } from './errors.ts'

const SESSION_MS = 12 * 60 * 60 * 1000
const ATTEMPT_MS = 15 * 60 * 1000
const roles = new Set<Role>(['admin', 'teacher', 'assistant', 'student'])
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const loginVerifications = new WeakMap<Database, number>()
const MAX_LOGIN_VERIFICATIONS = 8

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, passwordOptions, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 256) {
    throw new HttpError(
      400,
      'INVALID_PASSWORD',
      'Use a password of at least 12 characters and at most 256 bytes.',
    )
  }
  return password
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password)
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$32768$8$1$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: unknown, encoded: string): Promise<boolean> {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 256) return false
  const parts = encoded.split('$')
  if (
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== '32768' ||
    parts[2] !== '8' ||
    parts[3] !== '1' ||
    !/^[a-f0-9]{32}$/.test(parts[4] ?? '') ||
    !/^[a-f0-9]{128}$/.test(parts[5] ?? '')
  )
    return false
  const expected = Buffer.from(parts[5]!, 'hex')
  const actual = await derive(password, Buffer.from(parts[4]!, 'hex'))
  return timingSafeEqual(expected, actual)
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeEmail(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  ) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address.')
  }
  return value.trim().toLowerCase()
}

function requiredName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 120)
    throw new HttpError(400, 'INVALID_NAME', 'Name must contain 1–120 characters.')
  return value.trim()
}

function requiredRole(value: unknown): Role {
  if (!roles.has(value as Role))
    throw new HttpError(400, 'INVALID_ROLE', 'Choose a supported account role.')
  return value as Role
}

function assertAdmin(db: Database, actor: Account): void {
  const current = getAccount(db, actor.id)
  if (!current?.active || current.role !== 'admin')
    throw new HttpError(403, 'FORBIDDEN', 'Administrator access is required.')
}

function attempt(db: Database, key: string, maximum: number, now: number): number {
  const row = db.prepare('SELECT count,expires_at FROM auth_attempts WHERE key = ?').get(key)
  if (row && Number(row.expires_at) > now && Number(row.count) >= maximum)
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.')
  db.prepare(
    `INSERT INTO auth_attempts(key,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN auth_attempts.expires_at <= ? THEN 1 ELSE auth_attempts.count + 1 END,
    expires_at = CASE WHEN auth_attempts.expires_at <= ? THEN excluded.expires_at ELSE auth_attempts.expires_at END`,
  ).run(key, now + ATTEMPT_MS, now, now)
  return row && Number(row.expires_at) > now ? Number(row.expires_at) : now + ATTEMPT_MS
}

export async function login(
  db: Database,
  input: Record<string, unknown>,
  address: string,
  now = Date.now(),
): Promise<string> {
  const email = normalizeEmail(input.email)
  if (typeof input.password !== 'string' || Buffer.byteLength(input.password) > 256)
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  const verifying = loginVerifications.get(db) ?? 0
  if (verifying >= MAX_LOGIN_VERIFICATIONS)
    throw new HttpError(429, 'LOGIN_BUSY', 'Sign-in is busy. Try again in a few seconds.')
  loginVerifications.set(db, verifying + 1)
  try {
    const addressKey = `address:${tokenHash(address)}`
    const addressWindow = transaction(db, () => {
      db.prepare('DELETE FROM auth_attempts WHERE expires_at <= ?').run(now)
      const expiresAt = attempt(db, addressKey, 60, now)
      attempt(db, `email:${tokenHash(email)}`, 10, now)
      return expiresAt
    })
    const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email)
    // Unknown accounts take the same password derivation path as existing accounts.
    const encoded = row
      ? String(row.password_hash)
      : `scrypt$32768$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`
    const valid = await verifyPassword(input.password, encoded)
    if (!row || !valid || row.active !== 1)
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
    const token = randomBytes(32).toString('base64url')
    transaction(db, () => {
      const current = db
        .prepare('SELECT active,password_hash FROM users WHERE id = ?')
        .get(String(row.id))
      if (current?.active !== 1 || current.password_hash !== encoded)
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
      db.prepare(
        'INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)',
      ).run(tokenHash(token), String(row.id), now, now + SESSION_MS)
      db.prepare('DELETE FROM auth_attempts WHERE key = ?').run(`email:${tokenHash(email)}`)
      // Pending verification reserves a slot; successful sign-ins are not failures.
      // Remove only this request, preserving other accounts' failed attempts and
      // never decrementing a replacement window opened while verification ran.
      db.prepare('UPDATE auth_attempts SET count = count - 1 WHERE key = ? AND expires_at = ?').run(
        addressKey,
        addressWindow,
      )
      db.prepare('DELETE FROM auth_attempts WHERE key = ? AND count <= 0').run(addressKey)
    })
    return token
  } finally {
    const remaining = (loginVerifications.get(db) ?? 1) - 1
    if (remaining === 0) loginVerifications.delete(db)
    else loginVerifications.set(db, remaining)
  }
}

export function authenticate(db: Database, token: string | undefined, now = Date.now()): Account {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in again.')
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .get(tokenHash(token), now)
  if (!row) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in again.')
  return accountFromRow(row)
}

export function logout(db: Database, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token))
}

export async function changePassword(
  db: Database,
  actor: Account,
  token: string,
  input: Record<string, unknown>,
): Promise<void> {
  if (authenticate(db, token).id !== actor.id)
    throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in again.')
  const password = validatePassword(input.newPassword)
  attempt(db, `password:${actor.id}`, 10, Date.now())
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ? AND active = 1')
    .get(actor.id)
  if (!row || !(await verifyPassword(input.currentPassword, String(row.password_hash))))
    throw new HttpError(400, 'INCORRECT_PASSWORD', 'Current password is incorrect.')
  const encoded = await hashPassword(password)
  transaction(db, () => {
    if (authenticate(db, token).id !== actor.id)
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in again.')
    const changed = db
      .prepare(
        'UPDATE users SET password_hash = ?, version = version + 1 WHERE id = ? AND password_hash = ? AND active = 1',
      )
      .run(encoded, actor.id, String(row.password_hash))
    if (changed.changes !== 1)
      throw new HttpError(409, 'CONFLICT', 'Account changed. Please try again.')
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(
      actor.id,
      tokenHash(token),
    )
    db.prepare('DELETE FROM auth_attempts WHERE key = ?').run(`password:${actor.id}`)
  })
}

function auditAccount(db: Database, actor: Account, action: string, targetId: string): void {
  const record = {
    id: randomUUID(),
    actorId: actor.id,
    action,
    targetId,
    createdAt: new Date().toISOString(),
  }
  db.prepare('INSERT INTO records(kind,id,body,version) VALUES (?,?,?,1)').run(
    'audit',
    record.id,
    JSON.stringify(record),
  )
}

export async function runUserAction(
  db: Database,
  actor: Account,
  input: ActionInput,
  validateSession?: () => void,
): Promise<Record<string, unknown> | undefined> {
  if (input.type !== 'user.create' && input.type !== 'user.update') return undefined
  validateSession?.()
  assertAdmin(db, actor)
  const payload = input.payload
  const name = requiredName(payload.name)
  const email = normalizeEmail(payload.email)
  const role = requiredRole(payload.role)
  if (typeof payload.active !== 'boolean' && payload.active !== undefined)
    throw new HttpError(400, 'INVALID_ACTIVE', 'Account status must be true or false.')
  const active = payload.active !== false
  const password =
    payload.password === undefined || payload.password === ''
      ? undefined
      : await hashPassword(validatePassword(payload.password))
  if (input.type === 'user.create' && !password)
    throw new HttpError(400, 'INVALID_PASSWORD', 'A password is required for a new account.')
  return transaction(db, () => {
    validateSession?.()
    assertAdmin(db, actor)
    const id =
      input.type === 'user.create' ? randomUUID() : typeof payload.id === 'string' ? payload.id : ''
    const existing = input.type === 'user.update' ? getAccount(db, id) : undefined
    if (input.type === 'user.update' && !existing)
      throw new HttpError(404, 'NOT_FOUND', 'Account was not found.')
    if (existing && payload.version !== existing.version)
      throw new HttpError(409, 'CONFLICT', 'Account changed. Reload before saving.')
    if (existing?.id === actor.id && (!active || role !== 'admin'))
      throw new HttpError(
        400,
        'SELF_LOCKOUT',
        'You cannot disable or demote your own administrator account.',
      )
    if (existing?.role === 'admin' && existing.active && (!active || role !== 'admin')) {
      const count = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1 AND role = 'admin'")
        .get()
      if (Number(count?.count) <= 1)
        throw new HttpError(400, 'LAST_ADMIN', 'At least one active administrator is required.')
    }
    if (
      db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?').get(email, id)
    )
      throw new HttpError(409, 'EMAIL_EXISTS', 'An account already uses this email address.')
    if (existing) {
      db.prepare(
        'UPDATE users SET name=?,email=?,role=?,active=?,version=version+1,password_hash=COALESCE(?,password_hash) WHERE id=?',
      ).run(name, email, role, active ? 1 : 0, password ?? null, id)
      if (password || !active || role !== existing.role)
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    } else {
      db.prepare(
        'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES (?,?,?,?,?,1,?,?)',
      ).run(id, name, email, role, active ? 1 : 0, new Date().toISOString(), password!)
    }
    auditAccount(db, actor, input.type, id)
    return { id }
  })
}
