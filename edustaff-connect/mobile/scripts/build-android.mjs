import { spawnSync } from 'node:child_process'
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const androidRoot = resolve(projectRoot, 'android')
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()

if (!apiBaseUrl) {
  throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the reachable HTTPS API URL ending in /api before building.')
}

let apiUrl
try {
  apiUrl = new URL(apiBaseUrl)
} catch {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not a valid URL.')
}
if (
  apiUrl.protocol !== 'https:' ||
  ['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname.toLowerCase()) ||
  apiUrl.hostname.toLowerCase().endsWith('.localhost') ||
  apiUrl.username ||
  apiUrl.password ||
  apiUrl.search ||
  apiUrl.hash ||
  !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api')
) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be a public HTTPS URL ending in /api.')
}

const healthUrl = new URL(`${apiUrl.pathname.replace(/\/+$/, '')}/health`, apiUrl.origin)
const healthHeaders = {}
if (apiUrl.hostname.toLowerCase().endsWith('.ngrok-free.dev')) {
  healthHeaders['ngrok-skip-browser-warning'] = 'true'
}
let healthResponse
try {
  healthResponse = await fetch(healthUrl, { headers: healthHeaders, signal: AbortSignal.timeout(15000) })
} catch (error) {
  throw new Error(`Could not reach the configured API health endpoint (${error.name === 'TimeoutError' ? 'timed out' : error.message}). Start the backend and ngrok, then verify ${healthUrl}.`)
}
if (!healthResponse.ok) {
  throw new Error(`The configured API health endpoint returned HTTP ${healthResponse.status}. Refusing to build an APK for an unavailable or incorrect backend: ${healthUrl}.`)
}
let health
try {
  health = await healthResponse.json()
} catch {
  throw new Error(`The configured API health endpoint did not return JSON: ${healthUrl}.`)
}
if (health?.ok !== true || health?.database?.connected !== true) {
  throw new Error(`The API is reachable, but its health check reports the database is not connected. Refusing to build the APK: ${JSON.stringify(health?.database || {})}`)
}
console.log(`API and MongoDB health check passed: ${healthUrl}`)

if (process.platform === 'win32') {
  const defaultJdk = 'C:\\Program Files\\Android\\Android Studio\\jbr'
  const defaultSdk = `${process.env.LOCALAPPDATA || ''}\\Android\\Sdk`
  if (!process.env.JAVA_HOME && existsSync(resolve(defaultJdk, 'bin', 'java.exe'))) process.env.JAVA_HOME = defaultJdk
  if (!process.env.ANDROID_HOME && existsSync(resolve(defaultSdk, 'platform-tools', 'adb.exe'))) process.env.ANDROID_HOME = defaultSdk
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
let temporaryRoot
let buildProjectRoot = projectRoot

if (process.platform === 'win32') {
  const buildTempParent = process.env.EDUCONNECT_BUILD_TEMP_DIR || process.env.USERPROFILE || tmpdir()
  if (!existsSync(buildTempParent)) mkdirSync(buildTempParent, { recursive: true })
  temporaryRoot = mkdtempSync(resolve(buildTempParent, 'educonnect-build-'))
  buildProjectRoot = resolve(temporaryRoot, basename(projectRoot))
  const generatedAndroidRoot = resolve(projectRoot, 'android').toLowerCase().replaceAll('\\', '/')
  const generatedExpoRoot = resolve(projectRoot, '.expo').toLowerCase().replaceAll('\\', '/')
  cpSync(projectRoot, buildProjectRoot, {
    recursive: true,
    filter: (source) => {
      const normalized = source.toLowerCase().replaceAll('\\', '/')
      return normalized !== generatedAndroidRoot &&
        normalized !== generatedExpoRoot &&
        !normalized.endsWith('/android/build') &&
        !normalized.endsWith('/android/.cxx')
    },
  })
}

const prebuild = spawnSync(npx, ['expo', 'prebuild', '--platform', 'android', '--no-install'], {
  cwd: buildProjectRoot,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})
if (prebuild.error) throw new Error(`Could not start Expo prebuild: ${prebuild.error.message}`)
if (prebuild.status !== 0) throw new Error(`Expo prebuild failed with exit code ${prebuild.status}. Build files remain at ${buildProjectRoot}.`)

const androidBuildRoot = resolve(buildProjectRoot, 'android')
const appGradlePath = resolve(androidBuildRoot, 'app', 'build.gradle')
const appGradle = readFileSync(appGradlePath, 'utf8')
const reactBlock = /^([ \t]*react[ \t]*\{)[ \t]*$/m
if (!reactBlock.test(appGradle)) {
  throw new Error(`Could not find the React Native Gradle configuration in ${appGradlePath}. Build files remain at ${buildProjectRoot}.`)
}
writeFileSync(appGradlePath, appGradle.replace(reactBlock, '$1\n    debuggableVariants = []'))

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const build = spawnSync(gradle, ['--no-daemon', 'assembleDebug'], {
  cwd: androidBuildRoot,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})
if (build.error) throw new Error(`Could not start the Android debug build: ${build.error.message}`)
if (build.status !== 0) {
  throw new Error(`Gradle Android build failed with exit code ${build.status}. Build files remain at ${buildProjectRoot}.`)
}

if (temporaryRoot) {
  const builtApk = resolve(androidBuildRoot, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  if (!existsSync(builtApk) || statSync(builtApk).size === 0) {
    throw new Error(`Gradle succeeded but did not produce a non-empty APK at ${builtApk}. Build files remain at ${buildProjectRoot}.`)
  }
  const generatedBundle = resolve(androidBuildRoot, 'app', 'build', 'generated', 'assets', 'react', 'debug', 'index.android.bundle')
  if (!existsSync(generatedBundle) || !readFileSync(generatedBundle).includes(Buffer.from(apiBaseUrl))) {
    throw new Error(`The Android bundle does not contain the configured API URL. Build files remain at ${buildProjectRoot}.`)
  }
  const jarTool = process.platform === 'win32' ? resolve(process.env.JAVA_HOME, 'bin', 'jar.exe') : 'jar'
  const archive = spawnSync(jarTool, ['tf', builtApk], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  if (archive.error || archive.status !== 0) {
    throw new Error(`Could not inspect the built APK archive: ${archive.error?.message || archive.stderr || `jar exited ${archive.status}`}. Build files remain at ${buildProjectRoot}.`)
  }
  if (!archive.stdout.split(/\r?\n/).includes('assets/index.android.bundle')) {
    throw new Error(`The APK does not contain its embedded React Native JavaScript bundle. Build files remain at ${buildProjectRoot}.`)
  }
  const outputApk = resolve(androidRoot, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  mkdirSync(dirname(outputApk), { recursive: true })
  copyFileSync(builtApk, outputApk)
  console.log(`Copied the verified build output to ${outputApk}`)
  try {
    rmSync(temporaryRoot, { recursive: true, force: true })
  } catch (error) {
    console.error(`Could not remove temporary Android build directory ${temporaryRoot}: ${error.message}`)
  }
}
