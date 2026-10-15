import crypto from 'node:crypto'

const provider = () => (process.env.SMS_PROVIDER || '').trim().toLowerCase()

export function smsConfig() {
  const name = provider()
  if (!name) return { enabled: false, provider: '' }
  if (name !== 'twilio') return { enabled: false, provider: name, error: 'Unsupported SMS provider' }
  const enabled = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.SMS_SENDER_ID)
  return { enabled, provider: name, error: enabled ? '' : 'SMS provider credentials are not configured' }
}

export async function sendSms({ to, body }) {
  const config = smsConfig()
  if (!config.enabled) {
    const error = new Error(config.error || 'SMS is not configured')
    error.code = 'SMS_NOT_CONFIGURED'
    throw error
  }
  const params = new URLSearchParams({ To: to, From: process.env.SMS_SENDER_ID, Body: body })
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) { const error = new Error(data.message || 'SMS provider rejected the request'); error.code = data.code || 'SMS_PROVIDER_ERROR'; throw error }
  return { provider: 'twilio', providerMessageId: data.sid, status: ['queued', 'accepted', 'sent'].includes(data.status) ? data.status : 'accepted' }
}

export function normalizeTwilioStatus(status) {
  return ({ queued: 'queued', accepted: 'accepted', sending: 'sent', sent: 'sent', delivered: 'delivered', undelivered: 'undelivered', failed: 'failed' })[status] || 'unknown'
}

export function verifyTwilioSignature(req) {
  const signature = req.get('x-twilio-signature')
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!signature || !token) return false
  const values = Object.keys(req.body || {}).sort().map((key) => `${key}${req.body[key]}`).join('')
  const expected = crypto.createHmac('sha1', token).update(`${process.env.PUBLIC_WEBHOOK_URL || ''}${values}`).digest('base64')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}
