import { existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const files = [
  resolve(projectRoot, 'dist/downloads/educonnect.apk'),
  resolve(projectRoot, 'dist/downloads/educonnect.apk.json'),
  resolve(projectRoot, 'android/app/src/main/assets/public/downloads/educonnect.apk'),
  resolve(projectRoot, 'android/app/src/main/assets/public/downloads/educonnect.apk.json'),
]

for (const file of files) {
  if (existsSync(file)) unlinkSync(file)
}

console.log('Removed website-only APK artifacts from the Android bundle')
