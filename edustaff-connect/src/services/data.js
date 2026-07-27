/** Shared metadata constants - no personal data */

export const toneClasses = {
  blue: 'border-blue-600 bg-blue-600/10 text-blue-800',
  red: 'border-red-600 bg-red-600/10 text-red-800',
  green: 'border-emerald-600 bg-emerald-600/10 text-emerald-800',
  amber: 'border-amber-600 bg-amber-600/10 text-amber-800',
  violet: 'border-violet-600 bg-violet-600/10 text-violet-800',
}

/** Notes now live inside the Calls section, so they no longer get their own tab. */
export const navItems = [
  { label: 'Contacts', path: '/contacts', icon: 'UserRound' },
  { label: 'Upload', path: '/upload', icon: 'Upload' },
  { label: 'Calls', path: '/calls', icon: 'PhoneCall' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
]

/** Visual treatment for every status a tracked call can be in. */
export const callStatusMeta = {
  ringing: { label: 'Calling…', tone: 'blue', icon: 'PhoneOutgoing' },
  attended: { label: 'Attended', tone: 'green', icon: 'PhoneCall' },
  missed: { label: 'Missed', tone: 'red', icon: 'PhoneMissed' },
  'no-answer': { label: 'No answer', tone: 'amber', icon: 'PhoneOff' },
  busy: { label: 'Busy', tone: 'amber', icon: 'PhoneOff' },
  'wrong-number': { label: 'Wrong number', tone: 'violet', icon: 'PhoneOff' },
  cancelled: { label: 'Cancelled', tone: 'blue', icon: 'PhoneOff' },
}

/** Buttons shown while a call is still ringing. */
export const callOutcomeOptions = [
  { status: 'attended', label: 'Attended', tone: 'emerald' },
  { status: 'missed', label: 'Missed', tone: 'red' },
  { status: 'no-answer', label: 'No answer', tone: 'amber' },
  { status: 'busy', label: 'Busy', tone: 'slate' },
]

/** Mirror of the server-side formatter so the UI can render optimistic values. */
export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (!minutes) return `${rest}s`
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

/** "2 minutes ago" style stamps for the call feed. */
export function relativeTime(value) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const seconds = Math.round((Date.now() - time) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}

export const priorityColors = {
  Urgent: 'red',
  High: 'amber',
  Normal: 'green',
  critical: 'red',
  high: 'amber',
  normal: 'green',
  low: 'blue',
}
