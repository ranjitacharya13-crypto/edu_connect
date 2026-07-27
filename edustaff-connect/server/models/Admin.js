import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    credentialHash: { type: String, required: true, select: false },
    accessLevel: {
      type: String,
      enum: ['super-admin', 'admin'],
      default: 'super-admin',
    },
    role: { type: String, enum: ['admin'], default: 'admin' },
    permissions: {
      canUploadStudents: { type: Boolean, default: true },
      canEditContacts: { type: Boolean, default: true },
      canBulkUpload: { type: Boolean, default: true },
      canAssignContacts: { type: Boolean, default: true },
      canDeleteContacts: { type: Boolean, default: true },
      canManageUsers: { type: Boolean, default: true },
      canViewMetrics: { type: Boolean, default: true },
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'admins' },
)

export default mongoose.model('Admin', adminSchema)
