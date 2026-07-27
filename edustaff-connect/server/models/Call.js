import mongoose from 'mongoose'
import { CALL_STATUSES } from '../callState.js'

const callSchema = new mongoose.Schema(
  {
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
    // Snapshot of who was dialled so history survives a contact edit or deletion.
    studentName: { type: String, default: '' },
    grade: { type: String, default: '' },
    contactName: { type: String, default: '' },
    phone: { type: String, default: '' },

    status: { type: String, enum: CALL_STATUSES, default: 'ringing', index: true },
    direction: { type: String, enum: ['outgoing', 'incoming'], default: 'outgoing' },

    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0, min: 0 },

    outcome: { type: String, default: '' },
    notesCount: { type: Number, default: 0, min: 0 },

    createdBy: { type: String, default: 'Admin' },
    createdByAccount: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    createdByRole: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  },
  { timestamps: true, collection: 'calls' },
)

callSchema.index({ createdAt: -1 })

export default mongoose.model('Call', callSchema)
