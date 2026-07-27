import express from 'express'
import Contact from '../models/Contact.js'
import { authenticate, requireAdmin } from '../auth.js'
import { sanitizeContact } from '../rbac.js'
import { verifyPersisted } from '../db.js'

const router = express.Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const search = req.query.search?.trim()
  const searchQuery = search
    ? {
        $or: [
          { name: new RegExp(search, 'i') },
          { 'student.name': new RegExp(search, 'i') },
          { status: new RegExp(search, 'i') },
        ],
      }
    : {}
  const accessQuery = req.user.role === 'admin'
    ? {}
    : { $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] }
  const query = { $and: [searchQuery, accessQuery] }

  const contacts = await Contact.find(query)
    .populate('assignedTo', 'name email')
    .sort({ updatedAt: -1 })
  res.json(contacts.map((contact) => sanitizeContact(contact, req.user.role)))
})

router.post('/', async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id }
  if (req.user.role !== 'admin') {
    delete payload.email
    delete payload.status
    delete payload.notes
    delete payload.assignedTo
  }
  const contact = await Contact.create(payload)
  await verifyPersisted(Contact, contact._id, 'contact')
  res.status(201).json(sanitizeContact(contact, req.user.role))
})

router.patch('/:id', async (req, res) => {
  const update = { ...req.body }
  delete update.assignedTo
  delete update.createdBy
  if (req.user.role !== 'admin') {
    delete update.email
    delete update.status
    delete update.notes
  }
  const access = req.user.role === 'admin'
    ? { _id: req.params.id }
    : { _id: req.params.id, $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] }
  const contact = await Contact.findOneAndUpdate(access, update, {
    new: true,
    runValidators: true,
  })

  if (!contact) {
    return res.status(404).json({ message: 'Contact not found' })
  }

  await verifyPersisted(Contact, contact._id, 'contact update')
  res.json(sanitizeContact(contact, req.user.role))
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const contact = await Contact.findByIdAndDelete(req.params.id)

  if (!contact) {
    return res.status(404).json({ message: 'Contact not found' })
  }

  res.status(204).send()
})

export default router
