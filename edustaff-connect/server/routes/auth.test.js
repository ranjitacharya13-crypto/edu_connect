import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

let idCounter = 0
const nextId = () => `auth-test-${++idCounter}`

class FakeModel {
  static records = []
  static nextError = null

  static reset() {
    this.records = []
    this.nextError = null
  }

  static matches(document, query = {}) {
    return Object.entries(query).every(([key, expected]) => {
      const actual = document[key]
      if (expected && typeof expected === 'object' && '$gt' in expected) {
        return actual > expected.$gt
      }
      return String(actual) === String(expected)
    })
  }

  static async create(values) {
    const document = {
      _id: nextId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...values,
      async save() { return this },
    }
    this.records.push(document)
    return document
  }

  static findOne(query = {}) {
    if (this.nextError) {
      const error = this.nextError
      this.nextError = null
      return { select: () => Promise.reject(error), populate: () => Promise.reject(error) }
    }
    const find = () => this.records.find((document) => FakeModel.matches(document, query)) || null
    return {
      select: async () => find(),
      populate: async (field) => {
        const document = find()
        if (document && field === 'account' && this === globalThis.__authStubs.Session) {
          const accountModel = document.accountModel === 'Admin'
            ? globalThis.__authStubs.Admin
            : globalThis.__authStubs.User
          document.account = accountModel.records.find((account) => String(account._id) === String(document.account)) || null
        }
        return document
      },
    }
  }

  static async exists(query = {}) {
    const document = this.records.find((entry) => FakeModel.matches(entry, query))
    return document ? { _id: document._id } : null
  }
}

class FakeUser extends FakeModel {}
class FakeAdmin extends FakeModel {}
class FakeSession extends FakeModel {}

FakeUser.records = []
FakeAdmin.records = []
FakeSession.records = []

globalThis.__authStubs = { User: FakeUser, Admin: FakeAdmin, Session: FakeSession }

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/models/User.js')) return { url: 'auth-stub:User', shortCircuit: true }
    if (specifier.endsWith('/models/Admin.js')) return { url: 'auth-stub:Admin', shortCircuit: true }
    if (specifier.endsWith('/models/Session.js')) return { url: 'auth-stub:Session', shortCircuit: true }
    if (specifier.endsWith('/db.js')) return { url: 'auth-stub:db', shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.startsWith('auth-stub:')) return next(url, context)
    if (url === 'auth-stub:User') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__authStubs.User' }
    if (url === 'auth-stub:Admin') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__authStubs.Admin' }
    if (url === 'auth-stub:Session') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__authStubs.Session' }
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export const verifyPersisted = async () => true
        export const isDatabaseUnavailable = (error) =>
          ['MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoTopologyClosedError'].includes(error?.name) ||
          ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error?.code)
      `,
    }
  },
})

const express = (await import('express')).default
const { hashPassword } = await import('../auth.js')
const authRouter = (await import('./auth.js')).default
const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use((error, _request, response, _next) => {
  response.status(500).json({ message: 'Request could not be completed' })
})

const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/auth`
test.after(() => server.close())

const request = (path, body, options = {}) => fetch(`${base}${path}`, {
  method: options.method || 'POST',
  headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
})

function resetModels() {
  FakeUser.reset()
  FakeAdmin.reset()
  FakeSession.reset()
}

test('registered teacher can log in with case-normalized email and access the session', async () => {
  resetModels()
  await FakeUser.create({
    username: 'teacher',
    name: 'Test Teacher',
    email: 'teacher@example.test',
    password: hashPassword('  correct-password  '),
    role: 'teacher',
    permissions: { canUploadStudents: true },
  })

  const response = await request('/login', { email: ' Teacher@Example.Test ', password: '  correct-password  ' })
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.user.role, 'teacher')
  assert.ok(result.token)

  const meResponse = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${result.token}` } })
  assert.equal(meResponse.status, 200)
  assert.equal((await meResponse.json()).email, 'teacher@example.test')
})

test('invalid password and unknown email have the same generic response', async () => {
  resetModels()
  await FakeUser.create({
    username: 'teacher',
    name: 'Test Teacher',
    email: 'teacher@example.test',
    password: hashPassword('correct-password'),
    role: 'teacher',
  })

  const invalidPassword = await request('/login', { email: 'teacher@example.test', password: 'wrong-password' })
  const unknownEmail = await request('/login', { email: 'unknown@example.test', password: 'wrong-password' })
  assert.equal(invalidPassword.status, 401)
  assert.deepEqual(await invalidPassword.json(), await unknownEmail.json())
})

test('missing credentials are validation errors and do not query accounts', async () => {
  resetModels()
  const missingEmail = await request('/login', { password: 'a-password' })
  const missingPassword = await request('/login', { email: 'teacher@example.test' })
  assert.equal(missingEmail.status, 400)
  assert.equal(missingPassword.status, 400)
  assert.equal(FakeAdmin.records.length, 0)
  assert.equal(FakeUser.records.length, 0)
})

test('database selection failure returns a safe service-unavailable response', async () => {
  resetModels()
  FakeAdmin.nextError = Object.assign(new Error('sensitive database detail'), { name: 'MongoServerSelectionError' })
  const originalError = console.error
  console.error = () => {}
  try {
    const response = await request('/login', { email: 'teacher@example.test', password: 'a-password' })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { message: 'Authentication service is temporarily unavailable' })
  } finally {
    console.error = originalError
  }
})

test('registration followed by login preserves teacher role and rejects expired sessions', async () => {
  resetModels()
  const signupResponse = await request('/signup', {
    name: 'New Teacher',
    email: ' NEW.TEACHER@EXAMPLE.TEST ',
    phone: '5550100',
    dateOfBirth: '1990-01-01',
    password: 'teacher-password',
  })
  assert.equal(signupResponse.status, 201)
  const signup = await signupResponse.json()
  assert.equal(signup.user.email, 'new.teacher@example.test')

  const loginResponse = await request('/login', { email: 'NEW.TEACHER@EXAMPLE.TEST', password: 'teacher-password' })
  assert.equal(loginResponse.status, 200)
  const login = await loginResponse.json()
  assert.equal(login.user.role, 'teacher')
  for (const session of FakeSession.records) session.expiresAt = new Date(Date.now() - 1000)
  const expiredResponse = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${login.token}` } })
  assert.equal(expiredResponse.status, 401)
})

test('admin login retains administrator permissions', async () => {
  resetModels()
  await FakeAdmin.create({
    adminId: 'ADMIN-TEST',
    name: 'Test Admin',
    email: 'ranjit1@gmail.com',
    credentialHash: hashPassword('admin-password'),
    role: 'admin',
    permissions: {},
  })

  const response = await request('/login', { email: ' RANJIT1@GMAIL.COM ', password: 'admin-password' })
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.user.role, 'admin')
  assert.equal(result.user.permissions.canManageUsers, true)
})
