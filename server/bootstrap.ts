import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { hashPassword, normalizeEmail } from './auth.ts'
import { openDatabase, transaction, type Database } from './db.ts'

export async function bootstrapAdmin(
  db: Database,
  email: string,
  name: string,
  accessPath: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!name.trim() || name.trim().length > 120)
    throw new Error('Administrator name must contain 1–120 characters.')
  if (db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()) return false
  const password = randomBytes(24).toString('base64url')
  const passwordHash = await hashPassword(password)
  const resolvedPath = resolve(accessPath)
  mkdirSync(dirname(resolvedPath), { recursive: true })
  let createdFile = false
  try {
    return transaction(db, () => {
      if (db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()) return false
      // Exclusive creation prevents overwriting a previously issued secret.
      writeFileSync(
        resolvedPath,
        `Project_L administrator access\nEmail: ${normalized}\nPassword: ${password}\n\nKeep this file private. Change the password after signing in, then remove this file.\n`,
        { flag: 'wx', mode: 0o600 },
      )
      createdFile = true
      db.prepare(
        "INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES (?,?,?,'admin',1,1,?,?)",
      ).run(randomUUID(), name.trim(), normalized, new Date().toISOString(), passwordHash)
      return true
    })
  } catch (error) {
    if (createdFile) unlinkSync(resolvedPath)
    throw error
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const options: Record<string, string> = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if ((key !== '--email' && key !== '--name') || !value || value.startsWith('--'))
      throw new Error('Usage: pnpm admin:bootstrap --email admin@gmail.com --name Administrator')
    options[key] = value
  }
  const dbPath = resolve(process.env.PORTAL_DB_PATH ?? '.local/portal/portal.sqlite')
  const db = openDatabase(dbPath)
  const accessPath = resolve(dirname(dbPath), 'admin-access.txt')
  try {
    const created = await bootstrapAdmin(
      db,
      options['--email'] ?? 'admin@gmail.com',
      options['--name'] ?? 'Administrator',
      accessPath,
    )
    console.info(
      created
        ? `Administrator created. Private sign-in details: ${accessPath}`
        : 'An administrator already exists. No account or password was changed.',
    )
  } finally {
    db.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Administrator setup failed.')
    process.exitCode = 1
  })
}
