import crypto from 'node:crypto'
import express from 'express'
import Contact from '../models/Contact.js'
import Call from '../models/Call.js'
import Activity from '../models/Activity.js'
import Communication, { CALL_OUTCOMES } from '../models/Communication.js'
import { authenticate } from '../auth.js'
import { sendSms, smsConfig, normalizeTwilioStatus, verifyTwilioSignature } from '../services/smsProvider.js'

const router = express.Router()
const access = (req, id) => req.user.role === 'admin' ? { _id: id } : { _id: id, $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] }
const phonePattern = /^\+?[1-9]\d{7,14}$/
const safePhone = (value) => String(value || '').replace(/[\s().-]/g, '')

// Provider callbacks are authenticated with the provider secret, not a user session.
router.post('/webhook/twilio', async (req, res) => {
  if (!verifyTwilioSignature(req)) return res.status(401).send('Invalid webhook signature')
  const id = req.body.MessageSid
  const record = await Communication.findOne({ providerMessageId: id, type: 'sms' })
  if (!record) return res.sendStatus(204)
  const next = normalizeTwilioStatus(req.body.MessageStatus)
  const rank = { queued: 1, accepted: 2, sent: 3, delivered: 4, failed: 4, undelivered: 4, unknown: 0 }
  if (rank[next] >= rank[record.status]) { record.status = next; if (next === 'delivered') record.deliveredAt = new Date(); if (['failed', 'undelivered'].includes(next)) record.failureDescription = req.body.ErrorMessage || 'Provider reported delivery failure'; await record.save() }
  res.sendStatus(204)
})

router.use(authenticate)

function serialize(item) {
  const value = item.toObject ? item.toObject() : item
  return { ...value, recipientPhone: value.recipientPhone ? `••••••${value.recipientPhone.slice(-4)}` : '' }
}

router.get('/config', (_req, res) => res.json({ enabled: smsConfig().enabled, provider: smsConfig().provider }))

router.get('/contact/:contactId', async (req, res) => {
  const contact = await Contact.findOne(access(req, req.params.contactId)).select('_id')
  if (!contact) return res.status(404).json({ message: 'Contact not found' })
  const [communications, calls, activities] = await Promise.all([
    Communication.find({ contact: contact._id, type: 'sms' }).sort({ createdAt: -1 }).limit(100).populate('initiatedBy', 'name email'),
    Call.find({ contact: contact._id }).sort({ createdAt: -1 }).limit(100),
    Activity.find({ contact: contact._id }).sort({ createdAt: -1 }).limit(100),
  ])
  const records = [
    ...communications.map((item) => ({ ...serialize(item), kind: 'sms' })),
    ...calls.map((item) => ({ ...(item.toObject ? item.toObject() : item), kind: 'call', type: 'call', outcome: item.status, initiatedBy: item.createdBy })),
    ...activities.map((item) => ({ ...(item.toObject ? item.toObject() : item), kind: 'note', type: 'note', outcome: item.outcome || '', initiatedBy: item.createdBy })),
  ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 200)
  res.json(records)
})

router.post('/sms', async (req, res) => {
  const { contactId, message, idempotencyKey } = req.body
  if (!contactId || !message?.trim()) return res.status(400).json({ message: 'A contact and message are required' })
  if (message.trim().length > 1600) return res.status(400).json({ message: 'Message is too long' })
  if (!idempotencyKey || String(idempotencyKey).length > 100) return res.status(400).json({ message: 'A valid request key is required' })
  const contact = await Contact.findOne(access(req, contactId))
  if (!contact) return res.status(404).json({ message: 'Contact not found' })
  if (contact.smsConsent?.status !== 'granted') return res.status(403).json({ message: 'SMS consent has not been granted for this contact' })
  const to = safePhone(contact.phone)
  if (!phonePattern.test(to)) return res.status(400).json({ message: 'A valid guardian phone number is required' })
  const existing = await Communication.findOne({ idempotencyKey })
  if (existing) return res.json(serialize(existing))
  const record = await Communication.create({ contact: contact._id, type: 'sms', initiatedBy: req.user._id, recipientPhone: to, message: message.trim(), provider: process.env.SMS_PROVIDER || '', idempotencyKey, status: 'queued' })
  try {
    const result = await sendSms({ to, body: message.trim() })
    record.provider = result.provider; record.providerMessageId = result.providerMessageId; record.status = result.status; record.sentAt = ['sent', 'delivered'].includes(result.status) ? new Date() : null
    await record.save()
    return res.status(201).json(serialize(record))
  } catch (error) {
    record.status = error.code === 'SMS_NOT_CONFIGURED' ? 'unknown' : 'failed'; record.failureCode = error.code || 'SMS_ERROR'; record.failureDescription = error.message
    await record.save()
    return res.status(error.code === 'SMS_NOT_CONFIGURED' ? 503 : 502).json({ message: error.message, communication: serialize(record) })
  }
})

router.post('/call', async (req, res) => {
  const { contactId, idempotencyKey } = req.body
  const contact = await Contact.findOne(access(req, contactId))
  if (!contact) return res.status(404).json({ message: 'Contact not found' })
  const to = safePhone(contact.phone)
  if (!phonePattern.test(to)) return res.status(400).json({ message: 'A valid guardian phone number is required' })
  const key = idempotencyKey || crypto.randomUUID()
  const existing = await Communication.findOne({ idempotencyKey: key })
  if (existing) return res.json(serialize(existing))
  const record = await Communication.create({ contact: contact._id, type: 'call', initiatedBy: req.user._id, recipientPhone: to, status: 'unknown', outcome: 'initiated', outcomeRecordedAt: new Date(), idempotencyKey: key })
  res.status(201).json({ ...serialize(record), dialNumber: to })
})

router.patch('/call/:id', async (req, res) => {
  const { outcome } = req.body
  if (!CALL_OUTCOMES.includes(outcome) || outcome === 'initiated') return res.status(400).json({ message: 'A reportable call outcome is required' })
  const record = await Communication.findOne({ _id: req.params.id, type: 'call', initiatedBy: req.user._id })
  if (!record) return res.status(404).json({ message: 'Call record not found' })
  record.outcome = outcome; record.outcomeRecordedAt = new Date(); await record.save(); res.json(serialize(record))
})

export default router
