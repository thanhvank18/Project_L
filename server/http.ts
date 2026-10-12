import {
  createServer as createNodeServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import type { ActionInput } from '../shared/portal.ts'
import { authenticate, changePassword, login, logout, runUserAction } from './auth.ts'
import type { Database } from './db.ts'
import { getPortalState, getPublicCourses, runAction } from './domain.ts'
import { HttpError } from './errors.ts'
import { createFileService, type FileService } from './file-service.ts'
import { emailConfigurationFromEnvironment, type EmailConfiguration } from './email-config.ts'
import { emailQueueSummary } from './email-queue.ts'
import { createSpeakingService, type SpeakingService } from './speaking-service.ts'
import { createDriveConnectionService, type DriveConnectionService } from './drive-connection.ts'
import {
  starterCurriculumStatus,
  importStarterCurriculum,
  getStarterTeacherGuide,
} from './curriculum.ts'

const JSON_LIMIT = 1024 * 1024
const FILE_LIMIT = 8 * 1024 * 1024

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function tokenFrom(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined
}

async function readBody(req: IncomingMessage, maximum: number): Promise<Buffer> {
  const declared = req.headers['content-length']
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum))
    throw new HttpError(413, 'BODY_TOO_LARGE', 'Request is too large.')
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    length += bytes.length
    if (length > maximum) throw new HttpError(413, 'BODY_TOO_LARGE', 'Request is too large.')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks)
}

async function readJson(
  req: IncomingMessage,
  maximum = JSON_LIMIT,
): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
    throw new HttpError(415, 'JSON_REQUIRED', 'Send application/json content.')
  const bytes = await readBody(req, maximum)
  let value: unknown
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request must contain valid JSON.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_JSON', 'Request must contain a JSON object.')
  return value as Record<string, unknown>
}

function checkOrigin(req: IncomingMessage): void {
  if (req.headers['sec-fetch-site'] === 'cross-site')
    throw new HttpError(403, 'ORIGIN_REJECTED', 'Cross-site requests are not accepted.')
  const origin = req.headers.origin
  if (!origin) return
  const allowed = process.env.PORTAL_WEB_ORIGIN
    ? process.env.PORTAL_WEB_ORIGIN.split(',').map((value) => value.trim())
    : [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:4173',
        'http://localhost:4173',
      ]
  if (!allowed.includes(origin))
    throw new HttpError(403, 'ORIGIN_REJECTED', 'This website origin is not allowed.')
}

export function createServer(
  db: Database,
  files: FileService = createFileService(db),
  emailConfig: EmailConfiguration = emailConfigurationFromEnvironment(),
  speaking: SpeakingService = createSpeakingService(db, files),
  drive: DriveConnectionService = createDriveConnectionService(db),
) {
  const server = createNodeServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    res.setHeader('Cache-Control', 'no-store')
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const route = url.pathname
      // OAuth returns cross-site; its single-use state, cookie, PKCE and original
      // active admin session are checked before accepting any Google credentials.
      if (req.method === 'GET' && route === '/api/v1/portal/drive/callback') {
        const result = await drive.callback(url.searchParams, req.headers.cookie ?? '')
        if (result.cookie) res.setHeader('Set-Cookie', result.cookie)
        res.writeHead(303, { Location: result.location })
        res.end()
        return
      }
      checkOrigin(req)
      if (req.method === 'GET' && route === '/api/v1/health') {
        json(res, 200, { status: 'ok', service: 'project-l-portal' })
        return
      }
      if (req.method === 'GET' && route === '/api/v1/public/courses') {
        json(res, 200, getPublicCourses(db))
        return
      }
      if (req.method === 'POST' && route === '/api/v1/auth/login') {
        const input = await readJson(req)
        const accessToken = await login(db, input, req.socket.remoteAddress ?? 'local')
        json(res, 200, { accessToken })
        return
      }
      const token = tokenFrom(req)
      const actor = authenticate(db, token)
      if (req.method === 'GET' && route === '/api/v1/users/me') {
        json(res, 200, {
          id: actor.id,
          email: actor.email,
          role: actor.role,
          firstName: actor.name,
          lastName: '',
          isActive: actor.active,
        })
      } else if (req.method === 'POST' && route === '/api/v1/auth/logout') {
        logout(db, token!)
        json(res, 200, { ok: true })
      } else if (req.method === 'POST' && route === '/api/v1/auth/password') {
        const input = await readJson(req)
        await changePassword(db, authenticate(db, token), token!, input)
        json(res, 200, { ok: true })
      } else if (req.method === 'GET' && route === '/api/v1/portal/state') {
        json(res, 200, getPortalState(db, actor))
      } else if (req.method === 'GET' && route === '/api/v1/portal/integration-status') {
        json(res, 200, {
          speaking: speaking.configuration(),
          emailEnabled: emailConfig.enabled,
          vocabularyAI: false,
        })
      } else if (req.method === 'GET' && route === '/api/v1/portal/drive/status') {
        json(res, 200, drive.status(actor))
      } else if (req.method === 'POST' && route === '/api/v1/portal/drive/connect') {
        const input = await readJson(req)
        drive.assertOrigin(req.headers.origin)
        const result = drive.start(authenticate(db, token), token!, input.expectedVersion)
        res.setHeader('Set-Cookie', result.cookie)
        json(res, 200, { authorizationUrl: result.authorizationUrl })
      } else if (req.method === 'POST' && route === '/api/v1/portal/drive/disconnect') {
        const input = await readJson(req)
        json(res, 200, drive.disconnect(authenticate(db, token), input.expectedVersion))
      } else if (req.method === 'GET' && route === '/api/v1/portal/drive/folders') {
        json(
          res,
          200,
          await drive.folders(
            actor,
            url.searchParams.get('parentId') ?? 'root',
            url.searchParams.get('pageToken') ?? undefined,
            () => authenticate(db, token),
          ),
        )
      } else if (req.method === 'POST' && route === '/api/v1/portal/drive/folder') {
        const input = await readJson(req)
        json(
          res,
          200,
          await drive.selectFolder(
            authenticate(db, token),
            input.folderId,
            input.expectedVersion,
            () => authenticate(db, token),
          ),
        )
      } else if (req.method === 'GET' && route === '/api/v1/admin/starter-curriculum') {
        json(res, 200, starterCurriculumStatus(db, actor))
      } else if (req.method === 'POST' && route === '/api/v1/admin/starter-curriculum') {
        await readJson(req)
        json(res, 200, importStarterCurriculum(db, authenticate(db, token)))
      } else if (
        req.method === 'GET' &&
        /^\/api\/v1\/classes\/[a-zA-Z0-9-]+\/starter-guide$/.test(route)
      ) {
        json(res, 200, getStarterTeacherGuide(db, actor, route.split('/')[4]!))
      } else if (req.method === 'GET' && route === '/api/v1/portal/email-status') {
        if (actor.role !== 'admin')
          throw new HttpError(403, 'FORBIDDEN', 'Only administrators can inspect delivery status.')
        json(res, 200, emailQueueSummary(db, emailConfig))
      } else if (
        req.method === 'GET' &&
        /^\/api\/v1\/portal\/speaking\/assignments\/[a-zA-Z0-9-]+$/.test(route)
      ) {
        json(res, 200, speaking.history(actor, route.split('/').at(-1)!))
      } else if (req.method === 'POST' && route === '/api/v1/portal/speaking/jobs') {
        const input = await readJson(req)
        json(res, 202, speaking.create(authenticate(db, token), input))
      } else if (
        /^\/api\/v1\/portal\/speaking\/jobs\/[a-zA-Z0-9-]+(?:\/(?:audio|cancel))?$/.test(route)
      ) {
        const parts = route.split('/')
        const key = parts[6]!
        if (req.method === 'GET' && parts[7] === 'audio') {
          const bytes = speaking.audio(actor, key)
          const mime = speaking.read(actor, key).audioMime ?? 'audio/mpeg'
          res.writeHead(200, { 'Content-Type': mime, 'Content-Length': bytes.length })
          res.end(bytes)
        } else if (req.method === 'POST' && parts[7] === 'cancel') {
          const input = await readJson(req)
          if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1)
            throw new HttpError(400, 'invalid_payload', 'A current request version is required.')
          json(
            res,
            200,
            speaking.cancel(authenticate(db, token), key, Number(input.expectedVersion)),
          )
        } else if (req.method === 'GET' && !parts[7]) {
          json(res, 200, speaking.read(actor, key))
        } else throw new HttpError(404, 'NOT_FOUND', 'Endpoint was not found.')
      } else if (req.method === 'POST' && route === '/api/v1/portal/actions') {
        const value = await readJson(req)
        const currentActor = authenticate(db, token)
        if (
          typeof value.type !== 'string' ||
          !value.payload ||
          typeof value.payload !== 'object' ||
          Array.isArray(value.payload)
        )
          throw new HttpError(400, 'INVALID_ACTION', 'Action requires a type and payload.')
        const input: ActionInput = {
          type: value.type,
          payload: value.payload as Record<string, unknown>,
        }
        const result = await runUserAction(db, currentActor, input, () => {
          authenticate(db, token)
        })
        json(
          res,
          200,
          result
            ? { state: getPortalState(db, currentActor), result }
            : runAction(db, authenticate(db, token), input),
        )
      } else if (req.method === 'POST' && route === '/api/v1/portal/files') {
        const input = await readJson(req, 12 * 1024 * 1024)
        const currentActor = authenticate(db, token)
        const purpose = input.purpose
        if (purpose !== 'material' && purpose !== 'submission')
          throw new HttpError(400, 'INVALID_PURPOSE', 'Choose an attachment purpose.')
        if (
          typeof input.dataBase64 !== 'string' ||
          input.dataBase64.length > Math.ceil(FILE_LIMIT / 3) * 4 ||
          input.dataBase64.length % 4 !== 0 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(input.dataBase64)
        )
          throw new HttpError(
            400,
            'INVALID_FILE',
            'File data must be valid base64 and no larger than 8 MB.',
          )
        const bytes = Buffer.from(input.dataBase64, 'base64')
        if (bytes.toString('base64') !== input.dataBase64)
          throw new HttpError(400, 'INVALID_FILE', 'File data must be valid base64.')
        if (bytes.length > FILE_LIMIT)
          throw new HttpError(413, 'BODY_TOO_LARGE', 'Files must be 8 MB or smaller.')
        const record = await files.upload(
          currentActor,
          {
            name: typeof input.name === 'string' ? input.name : '',
            mime: typeof input.mime === 'string' ? input.mime.toLowerCase() : '',
            classId: typeof input.classId === 'string' ? input.classId : '',
            purpose,
          },
          bytes,
          () => {
            if (req.aborted || res.destroyed)
              throw new HttpError(400, 'request_cancelled', 'The upload request was cancelled.')
            return authenticate(db, token)
          },
        )
        json(res, 201, record)
      } else if (req.method === 'GET' && /^\/api\/v1\/portal\/files\/[a-zA-Z0-9-]+$/.test(route)) {
        const { record, bytes } = await files.download(actor, route.split('/').at(-1)!, () =>
          authenticate(db, token),
        )
        res.writeHead(200, {
          'Content-Type': record.mime,
          'Content-Length': bytes.length,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(record.name)}`,
        })
        res.end(bytes)
      } else {
        throw new HttpError(404, 'NOT_FOUND', 'Endpoint was not found.')
      }
    })().catch((error: unknown) => {
      if (res.headersSent) {
        res.destroy()
        return
      }
      const status = error instanceof HttpError ? error.status : 500
      if (status === 429)
        res.setHeader(
          'Retry-After',
          error instanceof HttpError && error.code === 'LOGIN_BUSY' ? '2' : '900',
        )
      json(res, status, {
        error: error instanceof HttpError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof HttpError ? error.message : 'The request could not be completed.',
      })
      if (!(error instanceof HttpError))
        console.error(
          'Portal request failed:',
          error instanceof Error ? error.name : 'Unknown error',
        )
    })
  })
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5_000
  server.maxHeadersCount = 60
  server.on('listening', () => speaking.start())
  server.on('close', () => {
    void speaking.stop()
  })
  return server
}
