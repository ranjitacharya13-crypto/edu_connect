import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, verifyPassword } from './auth.js'

test('password sessions accept the correct password and reject an incorrect one', () => {
  const stored = hashPassword('test-password')
  assert.equal(verifyPassword('test-password', stored), true)
  assert.equal(verifyPassword('wrong-password', stored), false)
})

test('legacy plain-text credentials remain verifiable during migration', () => {
  assert.equal(verifyPassword('legacy-password', 'legacy-password'), true)
  assert.equal(verifyPassword('wrong-password', 'legacy-password'), false)
})

test('malformed stored hashes are rejected without throwing', () => {
  assert.equal(verifyPassword('password', 'salt:malformed'), false)
  assert.equal(verifyPassword('password', 'salt:' + 'a'.repeat(127)), false)
  assert.equal(verifyPassword(null, 'legacy-password'), false)
})
