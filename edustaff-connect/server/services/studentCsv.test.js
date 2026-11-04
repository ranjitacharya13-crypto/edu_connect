import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCSV } from '../routes/uploads.js'

const header = 'Student Name,Admission Type,Department,Parent/Guardian Phone,Notes'

test('student CSV accepts canonical and safely normalized dropdown values', () => {
  const result = parseCSV(`${header}\n"A Student", " regular ", " cse ","9876543210","note"\n"B Student","Part Time","EEE","9988776655",""`)
  assert.equal(result.errors.length, 0)
  assert.deepEqual(result.data.map(({ admissionType, department }) => ({ admissionType, department })), [
    { admissionType: 'Regular', department: 'CSE' },
    { admissionType: 'Part Time', department: 'EEE' },
  ])
})

test('student CSV rejects unsupported values and invalid Part Time departments by row', () => {
  const result = parseCSV(`${header}\n"Bad Admission","Evening","CSE","9876543210",""\n"Bad Department","Regular","Unknown","9876543210",""\n"Bad Part Time","Part Time","CSE","9876543210",""`)
  assert.equal(result.data.length, 0)
  assert.equal(result.errors.length, 3)
  assert.match(result.errors[0], /Row 2:.*Admission Type is invalid/)
  assert.match(result.errors[1], /Row 3:.*Department is invalid/)
  assert.match(result.errors[2], /Row 4:.*Department is invalid for Part Time/)
})

test('student CSV handles BOM, Windows line endings, quoted commas and header whitespace', () => {
  const result = parseCSV(`\uFEFF Student Name , Admission Type , Department , Parent/Guardian Phone , Notes \r\n"A, Student","Regular","CSE","9876543210","note"\r\n`)
  assert.equal(result.totalRows, 1)
  assert.equal(result.data[0].studentName, 'A, Student')
  assert.equal(result.errors.length, 0)
})

test('student CSV reports missing required fields and rejects empty/header-only files', () => {
  const result = parseCSV(`${header}\n"","Regular","CSE","",""`)
  assert.equal(result.totalRows, 1)
  assert.equal(result.data.length, 0)
  assert.match(result.errors[0], /Student Name is required/)
  assert.match(result.errors[0], /Parent\/Guardian Phone is required/)
  assert.throws(() => parseCSV(''), /header and at least one data row/)
  assert.throws(() => parseCSV(header), /header and at least one data row/)
})

test('student CSV imports custom fields by label or ID and parses multi-select labels', () => {
  const fields = [
    { key: 'favorite_subjects', label: 'Favorite subjects', type: 'multi_select', required: true, state: 'active', options: [
      { value: 'math', label: 'Mathematics' },
      { value: 'science', label: 'Science' },
    ] },
    { key: 'uniform_size', label: 'Uniform size', type: 'text', required: false, state: 'active' },
  ]
  const result = parseCSV(`${header},Favorite subjects,uniform_size\n"A Student","Regular","CSE","9876543210","note","Mathematics; Science","M"`, fields)
  assert.equal(result.errors.length, 0)
  assert.deepEqual(result.data[0].customFields, {
    favorite_subjects: ['math', 'science'],
    uniform_size: 'M',
  })
})

test('student CSV reports custom field validation errors with the source row number', () => {
  const fields = [{ key: 'uniform_size', label: 'Uniform size', type: 'number', required: false, state: 'active' }]
  const result = parseCSV(`${header},uniform_size\n"A Student","Regular","CSE","9876543210","note","large"`, fields)
  assert.equal(result.data.length, 0)
  assert.match(result.errors[0], /Row 2: Uniform size must be a number/)
})
