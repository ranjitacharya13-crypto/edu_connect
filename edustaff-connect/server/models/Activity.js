import mongoose from 'mongoose'

const activitySchema = new mongoose.Schema(
  {
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
    // Notes are always written against a tracked call, so history stays together.
    call: { type: mongoose.Schema.Types.ObjectId, ref: 'Call', default: null, index: true },
    type: {
      type: String,
      enum: ['call', 'note', 'missed-call', 'medical', 'admission'],
      required: true,
    },
    title: { type: String, required: true },
    contactName: { type: String, required: true },
    summary: { type: String, required: true },
    outcome: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
    createdBy: { type: String, default: 'Admin' },
    createdByAccount: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByRole: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  },
  { timestamps: true, collection: 'activities' },
)

export default mongoose.model('Activity', activitySchema)
