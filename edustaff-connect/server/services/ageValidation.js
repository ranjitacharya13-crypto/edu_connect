const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDateOfBirth(value) {
  if (typeof value !== 'string') return null
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

export function hasReachedAge(dateOfBirth, minimumAge = 18, now = new Date()) {
  const dob = dateOfBirth instanceof Date ? dateOfBirth : parseDateOfBirth(dateOfBirth)
  if (!dob || !(now instanceof Date) || Number.isNaN(now.getTime())) return false
  const today = { year: now.getUTCFullYear(), month: now.getUTCMonth(), day: now.getUTCDate() }
  const birthday = { year: dob.getUTCFullYear(), month: dob.getUTCMonth(), day: dob.getUTCDate() }
  const birthdayPassed = today.month > birthday.month || (today.month === birthday.month && today.day >= birthday.day)
  return today.year - birthday.year - (birthdayPassed ? 0 : 1) >= minimumAge
}

export function validateTeacherDateOfBirth(value, now = new Date()) {
  const date = parseDateOfBirth(value)
  if (!date) return { valid: false, message: 'Enter a valid date of birth.' }
  if (date > now) return { valid: false, message: 'Date of birth cannot be in the future.' }
  if (!hasReachedAge(date, 18, now)) return { valid: false, message: 'Teacher accounts are available only to applicants aged 18 or older.' }
  return { valid: true, date }
}
