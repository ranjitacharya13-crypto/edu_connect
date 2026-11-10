import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DATABASE_PROVIDERS = Object.freeze({ local: 'local', atlas: 'atlas' })
export const DEFAULT_DATABASE_NAME = 'edustaff-connect'
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

export const DATABASE_CONFIG_FILE = process.env.DB_CONFIG_FILE || path.resolve(moduleDirectory, '..', '.runtime-db-config.json')
export const DATABASE_AUDIT_FILE = process.env.DB_AUDIT_FILE || path.resolve(moduleDirectory, '..', '.runtime-db-audit.log')

export function validateDatabaseName(name) {
  const value = String(name || '').trim()
  if (!DATABASE_NAME_PATTERN.test(value)) {
    const error = new Error('Database name must be 1-63 characters and contain only letters, numbers, hyphens, or underscores.')
    error.code = 'INVALID_DATABASE_NAME'
    throw error
  }
  return value
}

function parseDatabaseName(uri) {
  try {
    const parsed = new URL(uri)
    const value = parsed.pathname.replace(/^\//, '').split('/')[0]
    return value ? validateDatabaseName(decodeURIComponent(value)) : ''
  } catch { return '' }
}

function uriForDatabase(uri, databaseName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${encodeURIComponent(databaseName)}`
  return parsed.toString()
}

function configuredUri(provider) {
  if (provider === DATABASE_PROVIDERS.local) return process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/edustaff-connect'
  return process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI || (
    process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD && process.env.MONGODB_CLUSTER
      ? `mongodb+srv://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@${process.env.MONGODB_CLUSTER}/edustaff-connect?retryWrites=true&w=majority`
      : ''
  )
}

function validateUri(uri, provider) {
  if (!uri) {
    const error = new Error(`${provider === 'atlas' ? 'MongoDB Atlas' : 'Local MongoDB'} is not configured.`)
    error.code = 'DATABASE_NOT_CONFIGURED'
    throw error
  }
  let parsed
  try { parsed = new URL(uri) } catch {
    const error = new Error('The configured MongoDB URI is invalid.')
    error.code = 'INVALID_DATABASE_URI'
    throw error
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || (provider === 'local' && parsed.protocol !== 'mongodb:')) {
    const error = new Error('The configured MongoDB URI is not valid for the selected provider.')
    error.code = 'INVALID_DATABASE_URI'
    throw error
  }
  return uri
}

function readPersistedSelection() {
  try {
    const value = JSON.parse(fs.readFileSync(DATABASE_CONFIG_FILE, 'utf8'))
    return value && typeof value === 'object' ? value : {}
  } catch { return {} }
}

export function inferProvider() {
  const configured = String(process.env.DB_MODE || '').trim().toLowerCase()
  if (configured === DATABASE_PROVIDERS.local || configured === DATABASE_PROVIDERS.atlas) return configured
  return process.env.MONGODB_LOCAL_URI && !process.env.MONGODB_URI && !process.env.MONGODB_ATLAS_URI ? 'local' : 'atlas'
}

export function resolveDatabaseConfig(selection = {}) {
  const persisted = readPersistedSelection()
  const provider = selection.provider || persisted.provider || inferProvider()
  if (!Object.values(DATABASE_PROVIDERS).includes(provider)) {
    const error = new Error('Database provider must be local or atlas.')
    error.code = 'INVALID_DATABASE_PROVIDER'
    throw error
  }
  const rawUri = validateUri(configuredUri(provider), provider)
  const uriDatabaseName = parseDatabaseName(rawUri)
  const envDatabaseName = process.env.MONGODB_DB_NAME?.trim()
  if (envDatabaseName && uriDatabaseName && validateDatabaseName(envDatabaseName) !== uriDatabaseName && !selection.databaseName && !persisted.databaseName) {
    const error = new Error('MONGODB_DB_NAME conflicts with the database name in the configured MongoDB URI.')
    error.code = 'DATABASE_NAME_CONFLICT'
    throw error
  }
  const databaseName = validateDatabaseName(selection.databaseName || persisted.databaseName || envDatabaseName || uriDatabaseName || DEFAULT_DATABASE_NAME)
  return { provider, databaseName, uri: uriForDatabase(rawUri, databaseName), hostCategory: provider === 'local' ? 'local' : 'cloud', endpoint: provider === 'local' ? '127.0.0.1:27017' : 'MongoDB Atlas', configured: true }
}

export function publicDatabaseConfig(config) {
  return { provider: config.provider, databaseName: config.databaseName, hostCategory: config.hostCategory, endpoint: config.endpoint, configured: config.configured }
}

export function savePersistedSelection(selection) {
  const provider = selection.provider
  if (!Object.values(DATABASE_PROVIDERS).includes(provider)) throw new Error('Database provider must be local or atlas.')
  const databaseName = validateDatabaseName(selection.databaseName)
  fs.mkdirSync(path.dirname(DATABASE_CONFIG_FILE), { recursive: true })
  const temporaryFile = `${DATABASE_CONFIG_FILE}.${process.pid}.tmp`
  fs.writeFileSync(temporaryFile, `${JSON.stringify({ provider, databaseName, updatedAt: new Date().toISOString() }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(temporaryFile, DATABASE_CONFIG_FILE)
  return { provider, databaseName }
}

export function appendDatabaseAudit(entry) {
  const safeEntry = { timestamp: new Date().toISOString(), actor: entry.actor || 'system', operation: entry.operation, sourceProvider: entry.sourceProvider || null, targetProvider: entry.targetProvider || null, targetDatabaseName: entry.targetDatabaseName || null, outcome: entry.outcome, errorCode: entry.errorCode || null }
  fs.appendFileSync(DATABASE_AUDIT_FILE, `${JSON.stringify(safeEntry)}\n`, { encoding: 'utf8', mode: 0o600 })
}
