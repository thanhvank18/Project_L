import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  apiPath,
  authenticatedSession,
  mapBackendRole,
  parseAccessToken,
  parseProfile,
  parseStoredToken,
  previewSession,
} from '../src/features/auth/session.ts'

test('backend role mapping never promotes unsupported roles to assistant or administrator', () => {
  assert.equal(mapBackendRole('STUDENT'), 'student')
  assert.equal(mapBackendRole('CLASS_TEACHER'), 'teacher')
  assert.equal(mapBackendRole('SUBJECT_TEACHER'), 'teacher')
  assert.equal(mapBackendRole('ACADEMIC_COORDINATOR'), 'teacher')
  assert.equal(mapBackendRole('SUPER_ADMIN'), 'admin')
  assert.equal(mapBackendRole('DIRECTOR'), 'admin')
  for (const role of ['student', 'teacher', 'assistant', 'admin'])
    assert.equal(mapBackendRole(role), role)
  for (const role of ['', 'TEACHING_ASSISTANT', 'PARENT', 'TRANSPORT_MANAGER'])
    assert.equal(mapBackendRole(role), null)
})

test('session storage accepts only versioned tokens and never uses a stored role', () => {
  assert.equal(
    parseStoredToken(
      JSON.stringify({ version: 1, accessToken: 'header.payload.signature', role: 'SUPER_ADMIN' }),
    ),
    'header.payload.signature',
  )
  for (const value of [
    null,
    '',
    'bad json',
    'null',
    '{}',
    '{"version":2,"accessToken":"a.b.c"}',
    '{"version":1,"accessToken":"Bearer a.b.c"}',
  ])
    assert.equal(parseStoredToken(value), null)
  assert.equal(parseAccessToken('a.b.c\nAuthorization: bad'), null)
  assert.equal(parseAccessToken('a'.repeat(9000)), null)
  assert.equal(parseAccessToken('a'.repeat(43)), 'a'.repeat(43))
  assert.equal(parseAccessToken('a'.repeat(42)), null)
})

test('profile verification requires an active identifiable account before deriving its role', () => {
  const profile = parseProfile({
    id: 'student-id',
    email: 'demo@example.test',
    role: 'STUDENT',
    firstName: 'Demo',
    lastName: 'Student',
    isActive: true,
  })
  assert.ok(profile)
  assert.equal(profile.name, 'Demo Student')
  assert.equal(authenticatedSession(profile)?.role, 'student')
  assert.equal(authenticatedSession({ ...profile, backendRole: 'PARENT' }), null)
  assert.equal(
    parseProfile({ id: 'id', email: 'test@example.test', role: 'STUDENT', isActive: false }),
    null,
  )
  assert.equal(parseProfile({ id: 'id', email: 'test@example.test' }), null)
  assert.equal(parseProfile(null), null)
})

test('preview mode is explicit, synthetic and limited to supported interface roles', () => {
  assert.equal(previewSession(''), null)
  assert.equal(previewSession('?role=admin'), null)
  assert.equal(previewSession('?preview=SUPER_ADMIN'), null)
  const preview = previewSession('?preview=assistant')
  assert.equal(preview?.mode, 'preview')
  assert.equal(preview?.user.backendRole, 'PREVIEW')
  assert.equal(preview?.role, 'assistant')
})

test('API paths stay on the same-origin versioned API and reject external or traversal paths', () => {
  assert.equal(apiPath('users/me'), '/api/v1/users/me')
  assert.equal(apiPath('/assignments?teacherId=demo'), '/api/v1/assignments?teacherId=demo')
  for (const path of [
    'https://example.test',
    '//example.test',
    '../users',
    'users/../auth',
    '/api/../../users',
    'users\\me',
    'users#x',
  ])
    assert.throws(() => apiPath(path))
})
