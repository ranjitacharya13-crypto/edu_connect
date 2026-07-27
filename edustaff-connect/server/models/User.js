import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    age: { type: Number },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['teacher'],
      default: 'teacher',
    },
    permissions: {
      canUploadStudents: { type: Boolean, default: true },
      canEditContacts: { type: Boolean, default: true },
      canBulkUpload: { type: Boolean, default: false },
      canAssignContacts: { type: Boolean, default: false },
      canDeleteContacts: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
      canViewMetrics: { type: Boolean, default: false },
    },
  },
  { timestamps: true, collection: 'users' },
)

export default mongoose.model('User', userSchema)
