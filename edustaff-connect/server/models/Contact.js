import mongoose from 'mongoose'

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, default: 'Guardian' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    student: {
      name: { type: String, required: true },
      grade: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['Primary Guardian', 'Medical Alert', 'New Admission', 'Absent Today', 'Inquiry'],
      default: 'Primary Guardian',
    },
    notes: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'contacts' },
)

export default mongoose.model('Contact', contactSchema)
