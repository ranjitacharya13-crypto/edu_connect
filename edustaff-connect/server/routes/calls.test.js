/**
 * Route-level tests for the call tracking API.
 *
 * MongoDB is not available in CI, so the Mongoose models are replaced with a
 * tiny in-memory store via `module.registerHooks`. That keeps the real router,
 * the real Express stack and the real access rules under test.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

let idCounter = 0
const nextId = () => `id-${++idCounter}`

/** Minimal stand-in for a Mongoose model backed by an array. */
class FakeModel {
  constructor(name) {
    this.name = name
    this.docs = []
  }

  reset() {
    this.docs = []
  }

  static matches(doc, query = {}) {
    return Object.entries(query).every(([key, expected]) => {
      if (key === '$or') {
        return expected.some((clause) => FakeModel.matches(doc, clause))
      }
      const actual = doc[key]
      if (expected && typeof expected === 'object' && '$in' in expected) {
        return expected.$in.map(String).includes(String(actual))
      }
      return String(actual) === String(expected)
    })
  }

  async create(payload) {
    const doc = { _id: nextId(), createdAt: new Date(), updatedAt: new Date(), ...payload }
    doc.toObject = () => ({ ...doc, toObject: undefined })
    this.docs.push(doc)
    return doc
  }

  find(query = {}) {
    let results = this.docs.filter((doc) => FakeModel.matches(doc, query))
    const chain = {
      sort: () => chain,
      limit: () => chain,
      distinct: (field) => Promise.resolve(results.map((doc) => doc[field])),
      then: (resolve, reject) => Promise.resolve(results).then(resolve, reject),
    }
    return chain
  }

  async findOne(query = {}) {
    return this.docs.find((doc) => FakeModel.matches(doc, query)) || null
  }

  async findByIdAndUpdate(id, update = {}, _options = {}) {
    const doc = this.docs.find((entry) => String(entry._id) === String(id))
    if (!doc) return null
    Object.assign(doc, update.$set ? update.$set : update)
    return doc
  }

  async findByIdAndDelete(id) {
    const index = this.docs.findIndex((entry) => String(entry._id) === String(id))
    if (index === -1) return null
    return this.docs.splice(index, 1)[0]
  }

  async deleteMany(query = {}) {
    const before = this.docs.length
    this.docs = this.docs.filter((doc) => !FakeModel.matches(doc, query))
    return { acknowledged: true, deletedCount: before - this.docs.length }
  }

  async countDocuments(query = {}) {
    return this.docs.filter((doc) => FakeModel.matches(doc, query)).length
  }

  async exists(query = {}) {
    const doc = await this.findOne(query)
    return doc ? { _id: doc._id } : null
  }
}

const Call = new FakeModel('Call')
const Activity = new FakeModel('Activity')
const Contact = new FakeModel('Contact')

let currentUser = null

// Swap the model + auth modules for the fakes before the router imports them.
registerHooks({
  resolve(specifier, context, next) {
    if (/models\/(Call|Activity|Contact)\.js$/.test(specifier) || /\/auth\.js$/.test(specifier) || /\/db\.js$/.test(specifier)) {
      return { url: `stub:${specifier}`, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.startsWith('stub:')) return next(url, context)

    if (url.includes('models/Call')) {
      return { format: 'module', shortCircuit: true, source: 'export default globalThis.__stubs.Call' }
    }
    if (url.includes('models/Activity')) {
      return { format: 'module', shortCircuit: true, source: 'export default globalThis.__stubs.Activity' }
    }
    if (url.includes('models/Contact')) {
      return { format: 'module', shortCircuit: true, source: 'export default globalThis.__stubs.Contact' }
    }
    if (url.includes('auth.js')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export const authenticate = (req, res, nextFn) => {
            const user = globalThis.__stubs.currentUser()
            if (!user) return res.status(401).json({ message: 'Authentication required' })
            req.user = user
            nextFn()
          }
          export const requireAdmin = (req, res, nextFn) =>
            req.user?.role === 'admin' ? nextFn() : res.status(403).json({ message: 'Administrator access required' })
        `,
      }
    }
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export const verifyPersisted = async () => true; export const assertWriteAcknowledged = (r) => r',
    }
  },
})

globalThis.__stubs = { Call, Activity, Contact, currentUser: () => currentUser }

const express = (await import('express')).default
const callsRouter = (await import('./calls.js')).default

const app = express()
app.use(express.json())
app.use('/api/calls', callsRouter)

const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/calls`

test.after(() => server.close())

const admin = { _id: 'admin-1', name: 'Ranjit', email: 'ranjit1@gmail.com', role: 'admin' }
const teacher = { _id: 'teacher-1', name: 'Asha', email: 'asha@school.test', role: 'teacher' }
const otherTeacher = { _id: 'teacher-2', name: 'Bimal', email: 'bimal@school.test', role: 'teacher' }

async function seed() {
  Call.reset(); Activity.reset(); Contact.reset()
  currentUser = teacher
  return Contact.create({
    name: 'Guardian One',
    phone: '+1 555-0100',
    student: { name: 'Riya Sharma', grade: 'Grade 5' },
    assignedTo: teacher._id,
    createdBy: teacher._id,
  })
}

const request = (path = '', options = {}) =>
  fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })

test('pressing call creates a tracked ringing call', async () => {
  const contact = await seed()
  const response = await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })
  const call = await response.json()

  assert.equal(response.status, 201)
  assert.equal(call.status, 'ringing')
  assert.equal(call.studentName, 'Riya Sharma')
  assert.equal(call.grade, 'Grade 5')
  assert.equal(call.phone, '+1 555-0100')
  assert.equal(call.createdBy, 'Asha')
  assert.ok(call.startedAt)
})

test('a call without a contact is rejected', async () => {
  await seed()
  const response = await request('', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(response.status, 400)
})

test('a teacher cannot call a contact they do not own', async () => {
  const contact = await seed()
  currentUser = otherTeacher
  const response = await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })
  assert.equal(response.status, 404)
})

test('marking a call attended records the outcome and duration', async () => {
  const contact = await seed()
  const created = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()

  const response = await request(`/${created._id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'attended', durationSeconds: 95 }),
  })
  const call = await response.json()

  assert.equal(response.status, 200)
  assert.equal(call.status, 'attended')
  assert.equal(call.durationSeconds, 95)
  assert.equal(call.durationLabel, '1m 35s')
  assert.ok(call.answeredAt)
  assert.ok(call.endedAt)
})

test('a missed call closes without an answered timestamp', async () => {
  const contact = await seed()
  const created = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  const call = await (await request(`/${created._id}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'missed' }),
  })).json()

  assert.equal(call.status, 'missed')
  // The schema defaults answeredAt to null; either way nothing may be stamped.
  assert.ok(!call.answeredAt)
  assert.ok(call.endedAt)
})

test('an unknown status is rejected', async () => {
  const contact = await seed()
  const created = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  const response = await request(`/${created._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banana' }) })
  assert.equal(response.status, 400)
})

test('history returns calls with a summary of attendance', async () => {
  const contact = await seed()
  const first = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  const second = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  await request(`/${first._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'attended', durationSeconds: 60 }) })
  await request(`/${second._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'missed' }) })

  const data = await (await request('')).json()
  assert.equal(data.calls.length, 2)
  assert.equal(data.summary.attended, 1)
  assert.equal(data.summary.unanswered, 1)
  assert.equal(data.summary.attendRate, 50)
  assert.equal(data.summary.talkTimeSeconds, 60)
})

test('notes attach to a call and come back with its history', async () => {
  const contact = await seed()
  const call = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  await request(`/${call._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'attended' }) })

  const noteResponse = await request(`/${call._id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ summary: 'Guardian confirmed the fee deadline.' }),
  })
  const note = await noteResponse.json()

  assert.equal(noteResponse.status, 201)
  assert.equal(note.call, call._id)
  assert.equal(note.contact, contact._id)
  assert.equal(note.type, 'note')
  assert.equal(note.contactName, 'Riya Sharma')

  const data = await (await request('')).json()
  assert.equal(data.calls[0].notes.length, 1)
  assert.equal(data.calls[0].notesCount, 1)
  assert.equal(data.calls[0].notes[0].summary, 'Guardian confirmed the fee deadline.')
})

test('an empty note is rejected', async () => {
  const contact = await seed()
  const call = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  const response = await request(`/${call._id}/notes`, { method: 'POST', body: JSON.stringify({ summary: '   ' }) })
  assert.equal(response.status, 400)
})

test('history can be filtered by status', async () => {
  const contact = await seed()
  const first = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  const second = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  await request(`/${first._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'attended' }) })
  await request(`/${second._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'missed' }) })

  const data = await (await request('?status=attended')).json()
  assert.equal(data.calls.length, 1)
  assert.equal(data.calls[0].status, 'attended')
})

test('teachers only see their own call history', async () => {
  const contact = await seed()
  await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })

  currentUser = otherTeacher
  const data = await (await request('')).json()
  assert.equal(data.calls.length, 0)

  currentUser = admin
  const adminView = await (await request('')).json()
  assert.equal(adminView.calls.length, 1)
})

test('only an admin can delete a call, and its notes go with it', async () => {
  const contact = await seed()
  const call = await (await request('', { method: 'POST', body: JSON.stringify({ contactId: contact._id }) })).json()
  await request(`/${call._id}/notes`, { method: 'POST', body: JSON.stringify({ summary: 'Follow up next week.' }) })

  const denied = await request(`/${call._id}`, { method: 'DELETE' })
  assert.equal(denied.status, 403)

  currentUser = admin
  const allowed = await request(`/${call._id}`, { method: 'DELETE' })
  assert.equal(allowed.status, 204)
  assert.equal(await Activity.countDocuments({ call: call._id }), 0)
})

test('unauthenticated requests are rejected', async () => {
  await seed()
  currentUser = null
  const response = await request('')
  assert.equal(response.status, 401)
  currentUser = teacher
})
