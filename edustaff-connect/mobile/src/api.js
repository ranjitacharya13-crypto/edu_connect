import * as SecureStore from 'expo-secure-store'

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '')
const TOKEN_KEY = 'edustaff_token'
let unauthorizedHandler = null

function getBaseUrl() {
  if (!API_BASE_URL) throw new Error('API is not configured. Set EXPO_PUBLIC_API_BASE_URL to the school HTTPS API URL ending in /api.')
  let url
  try {
    url = new URL(API_BASE_URL)
  } catch {
    throw new Error('The configured API URL is invalid.')
  }
  if (
    url.protocol !== 'https:' ||
    !url.pathname.replace(/\/+$/, '').endsWith('/api') ||
    url.hostname.toLowerCase().endsWith('.localhost') ||
    url.hostname.toLowerCase() === 'localhost' ||
    url.hostname.toLowerCase() === '127.0.0.1' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())
  ) {
    throw new Error('The app requires a public HTTPS API URL ending in /api.')
  }
  return url
}

export async function api(path, { method = 'GET', body, file, token, query, responseType = 'json' } = {}) {
  const base = getBaseUrl()
  const url = new URL(`${base.pathname.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`, base.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(key, String(item))
        } else {
          url.searchParams.set(key, String(value))
        }
      }
    }
  }

  const headers = { Accept: 'application/json' }
  if (base.hostname.toLowerCase().endsWith('.ngrok-free.dev')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }
  const sessionToken = token ?? await SecureStore.getItemAsync(TOKEN_KEY)
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`

  let requestBody
  if (file) {
    const form = new FormData()
    form.append('file', {
      uri: file.uri,
      name: file.name || 'upload.csv',
      type: file.mimeType || 'text/csv',
    })
    requestBody = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }

  let response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    response = await fetch(url.toString(), { method, headers, body: requestBody, signal: controller.signal })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The API request timed out. Check the server and try again.')
    throw new Error(`Could not connect to the API. Check the HTTPS endpoint and network connection. ${error.message}`)
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 204) return null
  const raw = await response.text()
  let data
  if (responseType === 'text') {
    data = raw
  } else {
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      throw new Error('The API returned an invalid response. Check that the configured URL points to the backend API.')
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !/\/auth\/(login|signup)$/.test(path)) {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      unauthorizedHandler?.()
    }
    const detail = data?.message || data?.error || `Request failed (${response.status}).`
    throw new Error(detail)
  }
  return data
}

export const storeToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token)
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY)
export const savedToken = () => SecureStore.getItemAsync(TOKEN_KEY)
export const setUnauthorizedHandler = (handler) => { unauthorizedHandler = handler }
