import Admin from './models/Admin.js'
import Session from './models/Session.js'
import User from './models/User.js'
import { ADMIN_EMAIL, adminPermissions } from './rbac.js'
import { assertWriteAcknowledged, verifyPersisted } from './db.js'
import { hashPassword } from './auth.js'

const DESIGNATED_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ranjit_1'

// Keep the designated administrator available in every selected database.
// Existing credentials are preserved; this only provisions a missing admin.
export async function ensureDesignatedAdmin() {
  let admin = await Admin.findOne({ email: ADMIN_EMAIL }).select('+credentialHash')
  if (!admin) {
    admin = await Admin.create({
      adminId: 'SUPERADMIN-RANJIT1',
      name: 'ranjit',
      email: ADMIN_EMAIL,
      phone: '',
      credentialHash: hashPassword(DESIGNATED_ADMIN_PASSWORD),
      accessLevel: 'super-admin',
      role: 'admin',
      permissions: adminPermissions,
    })
    await verifyPersisted(Admin, admin._id, 'designated administrator')
  }
  return admin
}

export async function migrateAccounts() {
  const legacyAdmin = await User.findOne({ email: ADMIN_EMAIL }).select('+password')
  let admin = await Admin.findOne({ email: ADMIN_EMAIL })

  if (!admin && legacyAdmin) {
    admin = await Admin.create({
      adminId: 'SUPERADMIN-RANJIT1',
      name: legacyAdmin.name || 'Ranjit',
      email: legacyAdmin.email,
      phone: legacyAdmin.phone || '',
      credentialHash: legacyAdmin.password,
      accessLevel: 'super-admin',
      role: 'admin',
      permissions: adminPermissions,
      createdAt: legacyAdmin.createdAt,
    })
    await verifyPersisted(Admin, admin._id, 'administrator migration')
  }

  if (legacyAdmin) {
    const [sessionResult, userResult] = await Promise.all([
      Session.deleteMany({ $or: [{ user: legacyAdmin._id }, { account: legacyAdmin._id }] }),
      User.deleteOne({ _id: legacyAdmin._id }),
    ])
    assertWriteAcknowledged(sessionResult, 'legacy session cleanup')
    assertWriteAcknowledged(userResult, 'legacy administrator cleanup')
  }

  if (admin) {
    admin.role = 'admin'
    admin.accessLevel = 'super-admin'
    admin.permissions = adminPermissions
    await admin.save()
    await verifyPersisted(Admin, admin._id, 'administrator')
  }

  await ensureDesignatedAdmin()
}
