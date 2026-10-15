import express from 'express'
import multer from 'multer'
import Contact from '../models/Contact.js'
import { authenticate, requirePermission } from '../auth.js'
import { sanitizeContact } from '../rbac.js'
import { verifyPersisted } from '../db.js'

const router = express.Router()
router.use(authenticate)

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files are allowed'))
    }
  },
})

const REQUIRED_COLUMNS = ['Student Name', 'Admission Type', 'Department', 'Parent/Guardian Phone']
const VALID_ADMISSION_TYPES = ['Regular', 'Lateral Entry', 'Part Time']
const VALID_DEPARTMENTS = ['CSE', 'Civil', 'AI/ML', 'Mech', 'ECE', 'EEE', 'Automobile']
const PART_TIME_DEPARTMENTS = ['EEE', 'Mech']
const HEADER_ALIASES = new Map([
  ['student name', 'studentName'],
  ['studentname', 'studentName'],
  ['admission type', 'admissionType'],
  ['admissiontype', 'admissionType'],
  ['department', 'department'],
  ['parent/guardian phone', 'guardianPhone'],
  ['guardian phone', 'guardianPhone'],
  ['guardianphone', 'guardianPhone'],
  ['notes', 'notes'],
])

function normalizeHeader(header) {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function departmentsForAdmissionType(admissionType) {
  return admissionType === 'Part Time' ? PART_TIME_DEPARTMENTS : VALID_DEPARTMENTS
}

function parseCsvRows(csvString) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let i = 0; i < csvString.length; i += 1) {
    const character = csvString[i]
    const next = csvString[i + 1]

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(value.trim())
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') i += 1
      row.push(value.trim())
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (quoted) throw new Error('Malformed CSV: an opening quote is not closed')
  if (value !== '' || row.length) {
    row.push(value.trim())
    if (row.some((cell) => cell !== '')) rows.push(row)
  }
  return rows
}

function parseCSV(csvString) {
  const rows = parseCsvRows(csvString)
  if (rows.length < 2) throw new Error('CSV file must have a header and at least one data row')

  const sourceHeaders = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim())
  const normalizedHeaders = sourceHeaders.map(normalizeHeader)
  const duplicateHeaders = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index)
  if (duplicateHeaders.length) {
    throw new Error(`Duplicate CSV headers: ${[...new Set(duplicateHeaders)].join(', ')}`)
  }

  const mappedHeaders = normalizedHeaders.map((header) => HEADER_ALIASES.get(header))
  const duplicateMappedHeaders = mappedHeaders.filter((header, index) => header && mappedHeaders.indexOf(header) !== index)
  if (duplicateMappedHeaders.length) {
    throw new Error(`Duplicate CSV headers: ${[...new Set(duplicateMappedHeaders)].join(', ')}`)
  }
  const missingColumns = REQUIRED_COLUMNS.filter((column) => {
    const alias = HEADER_ALIASES.get(normalizeHeader(column))
    return !mappedHeaders.includes(alias)
  })
  if (missingColumns.length) throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)

  const data = []
  const errors = []
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index]
    if (values.length > sourceHeaders.length) {
      errors.push(`Row ${index + 1}: has more values than the header row`)
      continue
    }

    const raw = {}
    mappedHeaders.forEach((header, valueIndex) => {
      if (header) raw[header] = values[valueIndex] || ''
    })
    const rowErrors = []
    if (!raw.studentName) rowErrors.push('Student Name is required')
    if (!VALID_ADMISSION_TYPES.includes(raw.admissionType)) rowErrors.push(`Admission Type is invalid: ${raw.admissionType || '(empty)'}`)
    if (!departmentsForAdmissionType(raw.admissionType).includes(raw.department)) {
      rowErrors.push(`Department is invalid for ${raw.admissionType || 'the selected Admission Type'}: ${raw.department || '(empty)'}`)
    }
    if (!raw.guardianPhone) rowErrors.push('Parent/Guardian Phone is required')

    if (rowErrors.length) {
      errors.push(`Row ${index + 1}: ${rowErrors.join('; ')}`)
      continue
    }
    data.push({
      studentName: raw.studentName,
      admissionType: raw.admissionType,
      department: raw.department,
      guardianPhone: raw.guardianPhone,
      notes: raw.notes || '',
    })
  }

  return { data, errors, totalRows: rows.length - 1 }
}

export { parseCSV }

/**
 * POST /api/uploads/manual - Manual student entry
 */
router.post('/manual', requirePermission('canUploadStudents'), async (req, res) => {
  try {
    const {
      studentName,
      admissionType,
      department,
      guardianPhone,
      notes,
    } = req.body

    // Validate required fields
    const errors = []
    if (!studentName) errors.push('Student name is required')
    if (!VALID_ADMISSION_TYPES.includes(admissionType)) errors.push('A valid admission type is required')
    if (!departmentsForAdmissionType(admissionType).includes(department)) {
      errors.push('Department is invalid for the selected admission type')
    }
    if (!guardianPhone) errors.push('Guardian phone is required')

    if (errors.length > 0) {
      return res.status(400).json({ errors })
    }

    // Create contact
    const contact = await Contact.create({
      name: studentName,
      phone: guardianPhone,
      student: {
        name: studentName,
        admissionType,
        department,
      },
      relationship: 'Guardian',
      createdBy: req.user._id,
      notes: notes || '',
    })
    await verifyPersisted(Contact, contact._id, 'manual student contact')

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      contact: sanitizeContact(contact, req.user.role),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add student',
      error: error.message,
    })
  }
})

/**
 * POST /api/uploads/csv/preview - Preview CSV data
 */
router.post('/csv/preview', requirePermission('canBulkUpload'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const csvString = req.file.buffer.toString('utf8')
    const { data, errors, totalRows } = parseCSV(csvString)

    res.json({
      success: true,
      preview: data,
      errors,
      totalRows,
      validRows: data.length,
      fileName: req.file.originalname,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

/**
 * POST /api/uploads/csv/import - Import CSV data
 */
router.post('/csv/import', requirePermission('canBulkUpload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const csvString = req.file.buffer.toString('utf8')
    const { data, errors, totalRows } = parseCSV(csvString)

    const importedContacts = []
    const failedImports = [...errors]

    // Import valid rows
    for (const row of data) {
      try {
        const contact = await Contact.create({
          name: row.studentName,
          phone: row.guardianPhone,
          student: {
            name: row.studentName,
            admissionType: row.admissionType,
            department: row.department,
          },
          notes: row.notes || '',
          relationship: 'Guardian',
          createdBy: req.user._id,
        })
        await verifyPersisted(Contact, contact._id, `CSV contact ${row.studentName}`)
        importedContacts.push(contact)
      } catch (error) {
        failedImports.push(`Failed to import ${row.studentName}: ${error.message}`)
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      importedCount: importedContacts.length,
      failedCount: failedImports.length,
      totalRows,
      importedContacts,
      failedImports,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Import failed',
      error: error.message,
    })
  }
})

export default router
