import assert from 'node:assert/strict'
import test from 'node:test'
import { canViewPath, roleSections, sectionForPath } from '../src/features/management/navigation.ts'

test('academic role navigation rejects direct links to privileged modules', () => {
  for (const role of ['student', 'teacher', 'assistant'] as const)
    assert.equal(canViewPath(role, 'users'), false)
  for (const path of ['students', 'grading', 'users'])
    assert.equal(canViewPath('student', path), false)
  assert.equal(canViewPath('assistant', 'grading'), false)
  assert.equal(canViewPath('assistant', 'syllabus'), false)
  assert.equal(canViewPath('admin', 'users'), true)
})
test('only students enter submission workspace; unknown and campus modules rejected', () => {
  assert.equal(canViewPath('student', 'assignment/writing-01'), true)
  assert.equal(sectionForPath('assignment/writing-01'), 'assignments')
  for (const role of Object.keys(roleSections) as (keyof typeof roleSections)[]) {
    for (const path of ['transport', 'hostel', 'inventory', 'missing'])
      assert.equal(canViewPath(role, path), false)
    if (role !== 'student') assert.equal(canViewPath(role, 'assignment/writing-01'), false)
  }
})
test('review booking deep link opens timetable without admitting unknown child routes', () => {
  assert.equal(sectionForPath('schedule/consultations'), 'schedule')
  for (const role of Object.keys(roleSections) as (keyof typeof roleSections)[]) {
    assert.equal(canViewPath(role, 'schedule/consultations'), true)
    assert.equal(canViewPath(role, 'schedule/unknown'), false)
    assert.equal(canViewPath(role, 'courses/open'), true)
    assert.equal(canViewPath(role, 'courses/unknown'), false)
  }
})
test('only students can follow the vocabulary practice deep link', () => {
  assert.equal(sectionForPath('notebook/practice'), 'notebook')
  assert.equal(canViewPath('student', 'notebook/practice'), true)
  assert.equal(canViewPath('student', 'notebook/unknown'), false)
  for (const role of ['teacher', 'assistant', 'admin'] as const)
    assert.equal(canViewPath(role, 'notebook/practice'), false)
})
