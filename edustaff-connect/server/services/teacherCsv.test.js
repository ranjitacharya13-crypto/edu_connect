import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTeacherCsv } from './teacherCsv.js'

const header = 'Full Name,Email,Phone,Date of Birth,Password'
const valid = `${header}\n"A Teacher","a@example.com","9876543210",1990-01-01,"secret1"`

test('teacher CSV accepts BOM, quoted commas and escaped quotes without exposing passwords', () => {
  const result = parseTeacherCsv(Buffer.from(`\uFEFF${header}\n"A, Teacher","a@example.com",9876543210,1990-01-01,"sec""ret1"`))
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0].input.name, 'A, Teacher')
  assert.equal(result.records[0].input.password, 'sec"ret1')
})

test('teacher CSV reports missing, duplicate and unknown headers', () => {
  assert.throws(() => parseTeacherCsv(Buffer.from('Full Name,Email,Email,Phone,Date of Birth,Password\nA,a@b.com,a@b.com,1,1990-01-01,secret1')), /Duplicate CSV headers/)
  assert.throws(() => parseTeacherCsv(Buffer.from(`${header},Role\nA,a@b.com,1,1990-01-01,secret1,teacher`)), /Unknown CSV columns/)
  assert.throws(() => parseTeacherCsv(Buffer.from('Full Name,Email\nA,a@b.com')), /Missing required columns/)
})

test('teacher CSV validates rows and detects duplicate emails', () => {
  const result = parseTeacherCsv(Buffer.from(`${valid}\nB,a@example.com,9876543211,1990-01-01,secret1`))
  assert.equal(result.records.length, 1)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0].message, /Duplicate email/)
})

