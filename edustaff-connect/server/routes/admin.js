import express from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, User } from '../auth.js'
import Contact from '../models/Contact.js'
import Session from '../models/Session.js'
import { publicUser } from '../rbac.js'
import { assertWriteAcknowledged, databaseStatus, switchDatabase, testDatabaseConnection, verifyPersisted } from '../db.js'
import { publicDatabaseConfig, resolveDatabaseConfig } from '../databaseConfig.js'
import { inspectLocalMongo, setupLocalMongo } from '../services/localMongo.js'

const router = express.Router()
router.use(authenticate, requireAdmin)
const operationTimes = new Map()

function limitDatabaseOperation(kind, seconds) {
  return (req, res, next) => {
    const key = `${kind}:${req.ip}`
    const elapsed = Date.now() - (operationTimes.get(key) || 0)
    if (elapsed < seconds * 1000) return res.status(429).json({ code: 'DATABASE_RATE_LIMITED', message: `Please wait before trying another database ${kind}.` })
    operationTimes.set(key, Date.now())
    next()
  }
}

router.get('/database/status', async (_req, res) => {
  const status = databaseStatus()
  status.localInstallation = await inspectLocalMongo()
  if (status.providers?.local) status.providers.local.installation = status.localInstallation
  return res.json(status)
})

router.get('/database/config', (_req, res) => {
  try { return res.json(publicDatabaseConfig(resolveDatabaseConfig())) } catch (error) { return res.status(503).json({ code: error.code || 'DATABASE_CONFIG_ERROR', message: error.message }) }
})

router.post('/database/test', limitDatabaseOperation('test', 10), async (req, res) => {
  try {
    const result = await testDatabaseConnection({ provider: req.body?.provider, databaseName: req.body?.databaseName })
    return res.json({ ...publicDatabaseConfig(result.config), connected: true, latencyMs: result.latencyMs })
  } catch (error) {
    return res.status(error.code === 'DATABASE_NOT_CONFIGURED' ? 422 : 503).json({ code: error.code || 'DATABASE_TEST_FAILED', message: error.message })
  }
})

router.post('/database/switch', limitDatabaseOperation('switch', 15), async (req, res) => {
  try {
    const result = await switchDatabase({ provider: req.body?.provider, databaseName: req.body?.databaseName }, req.user.email || req.user.adminId)
    return res.json(result)
  } catch (error) {
    return res.status(error.code === 'DATABASE_OPERATION_IN_PROGRESS' ? 409 : 503).json({ code: error.code || 'DATABASE_SWITCH_FAILED', message: error.message, status: databaseStatus() })
  }
})

router.post('/database/setup-local', limitDatabaseOperation('setup', 30), async (_req, res) => {
  const result = await setupLocalMongo()
  return res.status(result.action === 'permission_required' ? 403 : 200).json(result)
})

router.get('/database/local-detection', async (_req, res) => res.json(await inspectLocalMongo()))

router.get('/metrics', async (_req, res) => {
  const [teacherCount, contactCount] = await Promise.all([
    User.countDocuments({ role: 'teacher' }),
    Contact.countDocuments(),
  ])
  res.json({ teacherCount, contactCount })
})

router.get('/teachers', async (_req, res) => {
  const teachers = await User.find({ role: 'teacher' }).sort({ createdAt: -1 })
  res.json(teachers.map(publicUser))
})

router.delete('/teachers/:id', async (req, res) => {
  const teacher = await User.findOneAndDelete({ _id: req.params.id, role: 'teacher' })
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' })
  const [sessionsResult, contactsResult] = await Promise.all([
    Session.deleteMany({ account: teacher._id, accountModel: 'User' }),
    Contact.updateMany({ assignedTo: teacher._id }, { $set: { assignedTo: null } }),
  ])
  assertWriteAcknowledged(sessionsResult, 'session cleanup')
  assertWriteAcknowledged(contactsResult, 'contact unassignment')
  res.status(204).send()
})

router.patch('/contacts/:id/assignment', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid student ID' })
  const assignedTo = req.body.teacherId || null
  if (assignedTo && !(await User.exists({ _id: assignedTo, role: 'teacher' }))) {
    return res.status(400).json({ message: 'A valid teacher account is required' })
  }
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { $set: { assignedTo } },
    { new: true, runValidators: true },
  ).populate('assignedTo', 'name email')
  if (!contact) return res.status(404).json({ message: 'Contact not found' })
  await verifyPersisted(Contact, contact._id, 'contact assignment')
  res.json(contact)
})

router.patch('/contacts/bulk-assignment', async (req, res) => {
  const ids = [...new Set(Array.isArray(req.body.contactIds) ? req.body.contactIds.map(String) : [])]
  const teacherId = req.body.teacherId || null
  if (!ids.length) return res.status(400).json({ message: 'At least one student is required' })
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'One or more student IDs are invalid' })
  if (teacherId && (!mongoose.isValidObjectId(teacherId) || !(await User.exists({ _id: teacherId, role: 'teacher' })))) return res.status(400).json({ message: 'A valid teacher account is required' })
  const result = await Contact.updateMany({ _id: { $in: ids } }, { $set: { assignedTo: teacherId } })
  res.json({ requested: ids.length, matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified })
})

export default router
