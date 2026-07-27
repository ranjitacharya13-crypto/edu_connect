import crypto from 'node:crypto'
import Session from './models/Session.js'
import User from './models/User.js'
import Admin from './models/Admin.js'
import { verifyPersisted } from './db.js'
import { publicUser } from './rbac.js'

const SESSION_DAYS = 7

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${digest}`
}

export function verifyPassword(password, stored) {
  if (!stored?.includes(':')) return stored === password
  const [salt, digest] = stored.split(':')
  const candidate = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(candidate, Buffer.from(digest, 'hex'))
}

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex')

export async function createSession(account) {
  const token = crypto.randomBytes(32).toString('base64url')
  const session = await Session.create({
    tokenHash: tokenHash(token),
    account: account._id,
    accountModel: account.role === 'admin' ? 'Admin' : 'User',
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
  })
  await verifyPersisted(Session, session._id, 'session')
  return token
}

export async function authenticate(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Authentication required' })

  const session = await Session.findOne({
    tokenHash: tokenHash(token),
    expiresAt: { $gt: new Date() },
  }).populate('account')
  if (!session?.account) return res.status(401).json({ message: 'Session is invalid or expired' })

  req.user = session.account
  req.session = session
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access required' })
  }
  next()
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user?.permissions?.[permission]) {
      return res.status(403).json({ message: `Permission denied: ${permission}` })
    }
    next()
  }
}

export { Admin, publicUser, User }
