import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function inspectLocalMongo() {
  if (process.platform !== 'win32') return { platform: process.platform, supported: false, message: 'Automated local MongoDB service checks are implemented for Windows.' }
  const script = "$command = Get-Command mongod -ErrorAction SilentlyContinue; $service = Get-Service -Name MongoDB -ErrorAction SilentlyContinue; [pscustomobject]@{ executable = if ($command) { $command.Source } else { '' }; service = if ($service) { $service.Status.ToString() } else { 'NotInstalled' }; startType = if ($service) { $service.StartType.ToString() } else { '' } } | ConvertTo-Json -Compress"
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000 })
    const result = JSON.parse(stdout.trim())
    return { platform: 'win32', supported: true, executable: result.executable || null, service: result.service, startType: result.startType || null, installed: Boolean(result.executable || result.service !== 'NotInstalled') }
  } catch {
    return { platform: 'win32', supported: true, installed: false, service: 'Unknown', message: error.message }
  }
}

export async function setupLocalMongo() {
  const before = await inspectLocalMongo()
  if (!before.installed) return { ...before, started: false, action: 'manual_install_required', message: 'MongoDB Community Server is not detected. Install it from the official MongoDB distribution, then run this check again.' }
  if (before.service === 'Running') return { ...before, started: true, action: 'already_running', message: 'The MongoDB Windows service is already running.' }
  if (before.service !== 'Stopped') return { ...before, started: false, action: 'manual_start_required', message: 'MongoDB is installed but its Windows service could not be started automatically.' }
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Start-Service -Name MongoDB -ErrorAction Stop"], { windowsHide: true, timeout: 15000 })
    const after = await inspectLocalMongo()
    return { ...after, started: after.service === 'Running', action: after.service === 'Running' ? 'started' : 'start_failed', message: after.service === 'Running' ? 'MongoDB service started successfully.' : 'The MongoDB service did not report Running after the start request.' }
  } catch {
    return { ...before, started: false, action: 'permission_required', message: 'MongoDB is installed but starting its Windows service requires administrator permission.' }
  }
}
