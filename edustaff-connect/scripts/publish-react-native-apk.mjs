import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(projectRoot, 'mobile/android/app/build/outputs/apk/debug/app-debug.apk')
const destination = resolve(projectRoot, 'public/downloads/educonnect.apk')
const manifest = resolve(projectRoot, 'public/downloads/educonnect.apk.json')
const rollback = resolve(projectRoot, 'public/downloads/educonnect-capacitor-rollback.apk')
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
if (!apiBaseUrl) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the active HTTPS API URL ending in /api before publishing.')

const bytes = readFileSync(source)
if (bytes.subarray(0, 2).toString() !== 'PK' || bytes.length < 1024) {
  throw new Error(`Not a valid APK/ZIP artifact: ${source}`)
}

const apiUrl = new URL(apiBaseUrl)
if (apiUrl.protocol !== 'https:' || !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api')) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be a public HTTPS URL ending in /api.')
}
const healthHeaders = apiUrl.hostname.toLowerCase().endsWith('.ngrok-free.dev')
  ? { 'ngrok-skip-browser-warning': 'true' }
  : {}
let healthResponse
try {
  healthResponse = await fetch(new URL(`${apiUrl.pathname}/health`, apiUrl.origin), {
    headers: healthHeaders,
    signal: AbortSignal.timeout(15000),
  })
} catch (error) {
  throw new Error(`The configured API health endpoint is unreachable (${error.name === 'TimeoutError' ? 'timed out' : error.message}).`)
}
if (!healthResponse.ok) throw new Error(`The configured API health endpoint returned HTTP ${healthResponse.status}; keeping the current website download unchanged.`)
const health = await healthResponse.json()
if (health?.ok !== true || health?.database?.connected !== true) {
  throw new Error('The configured API or MongoDB is unhealthy; keeping the current website download unchanged.')
}

const androidHome = process.env.ANDROID_HOME || resolve(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
const buildTools = resolve(androidHome, 'build-tools', '36.0.0')
const aapt = resolve(buildTools, process.platform === 'win32' ? 'aapt.exe' : 'aapt')
const javaHome = process.env.JAVA_HOME || (process.platform === 'win32' ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : '')
const javaTool = resolve(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
const apksignerJar = resolve(buildTools, 'lib', 'apksigner.jar')
const jarTool = resolve(javaHome, 'bin', process.platform === 'win32' ? 'jar.exe' : 'jar')
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error || result.status !== 0) {
    throw new Error(`APK verification failed: ${result.error?.message || result.stderr || `${command} exited ${result.status}`}`)
  }
  return result.stdout
}

run(javaTool, ['-jar', apksignerJar, 'verify', '--verbose', source])
const metadata = run(aapt, ['dump', 'badging', source])
if (!metadata.includes("package: name='com.educonnect.edustaff'") ||
    !metadata.includes('launchable-activity: name=') ||
    !metadata.includes('MainActivity')) {
  throw new Error('APK package or launcher verification failed; keeping the current website download unchanged.')
}

const verificationRoot = mkdtempSync(resolve(tmpdir(), 'educonnect-apk-verify-'))
let newApk
let previousApk
let newManifest
let previousManifest
let existingApkBackedUp = false
let apkReplaced = false
let manifestReplaced = false
try {
  const entries = run(jarTool, ['tf', source])
  if (!entries.split(/\r?\n/).includes('assets/index.android.bundle')) {
    throw new Error('The APK does not contain its embedded React Native JavaScript bundle.')
  }
  run(jarTool, ['xf', source, 'assets/index.android.bundle'], { cwd: verificationRoot })
  const bundlePath = resolve(verificationRoot, 'assets', 'index.android.bundle')
  if (!readFileSync(bundlePath).includes(Buffer.from(apiBaseUrl))) {
    throw new Error('The embedded React Native bundle does not contain EXPO_PUBLIC_API_BASE_URL.')
  }

  mkdirSync(dirname(destination), { recursive: true })
  newApk = resolve(dirname(destination), `.educonnect-${process.pid}.apk.tmp`)
  newManifest = resolve(dirname(manifest), `.educonnect-${process.pid}.manifest.tmp`)
  if (existsSync(destination)) {
    previousApk = resolve(dirname(destination), `.educonnect-${process.pid}.apk.previous`)
    copyFileSync(destination, previousApk)
    if (!existsSync(rollback)) copyFileSync(destination, rollback)
    existingApkBackedUp = true
  }
  if (existsSync(manifest)) {
    previousManifest = resolve(dirname(manifest), `.educonnect-${process.pid}.manifest.previous`)
    copyFileSync(manifest, previousManifest)
  }

  copyFileSync(source, newApk)
  const { size } = statSync(newApk)
  writeFileSync(newManifest, `${JSON.stringify({ available: true, filename: 'educonnect.apk', size }, null, 2)}\n`)
  renameSync(newApk, destination)
  apkReplaced = true
  renameSync(newManifest, manifest)
  manifestReplaced = true
  console.log(`Published verified React Native APK to ${destination} (${size} bytes)`)
  if (existingApkBackedUp) console.log(`Preserved previous website APK at ${rollback}`)
} catch (error) {
  if (apkReplaced && previousApk) copyFileSync(previousApk, destination)
  else if (apkReplaced && !existingApkBackedUp) rmSync(destination, { force: true })
  if (manifestReplaced && previousManifest) copyFileSync(previousManifest, manifest)
  throw error
} finally {
  for (const temporary of [newApk, previousApk, newManifest, previousManifest]) {
    if (temporary) rmSync(temporary, { force: true })
  }
  rmSync(verificationRoot, { recursive: true, force: true })
}
