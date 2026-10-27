import mongoose from 'mongoose'
import { appendDatabaseAudit, DATABASE_PROVIDERS, publicDatabaseConfig, resolveDatabaseConfig, savePersistedSelection } from './databaseConfig.js'

const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting']
const HEALTH_MAX_AGE_MS = Math.max(10000, Number(process.env.DB_HEALTH_MAX_AGE_MS || 60000))
let reconnectTimer
let connecting
let switchPromise
let hasConnected = false
let activeConfig
let lastSuccessfulHealthCheck = null
let lastOperation = { status: 'idle', completedAt: null, message: '' }
const providerHealth = new Map()

function active() {
  if (!activeConfig) activeConfig = resolveDatabaseConfig()
  return activeConfig
}

const connectionOptions = (config) => ({ dbName: config.databaseName, serverSelectionTimeoutMS: 5000, heartbeatFrequencyMS: 5000, maxPoolSize: 10, retryWrites: true })

export function currentDatabaseConfig() { return active() }

export async function connectDatabase() {
  const config = active()
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === config.databaseName) return mongoose.connection
  if (connecting) return connecting
  connecting = mongoose.connect(config.uri, connectionOptions(config))
    .then(() => {
      hasConnected = true
      lastSuccessfulHealthCheck = new Date().toISOString()
      providerHealth.set(`${config.provider}:${config.databaseName}`, { connected: true, checkedAt: lastSuccessfulHealthCheck, lastSuccessfulAt: lastSuccessfulHealthCheck, latencyMs: null, message: '' })
      console.log(`MongoDB connected: ${mongoose.connection.name}`)
      return mongoose.connection
    })
    .finally(() => { connecting = null })
  return connecting
}

export async function testDatabaseConnection(selection) {
  const config = resolveDatabaseConfig(selection)
  const startedAt = Date.now()
  const healthKey = `${config.provider}:${config.databaseName}`
  let probe
  try {
    probe = await mongoose.createConnection(config.uri, connectionOptions(config)).asPromise()
    await probe.db.admin().command({ ping: 1 })
    const latencyMs = Date.now() - startedAt
    const checkedAt = new Date().toISOString()
    providerHealth.set(healthKey, { connected: true, checkedAt, lastSuccessfulAt: checkedAt, latencyMs, message: '' })
    return { config, latencyMs }
  } catch (error) {
    const previous = providerHealth.get(healthKey)
    providerHealth.set(healthKey, { connected: false, checkedAt: new Date().toISOString(), lastSuccessfulAt: previous?.lastSuccessfulAt || null, latencyMs: Date.now() - startedAt, message: safeDatabaseError(error) })
    throw error
  } finally {
    if (probe) await probe.close()
  }
}

function safeDatabaseError(error) {
  return String(error?.message || 'Database connection failed').replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[redacted MongoDB URI]')
}

export function databaseStatus() {
  let config
  try { config = active() } catch (error) {
    return { connected: false, state: 'error', configured: false, message: error.message, code: error.code || 'DATABASE_CONFIG_ERROR' }
  }
  const connected = mongoose.connection.readyState === 1 && mongoose.connection.name === config.databaseName
  const providers = {}
  for (const provider of Object.values(DATABASE_PROVIDERS)) {
    try {
      const providerConfig = resolveDatabaseConfig({ provider, databaseName: config.databaseName })
      const probe = providerHealth.get(`${provider}:${providerConfig.databaseName}`)
      const checkedAtMs = probe?.checkedAt ? Date.parse(probe.checkedAt) : NaN
      const stale = !Number.isFinite(checkedAtMs) || Date.now() - checkedAtMs > HEALTH_MAX_AGE_MS
      const status = !probe ? 'unknown' : stale ? 'stale' : probe.connected ? 'connected' : 'error'
      providers[provider] = { ...publicDatabaseConfig(providerConfig), connected: !stale && Boolean(probe?.connected), status, stale, lastCheckedAt: probe?.checkedAt || null, lastSuccessfulAt: probe?.lastSuccessfulAt || null, latencyMs: probe?.latencyMs ?? null, message: probe?.message || '' }
    } catch (error) {
      providers[provider] = { provider, configured: false, connected: false, message: error.message, code: error.code || 'DATABASE_CONFIG_ERROR' }
    }
  }
  return { ...publicDatabaseConfig(config), connected, state: stateNames[mongoose.connection.readyState] || 'unknown', lastSuccessfulHealthCheck, lastOperation, providers }
}

export async function refreshProviderHealth() {
  const results = await Promise.allSettled(Object.values(DATABASE_PROVIDERS).map(async (provider) => {
    const config = resolveDatabaseConfig({ provider, databaseName: active().databaseName })
    return testDatabaseConnection(config)
  }))
  return { status: databaseStatus(), results }
}

export async function switchDatabase(selection, actor = 'admin') {
  if (switchPromise) {
    const error = new Error('Another database operation is already in progress.')
    error.code = 'DATABASE_OPERATION_IN_PROGRESS'
    throw error
  }
  switchPromise = performSwitch(selection, actor).finally(() => { switchPromise = null })
  return switchPromise
}

async function performSwitch(selection, actor) {
  const previous = active()
  const target = resolveDatabaseConfig(selection)
  if (previous.provider === target.provider && previous.databaseName === target.databaseName && databaseStatus().connected) {
    lastOperation = { status: 'completed', completedAt: new Date().toISOString(), message: 'Already using the requested database.' }
    return databaseStatus()
  }
  lastOperation = { status: 'validating', completedAt: null, message: 'Validating target configuration.' }
  try {
    lastOperation = { status: 'connecting_target', completedAt: null, message: 'Testing the target database connection.' }
    await testDatabaseConnection(target)
    lastOperation = { status: 'applying_switch', completedAt: null, message: 'Applying the database transition.' }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
    activeConfig = target
    try { await connectDatabase() } catch (error) {
      activeConfig = previous
      try { await connectDatabase() } catch { /* degraded status is reported by the API */ }
      throw error
    }
    savePersistedSelection(target)
    lastOperation = { status: 'completed', completedAt: new Date().toISOString(), message: 'Database switch verified successfully.' }
    appendDatabaseAudit({ actor, operation: 'switch', sourceProvider: previous.provider, targetProvider: target.provider, targetDatabaseName: target.databaseName, outcome: 'success' })
    return databaseStatus()
  } catch (error) {
    lastOperation = { status: 'failed', completedAt: new Date().toISOString(), message: error.message }
    appendDatabaseAudit({ actor, operation: 'switch', sourceProvider: previous.provider, targetProvider: target.provider, targetDatabaseName: target.databaseName, outcome: 'failed', errorCode: error.code })
    throw error
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(async () => { reconnectTimer = null; try { await connectDatabase() } catch { /* the next retry or restart can recover */ } }, 3000)
}

mongoose.connection.on('disconnected', () => { if (hasConnected) { console.error('MongoDB disconnected; reconnect scheduled'); scheduleReconnect() } })
mongoose.connection.on('error', (error) => console.error('MongoDB runtime error:', error.message))

export async function verifyPersisted(Model, id, label = 'document') {
  if (!id || !(await Model.exists({ _id: id }))) throw new Error(`${label} write could not be verified`)
  return true
}

export function assertWriteAcknowledged(result, label = 'database') {
  if (!result?.acknowledged) throw new Error(`${label} write was not acknowledged`)
  return result
}
