import { Admin, User, hashPassword } from '../auth.js'
import { permissionsForRole } from '../rbac.js'
import { validateTeacherDateOfBirth } from './ageValidation.js'
import { verifyPersisted } from '../db.js'

export const TEACHER_CSV_HEADERS = Object.freeze([
  'Full Name', 'Date of Birth', 'Phone', 'Email', 'Password',
])

export function validateTeacherInput(input) {
  const errors = {}
  const name = String(input?.name || '').trim()
  const email = String(input?.email || '').trim().toLowerCase()
  const phone = String(input?.phone || '').trim()
  const password = String(input?.password || '')
  if (!name) errors.name = 'Full name is required'
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'A valid email is required'
  if (!phone) errors.phone = 'Phone is required'
  if (password.length < 6) errors.password = 'Password must be at least 6 characters'
  const age = validateTeacherDateOfBirth(input?.dateOfBirth)
  if (!age.valid) errors.dateOfBirth = age.message
  return { errors, normalized: { name, email, phone, password, dateOfBirth: age.date } }
}

export async function createTeacherAccount(input) {
  const { errors, normalized } = validateTeacherInput(input)
  if (Object.keys(errors).length) {
    const error = new Error('Teacher account data is invalid')
    error.code = 'VALIDATION_ERROR'; error.fields = errors
    throw error
  }
  if (await User.exists({ email: normalized.email }) || await Admin.exists({ email: normalized.email })) {
    const error = new Error('An account with this email already exists')
    error.code = 'DUPLICATE_ACCOUNT'
    throw error
  }
  const base = normalized.email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || `teacher-${Date.now()}`
  let username = base; let suffix = 1
  while (await User.exists({ username })) username = `${base}-${suffix++}`
  let user
  try {
    user = await User.create({
      username, name: normalized.name, email: normalized.email, phone: normalized.phone,
      dateOfBirth: normalized.dateOfBirth, password: hashPassword(normalized.password),
      role: 'teacher', permissions: permissionsForRole('teacher'),
    })
  } catch (error) {
    if (error?.code === 11000) { error.code = 'DUPLICATE_ACCOUNT'; error.message = 'An account with this email or username already exists' }
    throw error
  }
  await verifyPersisted(User, user._id, 'teacher account')
  return user
}

