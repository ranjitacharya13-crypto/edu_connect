import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'edustaff-db-config-'))
process.env.DB_CONFIG_FILE = path.join(tempDirectory, 'selection.json')
process.env.DB_AUDIT_FILE = path.join(tempDirectory, 'audit.log')
process.env.MONGODB_ATLAS_URI = 'mongodb+srv://user:password@example.mongodb.net/atlasdb?retryWrites=true'
process.env.MONGODB_LOCAL_URI = 'mongodb://127.0.0.1:27017/localdb'
process.env.DB_MODE = 'atlas'

const { resolveDatabaseConfig, savePersistedSelection, validateDatabaseName } = await import('./databaseConfig.js')

test('resolves safe public configuration without exposing credentials', () => {
  const config = resolveDatabaseConfig()
  assert.equal(config.provider, 'atlas')
  assert.equal(config.databaseName, 'atlasdb')
  assert.match(config.uri, /^mongodb\+srv:\/\/user:password@example\.mongodb\.net\/atlasdb/)
})

test('persists provider and database selection, not connection credentials', () => {
  savePersistedSelection({ provider: 'local', databaseName: 'edustaff_dev' })
  const stored = fs.readFileSync(process.env.DB_CONFIG_FILE, 'utf8')
  assert.match(stored, /edustaff_dev/)
  assert.doesNotMatch(stored, /password|mongodb:\/\//i)
  const config = resolveDatabaseConfig()
  assert.equal(config.provider, 'local')
  assert.equal(config.databaseName, 'edustaff_dev')
})

test('rejects unsafe database names', () => {
  assert.throws(() => validateDatabaseName('bad/name'), { code: 'INVALID_DATABASE_NAME' })
  assert.throws(() => validateDatabaseName('$admin'), { code: 'INVALID_DATABASE_NAME' })
})
