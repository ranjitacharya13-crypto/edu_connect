export function validateTeacherDateOfBirth(value, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Enter a valid date of birth.'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 'Enter a valid date of birth.'
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (date > current) return 'Date of birth cannot be in the future.'
  let age = current.getFullYear() - year
  if (current.getMonth() < month - 1 || (current.getMonth() === month - 1 && current.getDate() < day)) age -= 1
  return age >= 18 ? '' : 'Teacher accounts are available only to applicants aged 18 or older.'
}
