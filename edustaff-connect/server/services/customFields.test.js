import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDefinition, validateValue, validateValues } from './customFields.js'

const field = (type, extra = {}) => ({
  key: 'learner_info',
  label: 'Learner info',
  type,
  required: false,
  options: [],
  ...extra,
})

test('custom field definitions enforce IDs, reserved keys, and select options', () => {
  assert.equal(validateDefinition({ key: 'a', label: 'A field', type: 'text' }).key, 'a')
  assert.throws(() => validateDefinition({ key: 'student', label: 'Student', type: 'text' }), /not be reserved/)
  assert.throws(() => validateDefinition({ key: 'bad-id', label: 'Bad ID', type: 'text' }), /Field ID/)
  assert.throws(() => validateDefinition({ key: 'choices', label: 'Choices', type: 'select', options: [] }), /require between 1 and 100/)
  assert.throws(() => validateDefinition({
    key: 'choices',
    label: 'Choices',
    type: 'multi_select',
    options: [{ value: 'A', label: 'A' }, { value: 'a', label: 'Another A' }],
  }), /unique/)
})

test('custom field values validate supported types and normalize choice labels', () => {
  assert.equal(validateValue(field('number'), '12.5'), 12.5)
  assert.equal(validateValue(field('date'), '2026-03-15'), '2026-03-15')
  assert.throws(() => validateValue(field('date'), '2026-02-31'), /valid date/)
  assert.throws(() => validateValue(field('url'), 'javascript:alert(1)'), /HTTP or HTTPS/)
  assert.equal(validateValue(field('select', {
    options: [{ value: 'north', label: 'North Campus' }],
  }), 'North Campus'), 'north')
  assert.deepEqual(validateValue(field('multi_select', {
    options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }],
  }), ['Alpha', 'b']), ['a', 'b'])
  assert.throws(() => validateValue(field('multi_select', {
    options: [{ value: 'a', label: 'Alpha' }],
  }), ['a', 'Alpha']), /invalid or duplicate/)
})

test('required values and unknown or archived keys are rejected', () => {
  const required = field('text', { required: true })
  assert.throws(() => validateValue(required, ''), /is required/)
  assert.throws(() => validateValue(field('boolean', { required: true }), false), /must be checked/)
  assert.throws(() => validateValue(field('multi_select', { required: true }), []), /is required/)
  assert.throws(() => validateValues([required], { unrelated: 'value' }), /Unknown custom field/)
  assert.throws(() => validateValues([{ ...required, state: 'archived' }], { learner_info: 'value' }), /Unknown custom field/)
})

test('partial custom field updates omit untouched fields and keep validated values', () => {
  const fields = [field('text'), field('number', { key: 'seat_count', label: 'Seat count' })]
  assert.deepEqual(validateValues(fields, { seat_count: '4' }, { partial: true }), { seat_count: 4 })
})
