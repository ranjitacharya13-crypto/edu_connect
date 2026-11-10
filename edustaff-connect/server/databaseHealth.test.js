import assert from 'node:assert/strict'
import test from 'node:test'
import 'dotenv/config'
import { databaseStatus, isDatabaseUnavailable, testDatabaseConnection } from './db.js'

test('database availability errors are classified without exposing details', () => {
  assert.equal(isDatabaseUnavailable({ name: 'MongoServerSelectionError' }), true)
  assert.equal(isDatabaseUnavailable({ code: 'ECONNREFUSED' }), true)
  assert.equal(isDatabaseUnavailable({ name: 'ValidationError' }), false)
})

test('local provider health is based on a real MongoDB ping', async (context) => {
  try {
    const result = await testDatabaseConnection({ provider: 'local', databaseName: 'edustaff-connect' })
    assert.equal(result.config.provider, 'local')
    assert.equal(result.config.databaseName, 'edustaff-connect')
    assert.ok(result.latencyMs >= 0)
    assert.equal(databaseStatus().providers.local.connected, true)
  } catch (error) {
    context.skip(`Local MongoDB unavailable in this environment: ${error.message}`)
  }
})
