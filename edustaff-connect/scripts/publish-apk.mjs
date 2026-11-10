import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(projectRoot, 'android/app/build/outputs/apk/debug/app-debug.apk')
const destination = resolve(projectRoot, 'public/downloads/educonnect.apk')
const manifest = resolve(projectRoot, 'public/downloads/educonnect.apk.json')

const bytes = readFileSync(source)
if (bytes.subarray(0, 2).toString() !== 'PK') throw new Error(`Not a valid APK/ZIP artifact: ${source}`)
mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)
const { size } = statSync(destination)
if (size < 1024) throw new Error(`APK is unexpectedly small: ${size} bytes`)
writeFileSync(manifest, `${JSON.stringify({ available: true, filename: 'educonnect.apk', size }, null, 2)}\n`)
console.log(`Published ${destination} (${size} bytes)`)
