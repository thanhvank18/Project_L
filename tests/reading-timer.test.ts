import assert from 'node:assert/strict'
import test from 'node:test'
import { createReadingVisitTimer } from '../src/features/live/reading-timer.ts'

test('the visit timer preserves partial seconds across manual pause and resume', () => {
  const timer = createReadingVisitTimer()
  assert.equal(timer.update(0, false, false), 0)
  assert.equal(timer.update(600, true, false), 0)
  assert.equal(timer.update(10_600, false, false), 0)
  assert.equal(timer.update(11_000, true, false), 1)
  assert.equal(timer.update(20_000, true, false), 1)
  assert.equal(timer.update(25_000, false, false), 1)
  assert.equal(timer.update(25_750, true, false), 1)
  assert.equal(timer.update(30_000, false, false), 1)
  assert.equal(timer.update(30_250, false, false), 2)
})

test('hiding a page suspends accrual and returning cannot override a manual pause', () => {
  const timer = createReadingVisitTimer()
  timer.update(0, false, false)
  assert.equal(timer.update(1_200, false, true), 1)
  assert.equal(timer.update(60_000, false, true), 1)
  assert.equal(timer.update(90_000, false, false), 1)
  assert.equal(timer.update(90_800, true, false), 2)
  assert.equal(timer.update(100_000, true, true), 2)
  assert.equal(timer.update(200_000, true, false), 2)
  assert.equal(timer.update(210_000, true, false), 2)
  assert.equal(timer.update(220_000, false, false), 2)
  assert.equal(timer.update(221_000, false, false), 3)
})

test('delayed ticks use elapsed timestamps and every new visit starts from zero', () => {
  const timer = createReadingVisitTimer()
  assert.equal(timer.update(500_000, false, true), 0)
  assert.equal(timer.update(550_000, false, false), 0)
  assert.equal(timer.update(555_400, false, false), 5)
  assert.equal(timer.update(555_900, true, false), 5)
  assert.equal(timer.update(556_000, false, false), 5)
  assert.equal(timer.update(556_100, false, false), 6)
  assert.equal(createReadingVisitTimer().update(900_000, false, false), 0)
})
