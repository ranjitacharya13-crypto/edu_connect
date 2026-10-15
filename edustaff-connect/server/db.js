import mongoose from 'mongoose'

const {
  MONGODB_URI: configuredMongoUri,
  MONGODB_USERNAME,
  MONGODB_PASSWORD,
  MONGODB_CLUSTER,
  MONGODB_DB_NAME,
} = process.env

export const MONGODB_URI = configuredMongoUri || (
  MONGODB_USERNAME && MONGODB_PASSWORD && MONGODB_CLUSTER
    ? `mongodb+srv://${encodeURIComponent(MONGODB_USERNAME)}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_CLUSTER}/${MONGODB_DB_NAME || 'edustaff-connect'}?retryWrites=true&w=majority`
    : 'mongodb://127.0.0.1:27017/edustaff-connect'
)

const options = {
  dbName: 'edustaff-connect',
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 5000,
  maxPoolSize: 10,
  retryWrites: true,
}

let reconnectTimer
let connecting
let hasConnected = false

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (connecting) return connecting
  connecting = mongoose.connect(MONGODB_URI, options)
    .then(() => {
      hasConnected = true
      console.log(`MongoDB connected: ${mongoose.connection.name}`)
      return mongoose.connection
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message)
      throw error
    })
    .finally(() => { connecting = null })
  return connecting
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await connectDatabase()
    } catch {
      // connectDatabase schedules the next attempt.
    }
  }, 3000)
}

mongoose.connection.on('disconnected', () => {
  // The startup loop owns retries until the first successful connection.
  // This prevents one failed startup attempt from creating two retry loops.
  if (!hasConnected) return
  console.error('MongoDB disconnected; reconnect scheduled')
  scheduleReconnect()
})
mongoose.connection.on('error', (error) => {
  console.error('MongoDB runtime error:', error.message)
})

export function databaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    database: mongoose.connection.name || 'edustaff-connect',
  }
}

export async function verifyPersisted(Model, id, label = 'document') {
  if (!id || !(await Model.exists({ _id: id }))) {
    throw new Error(`${label} write could not be verified`)
  }
  return true
}

export function assertWriteAcknowledged(result, label = 'database') {
  if (!result?.acknowledged) throw new Error(`${label} write was not acknowledged`)
  return result
}
