import assert from 'node:assert/strict'
import test from 'node:test'
import { isZoomMeetingUrl } from '../src/features/live/meeting.ts'

test('manual Zoom links accept meeting and personal-room URLs, including passcodes', () => {
  for (const value of [
    'https://zoom.us/j/123456789?pwd=meeting-passcode',
    'https://us06web.zoom.us/j/123456789',
    ' https://zoom.us/my/languageclass ',
    'https://zoom.us:443/j/123456789',
  ]) {
    assert.equal(isZoomMeetingUrl(value), true)
  }
})

test('manual Zoom links reject lookalike hosts, unsafe protocols, credentials and custom ports', () => {
  for (const value of [
    '',
    'zoom.us/j/123456789',
    'http://zoom.us/j/123456789',
    'javascript:alert(1)',
    'https://zoom.us.evil.test/j/123456789',
    'https://notzoom.us/j/123456789',
    'https://zoom.us@evil.test/j/123456789',
    'https://teacher:password@zoom.us/j/123456789',
    'https://zoom.us:8443/j/123456789',
    'https://zoom.us/profile',
    `https://zoom.us/j/${'1'.repeat(2000)}`,
  ]) {
    assert.equal(isZoomMeetingUrl(value), false)
  }
})
