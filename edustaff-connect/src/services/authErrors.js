export function authenticationErrorMessage(error) {
  if (error?.code === 'API_BASE_URL_MISSING') {
    return 'This Android app is missing its server configuration. Install an app build configured for the EduConnect server.'
  }

  if (error?.response) {
    const { status, data } = error.response
    if (status === 401) return 'Invalid email or password.'
    if (status === 503) return 'Authentication service is temporarily unavailable. Please try again later.'
    if (status >= 500) return 'Authentication service encountered an error. Please try again later.'
    if (typeof data?.message === 'string') return data.message
    return 'The authentication request could not be completed.'
  }

  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'The authentication request timed out. Please try again.'
  }
  if (error?.request || error?.code === 'ERR_NETWORK') {
    return 'Unable to connect to the server. Check your connection and try again.'
  }
  return 'Unable to authenticate. Please try again.'
}
