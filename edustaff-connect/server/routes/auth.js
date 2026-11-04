import express from 'express'
import { Admin, authenticate, createSession, hashPassword, publicUser, User, verifyPassword } from '../auth.js'
import { ADMIN_EMAIL, permissionsForRole } from '../rbac.js'
import { isDatabaseUnavailable, verifyPersisted } from '../db.js'
import { validateTeacherDateOfBirth } from '../services/ageValidation.js'
import { createTeacherAccount } from '../services/teacherAccounts.js'

const router = express.Router()

router.post('/signup', async (req, res) => {
  const { name, phone, dateOfBirth, password } = req.body || {}
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email) || !phone?.trim() || !password || password.length < 6) {
    return res.status(400).json({ message: 'Name, email, phone and a 6+ character password are required' })
  }
  const ageValidation = validateTeacherDateOfBirth(dateOfBirth)
  if (!ageValidation.valid) return res.status(400).json({ message: ageValidation.message, field: 'dateOfBirth' })
  const normalizedEmail = email
  if (normalizedEmail === ADMIN_EMAIL) {
    return res.status(403).json({ message: 'The administrator address cannot be registered publicly' })
  }
  if (await User.exists({ email: normalizedEmail }) || await Admin.exists({ email: normalizedEmail })) {
    return res.status(409).json({ message: 'An account with this email already exists' })
  }

  const user = await createTeacherAccount({ name, email: normalizedEmail, phone, dateOfBirth, password })
  await verifyPersisted(User, user._id, 'user account')
  const token = await createSession(user)
  res.status(201).json({ token, user: publicUser(user) })
})

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'A valid email is required' })
  }

  let admin
  let user
  try {
    admin = await Admin.findOne({ email }).select('+credentialHash')
    user = admin || await User.findOne({ email }).select('+password')
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error
    console.error('Authentication database unavailable:', { name: error.name, code: error.code })
    return res.status(503).json({ message: 'Authentication service is temporarily unavailable' })
  }

  const storedCredential = admin?.credentialHash || user?.password
  if (!user || !verifyPassword(password, storedCredential)) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }
  if (admin) {
    user.lastLoginAt = new Date()
    user.permissions = permissionsForRole('admin')
    if (!user.credentialHash.includes(':')) user.credentialHash = hashPassword(password)
  } else {
    user.role = 'teacher'
    user.permissions = permissionsForRole('teacher')
    if (!user.password.includes(':')) user.password = hashPassword(password)
  }
  await user.save()
  await verifyPersisted(admin ? Admin : User, user._id, 'account login update')
  const token = await createSession(user)
  res.json({ token, user: publicUser(user) })
})

router.get('/me', authenticate, (req, res) => res.json(publicUser(req.user)))

router.post('/logout', authenticate, async (req, res) => {
  await req.session.deleteOne()
  res.status(204).send()
})

export default router
