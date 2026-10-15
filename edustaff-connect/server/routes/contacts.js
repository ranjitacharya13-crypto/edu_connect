import express from 'express'
import mongoose from 'mongoose'
import Contact from '../models/Contact.js'
import { authenticate, requireAdmin } from '../auth.js'
import { sanitizeContact } from '../rbac.js'
import { verifyPersisted } from '../db.js'

const router = express.Router()
router.use(authenticate)

const ADMISSION_TYPES = ['', 'Regular', 'Lateral Entry', 'Part Time']
const DEPARTMENTS = ['', 'CSE', 'Civil', 'AI/ML', 'Mech', 'ECE', 'EEE', 'Automobile']
const GRADES = ['', '1', '2', '3']
const STATUSES = ['', 'Primary Guardian', 'Medical Alert', 'New Admission', 'Absent Today', 'Inquiry']
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function listQuery(req) {
  const { search, grade, admissionType, department, status, assignedTo } = req.query
  if (grade && !GRADES.includes(grade)) throw new Error('Invalid year of study')
  if (admissionType && !ADMISSION_TYPES.includes(admissionType)) throw new Error('Invalid admission type')
  if (department && !DEPARTMENTS.includes(department)) throw new Error('Invalid department')
  if (admissionType === 'Part Time' && department && !['EEE', 'Mech'].includes(department)) throw new Error('Part Time students may only be in EEE or Mech')
  if (status && !STATUSES.includes(status)) throw new Error('Invalid student status')
  if (assignedTo && req.user.role !== 'admin') throw new Error('Assigned teacher filtering is restricted to administrators')
  if (assignedTo && !mongoose.isValidObjectId(assignedTo)) throw new Error('Invalid assigned teacher')
  const filters = []
  if (search?.trim()) { const value = new RegExp(escapeRegex(search.trim()), 'i'); filters.push({ $or: [{ name: value }, { 'student.name': value }, { status: value }] }) }
  if (grade) filters.push({ 'student.grade': grade })
  if (admissionType) filters.push({ 'student.admissionType': admissionType })
  if (department) filters.push({ 'student.department': department })
  if (status) filters.push({ status })
  if (assignedTo) filters.push({ assignedTo })
  filters.push(req.user.role === 'admin' ? {} : { $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] })
  return { $and: filters }
}

function csvValue(value) {
  const safe = String(value ?? '').replace(/^[=+\-@]/, "'")
  return `"${safe.replace(/"/g, '""')}"`
}

function csvFor(contacts) {
  const rows = [['Student', 'Phone', 'Year of study', 'Admission type', 'Department', 'Status', 'Assigned teacher']]
  for (const contact of contacts) rows.push([contact.student?.name || contact.name, contact.phone, contact.student?.grade, contact.student?.admissionType, contact.student?.department, contact.status, contact.assignedTo?.name || ''])
  return rows.map((row) => row.map(csvValue).join(',')).join('\r\n')
}

router.get('/', async (req, res) => {
  let query
  try { query = listQuery(req) } catch (error) { return res.status(400).json({ message: error.message }) }
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || '20', 10) || 20))
  const [total, contacts] = await Promise.all([
    Contact.countDocuments(query),
    Contact.find(query).skip((page - 1) * pageSize).limit(pageSize)
    .populate('assignedTo', 'name email')
    .sort({ updatedAt: -1, _id: 1 }),
  ])
  res.json({ contacts: contacts.map((contact) => sanitizeContact(contact, req.user.role)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
})

router.get('/export', async (req, res) => {
  let query
  try { query = listQuery(req) } catch (error) { return res.status(400).json({ message: error.message }) }
  const selected = req.query.ids ? [...new Set(String(req.query.ids).split(',').filter(Boolean))] : null
  if (selected?.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'Invalid selected student ID' })
  if (selected?.length) query = { $and: [query, { _id: { $in: selected } }] }
  const contacts = await Contact.find(query).populate('assignedTo', 'name email').sort({ updatedAt: -1, _id: 1 }).limit(5000)
  const csv = csvFor(contacts.map((contact) => sanitizeContact(contact, req.user.role)))
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="educonnect-students.csv"' }).send(csv)
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
