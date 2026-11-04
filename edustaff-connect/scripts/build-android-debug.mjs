import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const androidRoot = resolve(projectRoot, 'android')
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const result = spawnSync(gradleCommand, ['--no-daemon', 'assembleDebug'], {
  cwd: androidRoot,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

if (result.error) {
  console.error(`Could not start the Android debug build: ${result.error.message}`)
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}