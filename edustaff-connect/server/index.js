import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import activitiesRouter from './routes/activities.js'
import callsRouter from './routes/calls.js'
import contactsRouter from './routes/contacts.js'
import uploadsRouter from './routes/uploads.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import { connectDatabase, databaseStatus } from './db.js'
import { migrateAccounts } from './migrate.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }))
app.use(express.json())

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

async function start() {
  try {
    await connectDatabase()
    await migrateAccounts()
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('API startup is waiting for MongoDB:', error.message)
    setTimeout(start, 3000)
  }
}

start()
