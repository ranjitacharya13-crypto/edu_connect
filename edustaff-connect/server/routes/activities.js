import express from 'express'
import Activity from '../models/Activity.js'
import Contact from '../models/Contact.js'
import { authenticate } from '../auth.js'
import { verifyPersisted } from '../db.js'

const router = express.Router()
router.use(authenticate)

function contactAccessQuery(req, contactId) {
  return req.user.role === 'admin'
    ? { _id: contactId }
    : { _id: contactId, $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] }
}

router.get('/', async (req, res) => {
  const contactIds = req.user.role === 'admin'
    ? null
    : await Contact.find({ $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] }).distinct('_id')

  const query = req.user.role === 'admin'
    ? {}
    : { $or: [{ createdByAccount: req.user._id }, { contact: { $in: contactIds } }] }

  const activities = await Activity.find(query).sort({ createdAt: -1 }).limit(50)
  res.json(activities)
})

router.post('/', async (req, res) => {
  const { contactId, callId = null, summary, type = 'note', outcome = '', priority = 'normal' } = req.body
  if (!summary?.trim()) {
    return res.status(400).json({ message: 'Note text is required' })
  }

  const contact = contactId ? await Contact.findOne(contactAccessQuery(req, contactId)) : null
  if (contactId && !contact) {
    return res.status(404).json({ message: 'Contact not found' })
  }

  const contactName = contact?.student?.name || contact?.name || 'General'
  const activity = await Activity.create({
    contact: contact?._id || null,
    call: callId,
    type,
    title: type === 'note' ? `Note for ${contactName}` : req.body.title || 'Activity',
    contactName,
    summary: summary.trim(),
    outcome,
    priority,
    createdBy: req.user.name || req.user.email,
    createdByAccount: req.user._id,
    createdByRole: req.user.role,
  })
  await verifyPersisted(Activity, activity._id, 'activity')
  res.status(201).json(activity)
})

router.patch('/:id', async (req, res) => {
  const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  if (!activity) {
    return res.status(404).json({ message: 'Activity not found' })
  }

  await verifyPersisted(Activity, activity._id, 'activity update')
  res.json(activity)
})

export default router
