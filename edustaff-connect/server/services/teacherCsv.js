import { TEACHER_CSV_HEADERS, validateTeacherInput } from './teacherAccounts.js'

export const MAX_TEACHER_ROWS = Number(process.env.TEACHER_IMPORT_MAX_ROWS || 1000)

function parseRows(text) {
  const rows = []; let row = []; let value = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]; const next = text[i + 1]
    if (c === '"') { if (quoted && next === '"') { value += '"'; i += 1 } else quoted = !quoted }
    else if (c === ',' && !quoted) { row.push(value.trim()); value = '' }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && next === '\n') i += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = '' }
    else value += c
  }
  if (quoted) throw new Error('Malformed CSV: an opening quote is not closed')
  if (value !== '' || row.length) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row) }
  return rows
}

export function parseTeacherCsv(buffer) {
  const rows = parseRows(buffer.toString('utf8'))
  if (rows.length < 2) throw new Error('CSV file must have a header and at least one data row')
  if (rows.length - 1 > MAX_TEACHER_ROWS) throw new Error(`CSV exceeds the ${MAX_TEACHER_ROWS}-row limit`)
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim())
  const normalized = headers.map((h) => h.toLowerCase())
  const duplicates = normalized.filter((h, i) => normalized.indexOf(h) !== i)
  if (duplicates.length) throw new Error(`Duplicate CSV headers: ${[...new Set(duplicates)].join(', ')}`)
  const missing = TEACHER_CSV_HEADERS.filter((h) => !normalized.includes(h.toLowerCase()))
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`)
  const unknown = headers.filter((h) => !TEACHER_CSV_HEADERS.some((expected) => expected.toLowerCase() === h.toLowerCase()))
  if (unknown.length) throw new Error(`Unknown CSV columns: ${unknown.join(', ')}`)
  const indexes = Object.fromEntries(TEACHER_CSV_HEADERS.map((h) => [h, normalized.indexOf(h.toLowerCase())]))
  const records = []; const errors = []; const seen = new Set()
  rows.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2
    if (cells.length > headers.length) { errors.push({ row: rowNumber, message: 'Has more values than the header row' }); return }
    const input = {
      name: cells[indexes['Full Name']] || '', email: cells[indexes.Email] || '', phone: cells[indexes.Phone] || '',
      dateOfBirth: cells[indexes['Date of Birth']] || '', password: cells[indexes.Password] || '',
    }
    const result = validateTeacherInput(input)
    const key = input.email.trim().toLowerCase()
    if (key && seen.has(key)) result.errors.email = 'Duplicate email in this file'
    if (key) seen.add(key)
    if (Object.keys(result.errors).length) errors.push({ row: rowNumber, message: Object.values(result.errors).join('; ') })
    else records.push({ row: rowNumber, input })
  })
  return { records, errors, totalRows: rows.length - 1 }
}

