export const ADMIN_EMAIL = 'ranjit1@gmail.com'

export const adminPermissions = Object.freeze({
  canUploadStudents: true,
  canEditContacts: true,
  canBulkUpload: true,
  canAssignContacts: true,
  canDeleteContacts: true,
  canManageUsers: true,
  canViewMetrics: true,
})

export const teacherPermissions = Object.freeze({
  canUploadStudents: true,
  canEditContacts: true,
  canBulkUpload: false,
  canAssignContacts: false,
  canDeleteContacts: false,
  canManageUsers: false,
  canViewMetrics: false,
})

export function roleForEmail(email) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL ? 'admin' : 'teacher'
}

export function permissionsForRole(role) {
  return role === 'admin' ? { ...adminPermissions } : { ...teacherPermissions }
}

export function publicUser(user) {
  return {
    id: String(user._id),
    username: user.username || user.adminId,
    adminId: user.adminId,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    age: user.age || null,
    role: user.role,
    accessLevel: user.accessLevel,
    lastLoginAt: user.lastLoginAt,
    permissions: user.permissions,
    createdAt: user.createdAt,
  }
}

export function sanitizeContact(contact, role) {
  const value = contact.toObject ? contact.toObject() : { ...contact }
  if (role !== 'admin') {
    delete value.email
    delete value.status
    delete value.notes
  }
  return value
}
