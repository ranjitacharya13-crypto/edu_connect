import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  account: { type: mongoose.Schema.Types.ObjectId, refPath: 'accountModel', required: true },
  accountModel: { type: String, enum: ['User', 'Admin'], required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, collection: 'sessions' })

export default mongoose.model('Session', sessionSchema)
