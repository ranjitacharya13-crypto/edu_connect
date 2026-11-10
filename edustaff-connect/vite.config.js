import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'android') {
    const configuredApiUrl = env.VITE_API_BASE_URL?.trim()
    let apiUrl
    try {
      apiUrl = new URL(configuredApiUrl)
    } catch {
      throw new Error('Android builds require VITE_API_BASE_URL to be the verified public HTTPS API URL ending in /api.')
    }
    const hostname = apiUrl.hostname.toLowerCase()
    if (
      apiUrl.protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      apiUrl.username ||
      apiUrl.password ||
      apiUrl.search ||
      apiUrl.hash ||
      !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api')
    ) {
      throw new Error('Android builds require a reachable public HTTPS VITE_API_BASE_URL ending in /api, without loopback hosts, credentials, or query parameters.')
    }
  }

  return {
    // Capacitor serves the bundled app from its local WebView origin. Relative
    // asset URLs work both there and when the same build is deployed at `/`.
    base: './',
    plugins: [react(), tailwindcss(), {
      name: 'educonnect-apk-headers',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] === '/downloads/educonnect.apk') {
            response.setHeader('Content-Type', 'application/vnd.android.package-archive')
            response.setHeader('Content-Disposition', 'attachment; filename="educonnect.apk"')
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] === '/downloads/educonnect.apk') {
            response.setHeader('Content-Type', 'application/vnd.android.package-archive')
            response.setHeader('Content-Disposition', 'attachment; filename="educonnect.apk"')
          }
          next()
        })
      },
    }],
    server: {
      allowedHosts: ['.ngrok-free.dev'],
      proxy: {
        '/api': 'http://localhost:5000',
      },
    },
  }
})
