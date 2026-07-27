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

// Required columns for CSV upload
const REQUIRED_COLUMNS = [
  'studentName',
  'grade',
  'guardianName',
  'guardianPhone',
]

/**
 * Parse CSV data
 */
function parseCSV(csvString) {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row')
  }

  const headers = lines[0].split(',').map(h => h.trim())
  const data = []
  const errors = []

  // Check required columns
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row = {}
    let rowValid = true

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    // Validate required fields
    REQUIRED_COLUMNS.forEach(col => {
      if (!row[col]) {
        rowValid = false
        errors.push(`Row ${i + 1}: Missing ${col}`)
      }
    })

    if (rowValid) {
      data.push(row)
    }
  }

  return { data, errors, totalRows: lines.length - 1 }
}

/**
 * POST /api/uploads/manual - Manual student entry
 */
router.post('/manual', requirePermission('canUploadStudents'), async (req, res) => {
  try {
    const {
      studentName,
      grade,
      guardianName,
      guardianPhone,
      guardianEmail,
      status,
      notes,
    } = req.body

    // Validate required fields
    const errors = []
    if (!studentName) errors.push('Student name is required')
    if (!grade) errors.push('Grade is required')
    if (!guardianName) errors.push('Guardian name is required')
    if (!guardianPhone) errors.push('Guardian phone is required')

    if (errors.length > 0) {
      return res.status(400).json({ errors })
    }

    // Create contact
    const adminFields = req.user.role === 'admin'
      ? { email: guardianEmail || '', status: status || 'Primary Guardian', notes: notes || '' }
      : {}
    const contact = await Contact.create({
      name: guardianName,
      phone: guardianPhone,
      student: {
        name: studentName,
        grade,
      },
      relationship: 'Guardian',
      createdBy: req.user._id,
      ...adminFields,
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
          name: row.guardianName,
          phone: row.guardianPhone,
          email: row.guardianEmail || '',
          student: {
            name: row.studentName,
            grade: row.grade,
          },
          status: row.status || 'Primary Guardian',
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
