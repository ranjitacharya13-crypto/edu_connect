import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import activitiesRouter from './routes/activities.js'
import callsRouter from './routes/calls.js'
import contactsRouter from './routes/contacts.js'
import uploadsRouter from './routes/uploads.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import communicationsRouter from './routes/communications.js'
import customFieldsRouter from './routes/customFields.js'
import { connectDatabase, databaseStatus, isDatabaseUnavailable } from './db.js'
import { migrateAccounts } from './migrate.js'

const app = express()
const port = process.env.PORT || 5000

const clientOrigins = process.env.CLIENT_ORIGIN
  ? [process.env.CLIENT_ORIGIN, 'https://localhost']
  : true

app.use(cors({ origin: clientOrigins }))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/api/health', (_req, res) => {
  const database = databaseStatus()
  res.status(database.connected ? 200 : 503).json({
    ok: database.connected,
    service: 'EduStaff Connect API',
    database,
  })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/activities', activitiesRouter)
app.use('/api/calls', callsRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/communications', communicationsRouter)
app.use('/api/custom-fields', customFieldsRouter)

// Serve the production web client from the same origin as the API when the
// backend is exposed through ngrok. API routes above remain unchanged.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDist = path.join(projectRoot, 'dist')
app.use(express.static(webDist))
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  return res.sendFile(path.join(webDist, 'index.html'))
})

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'CSV file exceeds the configured size limit' })
  if (error?.message === 'Only CSV files are allowed' || error?.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ message: 'Only CSV files are allowed' })
  console.error('Unhandled request error:', { name: error?.name, code: error?.code })
  if (isDatabaseUnavailable(error)) return res.status(503).json({ message: 'Service is temporarily unavailable' })
  return res.status(500).json({ message: 'Request could not be completed' })
})

async function start() {
  try {
    await connectDatabase()
    await migrateAccounts()
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Backend startup failed. Check that the selected MongoDB provider is running and configured before restarting the backend.')
    console.error('Startup error:', { name: error?.name, code: error?.code })
    process.exitCode = 1
  }
}

start()
