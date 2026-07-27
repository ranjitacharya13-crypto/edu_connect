import express from 'express'
import Activity from '../models/Activity.js'
import Call from '../models/Call.js'
import Contact from '../models/Contact.js'
import { authenticate } from '../auth.js'
import { verifyPersisted } from '../db.js'
import { buildStatusUpdate, formatDuration, isValidStatus, summarizeCalls } from '../callState.js'

const router = express.Router()
router.use(authenticate)

const isAdmin = (req) => req.user.role === 'admin'

/** Contacts an account is allowed to touch. */
function contactAccessQuery(req, contactId) {
  return isAdmin(req)
    ? { _id: contactId }
    : { _id: contactId, $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] }
}

/** Calls an account is allowed to read/update. */
async function callAccessQuery(req, callId = null) {
  const base = callId ? { _id: callId } : {}
  if (isAdmin(req)) return base

  const contactIds = await Contact
    .find({ $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] })
    .distinct('_id')

  return {
    ...base,
    $or: [{ createdByAccount: req.user._id }, { contact: { $in: contactIds } }],
  }
}

/** Shape a call for the client, including its linked notes. */
function serializeCall(call, notes = []) {
  const value = call.toObject ? call.toObject() : { ...call }
  return {
    ...value,
    durationLabel: formatDuration(value.durationSeconds),
    notes: notes.map((note) => (note.toObject ? note.toObject() : note)),
    notesCount: notes.length || value.notesCount || 0,
  }
}

/** Attach every note belonging to the supplied calls in one round trip. */
async function withNotes(calls) {
  if (!calls.length) return []
  const notes = await Activity
    .find({ call: { $in: calls.map((call) => call._id) } })
    .sort({ createdAt: -1 })

  const grouped = new Map()
  for (const note of notes) {
    const key = String(note.call)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(note)
  }

  return calls.map((call) => serializeCall(call, grouped.get(String(call._id)) || []))
}

/**
 * GET /api/calls - call history plus dashboard counters.
 * Optional filters: ?status=attended&contactId=<id>
 */
router.get('/', async (req, res) => {
  const query = await callAccessQuery(req)

  if (req.query.status && isValidStatus(req.query.status)) {
    query.status = req.query.status
  }
  if (req.query.contactId) {
    query.contact = req.query.contactId
  }

  const calls = await Call.find(query).sort({ startedAt: -1, createdAt: -1 }).limit(200)
  const history = await withNotes(calls)
  res.json({ calls: history, summary: summarizeCalls(history) })
})

/**
 * POST /api/calls - a teacher pressed the call button; start tracking immediately.
 */
router.post('/', async (req, res) => {
  const { contactId } = req.body
  if (!contactId) {
    return res.status(400).json({ message: 'A contact is required to start a call' })
  }

  const contact = await Contact.findOne(contactAccessQuery(req, contactId))
  if (!contact) {
    return res.status(404).json({ message: 'Contact not found' })
  }

  const call = await Call.create({
    contact: contact._id,
    studentName: contact.student?.name || '',
    grade: contact.student?.grade || '',
    contactName: contact.name || '',
    phone: contact.phone || '',
    status: 'ringing',
    direction: 'outgoing',
    startedAt: new Date(),
    createdBy: req.user.name || req.user.email,
    createdByAccount: req.user._id,
    createdByRole: req.user.role,
  })
  await verifyPersisted(Call, call._id, 'call')
  res.status(201).json(serializeCall(call))
})

/**
 * PATCH /api/calls/:id - record the outcome (attended, missed, no answer…).
 */
router.patch('/:id', async (req, res) => {
  const { status, outcome, durationSeconds } = req.body
  if (status && !isValidStatus(status)) {
    return res.status(400).json({ message: `Unknown call status: ${status}` })
  }

  const access = await callAccessQuery(req, req.params.id)
  const existing = await Call.findOne(access)
  if (!existing) {
    return res.status(404).json({ message: 'Call not found' })
  }

  const update = status
    ? buildStatusUpdate(status, { startedAt: existing.startedAt, outcome, durationSeconds })
    : { ...(typeof outcome === 'string' ? { outcome: outcome.trim() } : {}) }

  const call = await Call.findByIdAndUpdate(existing._id, update, { new: true, runValidators: true })
  await verifyPersisted(Call, call._id, 'call update')

  const notes = await Activity.find({ call: call._id }).sort({ createdAt: -1 })
  res.json(serializeCall(call, notes))
})

/**
 * GET /api/calls/:id/notes - notes recorded against one call.
 */
router.get('/:id/notes', async (req, res) => {
  const access = await callAccessQuery(req, req.params.id)
  const call = await Call.findOne(access)
  if (!call) return res.status(404).json({ message: 'Call not found' })

  const notes = await Activity.find({ call: call._id }).sort({ createdAt: -1 })
  res.json(notes)
})

/**
 * POST /api/calls/:id/notes - notes always hang off a call in its history.
 */
router.post('/:id/notes', async (req, res) => {
  const summary = req.body.summary?.trim()
  if (!summary) {
    return res.status(400).json({ message: 'Note text is required' })
  }

  const access = await callAccessQuery(req, req.params.id)
  const call = await Call.findOne(access)
  if (!call) return res.status(404).json({ message: 'Call not found' })

  const contactName = call.studentName || call.contactName || 'General'
  const note = await Activity.create({
    contact: call.contact,
    call: call._id,
    type: 'note',
    title: `Note for ${contactName}`,
    contactName,
    summary,
    outcome: call.status,
    priority: req.body.priority || 'normal',
    createdBy: req.user.name || req.user.email,
    createdByAccount: req.user._id,
    createdByRole: req.user.role,
  })
  await verifyPersisted(Activity, note._id, 'call note')

  const notesCount = await Activity.countDocuments({ call: call._id })
  await Call.findByIdAndUpdate(call._id, { $set: { notesCount } })

  res.status(201).json(note)
})

/**
 * DELETE /api/calls/:id - remove a tracked call and its notes (admin only).
 */
router.delete('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: 'Administrator access required' })
  }
  const call = await Call.findByIdAndDelete(req.params.id)
  if (!call) return res.status(404).json({ message: 'Call not found' })

  await Activity.deleteMany({ call: call._id })
  res.status(204).send()
})

export default router
