import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema({
  value: { type: String, required: true, trim: true, maxlength: 100 },
  label: { type: String, required: true, trim: true, maxlength: 120 },
}, { _id: false })

const customFieldSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9_]{0,63}$/ },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, required: true, enum: ['text', 'long_text', 'number', 'email', 'phone', 'date', 'select', 'multi_select', 'boolean', 'url'] },
  required: { type: Boolean, default: false },
  defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
  placeholder: { type: String, default: '', maxlength: 200 },
  helpText: { type: String, default: '', maxlength: 500 },
  options: { type: [optionSchema], default: [] },
  formVisible: { type: Boolean, default: true },
  tableVisible: { type: Boolean, default: true },
  importable: { type: Boolean, default: true },
  searchable: { type: Boolean, default: false },
  filterable: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  state: { type: String, enum: ['active', 'hidden', 'archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
}, { timestamps: true, collection: 'custom_student_fields' })

customFieldSchema.index({ state: 1, order: 1 })

export default mongoose.model('CustomField', customFieldSchema)
