import mongoose from 'mongoose'

export const COMMUNICATION_STATUSES = ['queued', 'accepted', 'sent', 'delivered', 'failed', 'undelivered', 'unknown']
export const CALL_OUTCOMES = ['initiated', 'connected', 'no_answer', 'busy', 'failed', 'unknown']

const communicationSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  type: { type: String, enum: ['sms', 'call'], required: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientPhone: { type: String, default: '' },
  message: { type: String, default: '' },
  provider: { type: String, default: '' },
  providerMessageId: { type: String, default: '', index: true },
  status: { type: String, enum: COMMUNICATION_STATUSES, default: 'queued', index: true },
  outcome: { type: String, enum: [...CALL_OUTCOMES, ''], default: '' },
  failureCode: { type: String, default: '' },
  failureDescription: { type: String, default: '' },
  sentAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  outcomeRecordedAt: { type: Date, default: null },
  idempotencyKey: { type: String, required: true, unique: true },
}, { timestamps: true, collection: 'communications' })

communicationSchema.index({ contact: 1, createdAt: -1 })
export default mongoose.model('Communication', communicationSchema)
