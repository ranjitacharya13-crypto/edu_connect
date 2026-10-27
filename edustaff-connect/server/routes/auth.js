import express from 'express'
import { Admin, authenticate, createSession, hashPassword, publicUser, User, verifyPassword } from '../auth.js'
import { ADMIN_EMAIL, permissionsForRole } from '../rbac.js'
import { verifyPersisted } from '../db.js'
import { validateTeacherDateOfBirth } from '../services/ageValidation.js'
import { createTeacherAccount } from '../services/teacherAccounts.js'

const router = express.Router()

router.post('/signup', async (req, res) => {
  const { name, email, phone, dateOfBirth, password } = req.body
  if (!name?.trim() || !email?.trim() || !phone?.trim() || !password || password.length < 6) {
    return res.status(400).json({ message: 'Name, email, phone and a 6+ character password are required' })
  }
  const ageValidation = validateTeacherDateOfBirth(dateOfBirth)
  if (!ageValidation.valid) return res.status(400).json({ message: ageValidation.message, field: 'dateOfBirth' })
  const normalizedEmail = email.trim().toLowerCase()
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
  const email = req.body.email?.trim().toLowerCase()
  const admin = await Admin.findOne({ email }).select('+credentialHash')
  const user = admin || await User.findOne({ email }).select('+password')
  const storedCredential = admin?.credentialHash || user?.password
  if (!user || !verifyPassword(req.body.password || '', storedCredential)) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }
  if (admin) {
    user.lastLoginAt = new Date()
    user.permissions = permissionsForRole('admin')
    if (!user.credentialHash.includes(':')) user.credentialHash = hashPassword(req.body.password)
  } else {
    user.role = 'teacher'
    user.permissions = permissionsForRole('teacher')
    if (!user.password.includes(':')) user.password = hashPassword(req.body.password)
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

