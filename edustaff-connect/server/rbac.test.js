import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_EMAIL,
  adminPermissions,
  permissionsForRole,
  roleForEmail,
  sanitizeContact,
  teacherPermissions,
} from './rbac.js'

test('designated account is always the super admin', () => {
  assert.equal(roleForEmail(ADMIN_EMAIL), 'admin')
  assert.equal(roleForEmail(' RANJIT1@GMAIL.COM '), 'admin')
  assert.ok(Object.values(adminPermissions).every(Boolean))
})

test('public accounts receive limited teacher permissions', () => {
  assert.equal(roleForEmail('teacher@school.test'), 'teacher')
  assert.deepEqual(permissionsForRole('teacher'), teacherPermissions)
  assert.equal(teacherPermissions.canUploadStudents, true)
  assert.equal(teacherPermissions.canBulkUpload, false)
  assert.equal(teacherPermissions.canAssignContacts, false)
  assert.equal(teacherPermissions.canDeleteContacts, false)
  assert.equal(teacherPermissions.canManageUsers, false)
  assert.equal(teacherPermissions.canViewMetrics, false)
})

test('teacher contact responses remove guardian email, status and notes', () => {
  const contact = sanitizeContact({
    name: 'Guardian',
    phone: '123',
    email: 'private@example.com',
    status: 'Medical Alert',
    notes: 'private note',
  }, 'teacher')
  assert.equal(contact.name, 'Guardian')
  assert.equal(contact.phone, '123')
  assert.equal('email' in contact, false)
  assert.equal('status' in contact, false)
  assert.equal('notes' in contact, false)
})

test('admin contact responses preserve all contact fields', () => {
  const source = { email: 'guardian@example.com', status: 'Inquiry', notes: 'Visible' }
  assert.deepEqual(sanitizeContact(source, 'admin'), source)
})
