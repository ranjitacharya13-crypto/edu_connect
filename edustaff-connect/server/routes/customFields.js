import express from 'express'
import CustomField from '../models/CustomField.js'
import { authenticate, requireAdmin } from '../auth.js'
import { validateDefinition } from '../services/customFields.js'

const router = express.Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.includeArchived === 'true' ? {} : { state: 'active' }
  const fields = await CustomField.find(filter).sort({ order: 1, createdAt: 1 }).lean()
  res.json(fields)
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const definition = validateDefinition(req.body)
    const field = await CustomField.create({ ...definition, createdBy: req.user._id })
    res.status(201).json(field)
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Field ID already exists' : error.message })
  }
})

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const current = await CustomField.findById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Custom field not found' })
    const definition = validateDefinition({ ...current.toObject(), ...req.body }, current)
    if (definition.key !== current.key) return res.status(400).json({ message: 'Field IDs cannot be changed after creation' })
    Object.assign(current, definition)
    await current.save()
    res.json(current)
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.message })
  }
})

router.post('/:id/restore', requireAdmin, async (req, res) => {
  const field = await CustomField.findByIdAndUpdate(req.params.id, { state: 'active' }, { new: true, runValidators: true })
  if (!field) return res.status(404).json({ message: 'Custom field not found' })
  res.json(field)
})

export default router
