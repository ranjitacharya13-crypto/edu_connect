import express from 'express'
import { authenticate, requireAdmin, User } from '../auth.js'
import Contact from '../models/Contact.js'
import Session from '../models/Session.js'
import { publicUser } from '../rbac.js'
import { assertWriteAcknowledged, verifyPersisted } from '../db.js'

const router = express.Router()
router.use(authenticate, requireAdmin)

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

export default router
