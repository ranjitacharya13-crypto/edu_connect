import mongoose from 'mongoose'

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edustaff-connect'

const options = {
  dbName: 'edustaff-connect',
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 5000,
  maxPoolSize: 10,
  retryWrites: true,
}

let reconnectTimer
let connecting

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (connecting) return connecting
  connecting = mongoose.connect(MONGODB_URI, options)
    .then(() => {
      console.log(`MongoDB connected: ${mongoose.connection.name}`)
      return mongoose.connection
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message)
      scheduleReconnect()
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
