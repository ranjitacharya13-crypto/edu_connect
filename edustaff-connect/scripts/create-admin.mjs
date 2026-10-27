import 'dotenv/config'
import Admin from '../server/models/Admin.js'
import { connectDatabase } from '../server/db.js'
import { hashPassword } from '../server/auth.js'
import { adminPermissions } from '../server/rbac.js'

const email = 'ranjit1@gmail.com'
const password = 'ranjit_1'

try {
  await connectDatabase()

  const admin = await Admin.findOneAndUpdate(
    { email },
    {
      $set: {
        adminId: 'SUPERADMIN-RANJIT1',
        name: 'ranjit',
        email,
        phone: '',
        credentialHash: hashPassword(password),
        accessLevel: 'super-admin',
        role: 'admin',
        permissions: adminPermissions,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )

  console.log('ADMIN_READY')
  console.log(JSON.stringify({
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    adminId: admin.adminId,
    role: admin.role,
    accessLevel: admin.accessLevel,
  }))
} catch (error) {
  console.error('ADMIN_CREATE_FAILED')
  console.error(error.message)
  process.exit(1)
}
