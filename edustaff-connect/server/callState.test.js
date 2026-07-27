import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CALL_STATUSES,
  buildStatusUpdate,
  elapsedSeconds,
  formatDuration,
  isAttended,
  isPending,
  isUnanswered,
  isValidStatus,
  summarizeCalls,
} from './callState.js'

test('call statuses cover the tracked lifecycle', () => {
  assert.ok(CALL_STATUSES.includes('ringing'))
  assert.ok(CALL_STATUSES.includes('attended'))
  assert.ok(CALL_STATUSES.includes('missed'))
  assert.equal(isValidStatus('attended'), true)
  assert.equal(isValidStatus('teleported'), false)
})

test('status groups classify calls correctly', () => {
  assert.equal(isPending('ringing'), true)
  assert.equal(isAttended('attended'), true)
  assert.equal(isUnanswered('missed'), true)
  assert.equal(isUnanswered('no-answer'), true)
  assert.equal(isUnanswered('attended'), false)
})

test('starting a call stays pending with no end stamp', () => {
  const update = buildStatusUpdate('ringing')
  assert.equal(update.status, 'ringing')
  assert.equal('endedAt' in update, false)
  assert.equal('answeredAt' in update, false)
})

test('attending a call stamps answeredAt, endedAt and a duration', () => {
  const startedAt = new Date('2026-07-27T10:00:00Z')
  const now = new Date('2026-07-27T10:02:30Z')
  const update = buildStatusUpdate('attended', { startedAt, now })

  assert.equal(update.status, 'attended')
  assert.ok(update.answeredAt instanceof Date)
  assert.ok(update.endedAt instanceof Date)
  assert.equal(update.durationSeconds, 150)
})

test('an explicit duration overrides the computed elapsed time', () => {
  const update = buildStatusUpdate('attended', {
    startedAt: new Date('2026-07-27T10:00:00Z'),
    now: new Date('2026-07-27T10:05:00Z'),
    durationSeconds: 42,
  })
  assert.equal(update.durationSeconds, 42)
})

test('missed calls close out without an answered timestamp', () => {
  const update = buildStatusUpdate('missed', {
    startedAt: new Date('2026-07-27T10:00:00Z'),
    now: new Date('2026-07-27T10:00:20Z'),
  })
  assert.equal(update.status, 'missed')
  assert.equal('answeredAt' in update, false)
  assert.equal(update.durationSeconds, 20)
})

test('unknown statuses are rejected', () => {
  assert.throws(() => buildStatusUpdate('nope'), /Unknown call status/)
})

test('elapsed seconds never goes negative', () => {
  const later = new Date('2026-07-27T10:05:00Z')
  const earlier = new Date('2026-07-27T10:00:00Z')
  assert.equal(elapsedSeconds(later, earlier), 0)
  assert.equal(elapsedSeconds(earlier, later), 300)
})

test('summary counts attended, unanswered, pending and attend rate', () => {
  const now = new Date('2026-07-27T12:00:00Z')
  const summary = summarizeCalls([
    { status: 'attended', startedAt: now, durationSeconds: 120 },
    { status: 'attended', startedAt: now, durationSeconds: 60 },
    { status: 'missed', startedAt: now, durationSeconds: 0 },
    { status: 'ringing', startedAt: now, durationSeconds: 0 },
    { status: 'attended', startedAt: new Date('2026-07-20T09:00:00Z'), durationSeconds: 30 },
  ], now)

  assert.equal(summary.total, 5)
  assert.equal(summary.attended, 3)
  assert.equal(summary.unanswered, 1)
  assert.equal(summary.pending, 1)
  assert.equal(summary.today, 4)
  assert.equal(summary.talkTimeSeconds, 210)
  assert.equal(summary.attendRate, 75)
})

test('summary of an empty history is all zeroes', () => {
  const summary = summarizeCalls([])
  assert.equal(summary.total, 0)
  assert.equal(summary.attendRate, 0)
})

test('durations render in a human readable form', () => {
  assert.equal(formatDuration(0), '0s')
  assert.equal(formatDuration(45), '45s')
  assert.equal(formatDuration(60), '1m 00s')
  assert.equal(formatDuration(150), '2m 30s')
})
