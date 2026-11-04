import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticationErrorMessage } from '../src/services/authErrors.js'

test('authentication errors keep invalid credentials generic', () => {
  assert.equal(
    authenticationErrorMessage({ response: { status: 401, data: { message: 'Invalid email or password' } } }),
    'Invalid email or password.',
  )
})

test('authentication errors distinguish missing API configuration and network failure', () => {
  assert.match(authenticationErrorMessage({ code: 'API_BASE_URL_MISSING' }), /server configuration/)
  assert.match(authenticationErrorMessage({ code: 'ERR_NETWORK', request: {} }), /Unable to connect/)
  assert.match(authenticationErrorMessage({ code: 'ECONNABORTED' }), /timed out/)
})

test('authentication errors map unavailable and server responses to safe messages', () => {
  assert.match(authenticationErrorMessage({ response: { status: 503 } }), /temporarily unavailable/)
  assert.match(authenticationErrorMessage({ response: { status: 500, data: { message: 'private server detail' } } }), /encountered an error/)
  assert.doesNotMatch(authenticationErrorMessage({ response: { status: 500, data: { message: 'private server detail' } } }), /private server detail/)
})
