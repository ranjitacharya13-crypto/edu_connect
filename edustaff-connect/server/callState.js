/**
 * Pure call-state helpers shared by the API routes and unit tests.
 * Keeping the logic free of Mongoose lets us verify the lifecycle rules quickly.
 */

/** Every status a tracked call can move through. */
export const CALL_STATUSES = [
  'ringing',
  'attended',
  'missed',
  'no-answer',
  'busy',
  'wrong-number',
  'cancelled',
]

/** Calls still waiting for the teacher to record an outcome. */
export const PENDING_STATUSES = ['ringing']

/** The student/guardian picked up. */
export const ATTENDED_STATUSES = ['attended']

/** Someone tried, nobody answered. */
export const UNANSWERED_STATUSES = ['missed', 'no-answer', 'busy', 'wrong-number']

export const STATUS_LABELS = Object.freeze({
  ringing: 'Calling…',
  attended: 'Attended',
  missed: 'Missed',
  'no-answer': 'No answer',
  busy: 'Busy',
  'wrong-number': 'Wrong number',
  cancelled: 'Cancelled',
})

export function isValidStatus(status) {
  return CALL_STATUSES.includes(status)
}

export function isPending(status) {
  return PENDING_STATUSES.includes(status)
}

export function isAttended(status) {
  return ATTENDED_STATUSES.includes(status)
}

export function isUnanswered(status) {
  return UNANSWERED_STATUSES.includes(status)
}

/** Seconds elapsed between two instants, floored at 0. */
export function elapsedSeconds(startedAt, endedAt = new Date()) {
  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 1000))
}

/**
 * Build the fields to persist when a call moves to a new status.
 * `attended` stamps answeredAt; every terminal status stamps endedAt and a duration.
 */
export function buildStatusUpdate(status, options = {}) {
  if (!isValidStatus(status)) {
    throw new Error(`Unknown call status: ${status}`)
  }

  const now = options.now ? new Date(options.now) : new Date()
  const startedAt = options.startedAt ? new Date(options.startedAt) : now
  const update = { status }

  if (isAttended(status)) {
    update.answeredAt = options.answeredAt ? new Date(options.answeredAt) : now
  }

  if (!isPending(status)) {
    update.endedAt = now
    const provided = Number(options.durationSeconds)
    update.durationSeconds = Number.isFinite(provided) && provided >= 0
      ? Math.round(provided)
      : elapsedSeconds(startedAt, now)
  }

  if (typeof options.outcome === 'string') {
    update.outcome = options.outcome.trim()
  }

  return update
}

/** Roll a list of calls up into the counters shown on the Calls dashboard. */
export function summarizeCalls(calls = [], now = new Date()) {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const summary = {
    total: calls.length,
    attended: 0,
    unanswered: 0,
    pending: 0,
    today: 0,
    talkTimeSeconds: 0,
    attendRate: 0,
  }

  for (const call of calls) {
    if (isAttended(call.status)) summary.attended += 1
    else if (isUnanswered(call.status)) summary.unanswered += 1
    else if (isPending(call.status)) summary.pending += 1

    if (new Date(call.startedAt || call.createdAt) >= startOfDay) summary.today += 1
    summary.talkTimeSeconds += Number(call.durationSeconds) || 0
  }

  const completed = summary.attended + summary.unanswered
  summary.attendRate = completed ? Math.round((summary.attended / completed) * 100) : 0
  return summary
}

/** Human readable duration used by the API and the UI. */
export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (!minutes) return `${rest}s`
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}
