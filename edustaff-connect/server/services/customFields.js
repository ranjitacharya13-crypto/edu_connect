const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
const RESERVED_KEYS = new Set([
  '_id', 'id', 'name', 'student', 'phone', 'email', 'status', 'notes',
  'assignedto', 'createdby', 'customfields', 'relationship', 'smsconsent',
  'priority', 'tone', 'grade', 'admissiontype', 'department', 'constructor',
  'prototype', 'tostring', 'valueof',
])
export const CUSTOM_FIELD_TYPES = ['text', 'long_text', 'number', 'email', 'phone', 'date', 'select', 'multi_select', 'boolean', 'url']

const text = (value, max) => typeof value === 'string' && value.trim().length <= max
const optionFor = (field, value) => (field.options || []).find((option) => (
  option.value === value || option.label.toLowerCase() === String(value).trim().toLowerCase()
))

export function validateDefinition(input, existing = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Field definition must be an object')
  const key = String(input.key ?? existing?.key ?? '').trim().toLowerCase()
  const label = String(input.label ?? existing?.label ?? '').trim()
  const type = input.type ?? existing?.type
  if (!KEY_PATTERN.test(key) || RESERVED_KEYS.has(key.toLowerCase())) throw new Error('Field ID must start with a letter, use lowercase letters, numbers or underscores, and not be reserved')
  if (!text(label, 120) || !label) throw new Error('A field label is required')
  if (!CUSTOM_FIELD_TYPES.includes(type)) throw new Error('Unsupported custom field type')
  let options = input.options ?? existing?.options ?? []
  if (!Array.isArray(options)) throw new Error('Field options must be a list')
  if (['select', 'multi_select'].includes(type)) {
    if (!Array.isArray(options) || options.length < 1 || options.length > 100) throw new Error('Select fields require between 1 and 100 options')
    const normalizedOptions = options.map((option) => ({
      value: String(option?.value ?? '').trim(),
      label: String(option?.label ?? '').trim(),
    }))
    const values = normalizedOptions.map((option) => option.value.toLowerCase())
    const labels = normalizedOptions.map((option) => option.label.toLowerCase())
    if (normalizedOptions.some((option) => !option.value || option.value.length > 100 || !option.label || option.label.length > 120)
      || new Set(values).size !== values.length || new Set(labels).size !== labels.length) throw new Error('Select options must have unique, non-empty values and labels')
    options = normalizedOptions
  } else if (options.length) throw new Error('Only select fields may define options')

  const definition = {
    key,
    label,
    type,
    required: input.required ?? existing?.required ?? false,
    options,
    formVisible: input.formVisible ?? existing?.formVisible ?? true,
    tableVisible: input.tableVisible ?? existing?.tableVisible ?? true,
    importable: input.importable ?? existing?.importable ?? true,
    searchable: input.searchable ?? existing?.searchable ?? false,
    filterable: input.filterable ?? existing?.filterable ?? true,
    state: input.state ?? existing?.state ?? 'active',
    order: input.order ?? existing?.order ?? 0,
    defaultValue: input.defaultValue ?? existing?.defaultValue ?? null,
    placeholder: input.placeholder ?? existing?.placeholder ?? '',
    helpText: input.helpText ?? existing?.helpText ?? '',
  }
  for (const property of ['required', 'formVisible', 'tableVisible', 'importable', 'searchable', 'filterable']) {
    if (typeof definition[property] !== 'boolean') throw new Error(`${property} must be true or false`)
  }
  if (!['active', 'hidden', 'archived'].includes(definition.state)) throw new Error('Invalid field state')
  if (!Number.isFinite(definition.order) || definition.order < 0) throw new Error('Field order must be a non-negative number')
  if (!text(definition.placeholder, 200) || !text(definition.helpText, 500)) throw new Error('Placeholder or help text is too long')
  if (definition.defaultValue !== null) validateValue(definition, definition.defaultValue, false)
  return definition
}

export function validateValue(field, value, required = field.required) {
  const empty = value === null || value === undefined || value === ''
    || (field.type === 'multi_select' && Array.isArray(value) && value.length === 0)
  if (empty) {
    if (required) throw new Error(`${field.label} is required`)
    return null
  }
  if (field.type === 'text' && (typeof value !== 'string' || value.length > 500)) throw new Error(`${field.label} must be 500 characters or fewer`)
  if (field.type === 'long_text' && (typeof value !== 'string' || value.length > 5000)) throw new Error(`${field.label} must be 5000 characters or fewer`)
  if (field.type === 'number' && ((typeof value !== 'number' && typeof value !== 'string') || !Number.isFinite(Number(value)) || String(value).trim() === '')) throw new Error(`${field.label} must be a number`)
  if (field.type === 'email' && (typeof value !== 'string' || value.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error(`${field.label} must be a valid email`)
  if (field.type === 'phone' && (typeof value !== 'string' || !/^\+?[0-9 ()-]{7,20}$/.test(value))) throw new Error(`${field.label} must be a valid phone number`)
  if (field.type === 'date') {
    const validDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    if (!validDate) throw new Error(`${field.label} must be a valid date in YYYY-MM-DD format`)
  }
  if (field.type === 'url') {
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch { throw new Error(`${field.label} must be a valid HTTP or HTTPS URL`) }
  }
  if (field.type === 'boolean' && (typeof value !== 'boolean' || (required && !value))) throw new Error(`${field.label} must be checked`)
  if (field.type === 'select') {
    const option = typeof value === 'string' && optionFor(field, value)
    if (!option) throw new Error(`${field.label} has an invalid option`)
    return option.value
  }
  if (field.type === 'multi_select') {
    if (!Array.isArray(value)) throw new Error(`${field.label} must be a list of options`)
    const normalized = value.map((item) => optionFor(field, item)?.value)
    if (normalized.some((item) => !item) || new Set(normalized).size !== normalized.length) throw new Error(`${field.label} has an invalid or duplicate option`)
    return normalized
  }
  return field.type === 'number' ? Number(value) : value
}

export function validateValues(fields, values = {}, { partial = true } = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Custom fields must be an object')
  const output = {}
  const activeFields = fields.filter((item) => item.state === undefined || item.state === 'active')
  for (const field of activeFields) {
    if (!partial && field.required && values[field.key] === undefined && field.defaultValue == null) throw new Error(`${field.label} is required`)
    if (values[field.key] !== undefined) output[field.key] = validateValue(field, values[field.key])
    else if (!partial && field.defaultValue != null) output[field.key] = validateValue(field, field.defaultValue, false)
  }
  const allowed = new Set(activeFields.map((field) => field.key))
  const unknown = Object.keys(values).find((key) => !allowed.has(key))
  if (unknown) throw new Error(`Unknown custom field: ${unknown}`)
  return output
}
