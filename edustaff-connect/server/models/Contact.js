import mongoose from 'mongoose'
import { STUDENT_ADMISSION_TYPES, STUDENT_DEPARTMENT_OPTIONS } from '../../shared/studentOptions.js'

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, default: 'Guardian' },
    phone: { type: String, trim: true },
    smsConsent: {
      status: { type: String, enum: ['unknown', 'granted', 'revoked'], default: 'unknown' },
      source: { type: String, default: '' },
      grantedAt: { type: Date, default: null },
    },
    email: { type: String, trim: true, lowercase: true },
    student: {
      name: { type: String, required: true },
      grade: { type: String, default: '' },
      admissionType: {
        type: String,
        enum: ['', ...STUDENT_ADMISSION_TYPES],
        default: '',
      },
      department: {
        type: String,
        enum: ['', ...STUDENT_DEPARTMENT_OPTIONS],
        default: '',
      },
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

