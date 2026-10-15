import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTeacherDateOfBirth } from './ageValidation.js'

const today = new Date(Date.UTC(2026, 9, 15))
test('rejects missing, invalid, and future dates', () => {
  assert.equal(validateTeacherDateOfBirth('', today).valid, false)
  assert.equal(validateTeacherDateOfBirth('not-a-date', today).valid, false)
  assert.equal(validateTeacherDateOfBirth('2026-10-16', today).message, 'Date of birth cannot be in the future.')
})
test('rejects applicants before their eighteenth birthday', () => {
  assert.equal(validateTeacherDateOfBirth('2008-10-16', today).valid, false)
})
test('accepts an applicant on their eighteenth birthday and older', () => {
  assert.equal(validateTeacherDateOfBirth('2008-10-15', today).valid, true)
  assert.equal(validateTeacherDateOfBirth('1990-02-28', today).valid, true)
})
test('handles leap-day birthdays by calendar comparison', () => {
  const leapDayBirthday = new Date(Date.UTC(2008, 1, 29))
  assert.equal(validateTeacherDateOfBirth('2008-02-29', new Date(Date.UTC(2026, 1, 28))).valid, false)
  assert.equal(validateTeacherDateOfBirth('2008-02-29', new Date(Date.UTC(2026, 2, 1))).valid, true)
  assert.equal(leapDayBirthday.getUTCDate(), 29)
})
