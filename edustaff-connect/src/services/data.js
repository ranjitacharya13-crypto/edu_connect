/** Shared metadata constants - no personal data */

export const toneClasses = {
  blue: 'border-blue-600 bg-blue-600/10 text-blue-800',
  red: 'border-red-600 bg-red-600/10 text-red-800',
  green: 'border-emerald-600 bg-emerald-600/10 text-emerald-800',
  amber: 'border-amber-600 bg-amber-600/10 text-amber-800',
  violet: 'border-violet-600 bg-violet-600/10 text-violet-800',
}

export const navItems = [
  { label: 'Contacts', path: '/contacts', icon: 'UserRound' },
  { label: 'Upload', path: '/upload', icon: 'Upload' },
  { label: 'Calls', path: '/calls', icon: 'PhoneCall' },
  { label: 'Notes', path: '/notes', icon: 'MessageSquareText' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
]

export const priorityColors = {
  Urgent: 'red',
  High: 'amber',
  Normal: 'green',
  critical: 'red',
  high: 'amber',
  normal: 'green',
  low: 'blue',
}
