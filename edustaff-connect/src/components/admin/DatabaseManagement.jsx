import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Database, LoaderCircle, RefreshCw, Server, ShieldCheck, X } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { adminApi } from '../../services/api'

const providerLabels = { local: 'Local MongoDB', atlas: 'MongoDB Atlas' }

function requestMessage(error, fallback) {
  const status = error.response?.status
  if (status === 401) return 'Your administrator session expired. Please sign in again.'
  if (status === 403) return 'Administrator permission is required for database management.'
  return error.response?.data?.message || fallback
}

function StatusBadge({ status, connected, configured = true }) {
  const label = !configured ? 'Not configured' : status === 'stale' ? 'Stale' : status === 'unknown' ? 'Checking' : status === 'error' ? 'Unavailable' : connected ? 'Connected' : 'Unavailable'
  const tone = connected ? 'bg-emerald-100 text-emerald-800' : !configured ? 'bg-slate-100 text-slate-600' : status === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}><span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-600' : status === 'error' ? 'bg-red-600' : 'bg-amber-600'}`} />{label}</span>
}

function ProviderCard({ provider, status, selected, busy, onTest, onSelect }) {
  const isLocal = provider === 'local'
  const ProviderIcon = isLocal ? Server : Database
  const info = status?.providers?.[provider]
  return <div className={`rounded-3xl border p-5 transition ${selected ? 'border-blue-600 bg-blue-50/60 shadow-lg shadow-blue-700/10' : 'bg-white/60 hover:border-blue-300'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-blue-100 text-blue-700"><ProviderIcon size={21} /></div><div><h3 className="font-black">{providerLabels[provider]}</h3><p className="text-xs font-bold text-slate-500">{isLocal ? 'Developer machine' : 'Managed cloud database'}</p></div></div>
      <StatusBadge status={info?.status} connected={info?.connected} configured={info?.configured !== false} />
    </div>
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[10px] font-black uppercase text-slate-500">Database</dt><dd className="font-bold">{info?.databaseName || '—'}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Endpoint</dt><dd className="break-words font-bold">{info?.endpoint || '—'}</dd></div>{isLocal && <div><dt className="text-[10px] font-black uppercase text-slate-500">Windows service</dt><dd className="font-bold">{info?.installation?.service || 'Unknown'}</dd></div>}</dl>
    {info?.message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{info.message}</p>}
    {info?.lastCheckedAt && <p className="mt-3 text-[11px] font-bold text-slate-500">Last checked: {new Date(info.lastCheckedAt).toLocaleString()}</p>}
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => onSelect(provider)} disabled={busy || info?.configured === false} className={`min-h-10 rounded-xl px-3 text-xs font-black ${selected ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}>{selected ? 'Selected' : 'Select provider'}</button><button type="button" onClick={() => onTest(provider)} disabled={busy || info?.configured === false} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50"><RefreshCw size={13} /> Check connection</button></div>
  </div>
}

export default function DatabaseManagement() {
  const { showToast } = useToast()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('atlas')
  const [databaseName, setDatabaseName] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [localSetup, setLocalSetup] = useState(null)
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const requestInFlightRef = useRef(false)

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    if (requestInFlightRef.current) return
    requestInFlightRef.current = true
    const requestId = ++requestRef.current
    if (!silent) setLoading(true)
    setError('')
    try {
      const next = await adminApi.databaseStatus()
      if (requestId === requestRef.current) { setStatus(next); setSelectedProvider(next.provider); setDatabaseName(next.databaseName || '') }
    } catch (requestError) { if (requestId === requestRef.current) setError(requestMessage(requestError, 'Could not load database status')) }
    finally { requestInFlightRef.current = false; if (!silent && requestId === requestRef.current) setLoading(false) }
  }, [])

  useEffect(() => {
    loadStatus()
    const refresh = () => { if (document.visibilityState === 'visible') loadStatus({ silent: true }) }
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') loadStatus({ silent: true }) }
    const timer = window.setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibilityChange) }
  }, [loadStatus])

  const target = useMemo(() => ({ provider: selectedProvider, databaseName: databaseName.trim() }), [selectedProvider, databaseName])
  const targetLabel = providerLabels[target.provider]

  async function test(provider = selectedProvider) {
    setBusy(true); setError('')
    try { const result = await adminApi.databaseTest(provider, databaseName.trim()); showToast(`${providerLabels[provider]} connection verified (${result.latencyMs}ms)`); await loadStatus() }
    catch (requestError) { setError(requestMessage(requestError, 'Connection test failed')) }
    finally { setBusy(false) }
  }

  async function switchDatabase() {
    setBusy(true); setError('')
    try { await adminApi.databaseSwitch(target.provider, target.databaseName); setConfirmation(false); showToast('Database switch completed and verified'); await loadStatus() }
    catch (requestError) { setError(requestMessage(requestError, 'Database switch failed')) }
    finally { setBusy(false) }
  }

  async function setupLocal() {
    setBusy(true); setError('')
    try { const result = await adminApi.setupLocalDatabase(); setLocalSetup(result); showToast(result.message); await loadStatus() }
    catch (requestError) { setError(requestMessage(requestError, 'Local MongoDB setup check failed')) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="glass-panel rounded-3xl border p-8 text-center text-sm font-bold text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Loading database status...</div>

  return <section className="space-y-5" aria-labelledby="database-management-title">
    <div className="glass-panel rounded-3xl border p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="text-blue-700" size={20} /><h2 id="database-management-title" className="text-xl font-black">Database management</h2></div><p className="mt-1 max-w-2xl text-sm font-bold text-slate-500">Control the server-side MongoDB provider used by the application. Records are isolated; switching does not copy, merge, or delete data.</p></div><button type="button" onClick={loadStatus} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black"><RefreshCw size={14} /> Refresh</button></div>
      {error && <div role="alert" className="mt-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><AlertTriangle className="shrink-0" size={18} />{error}</div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border bg-white/70 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Active provider</p><p className="mt-1 font-black">{providerLabels[status?.provider] || 'Unknown'}</p></div><div className="rounded-2xl border bg-white/70 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Active database</p><p className="mt-1 font-black">{status?.databaseName || '—'}</p></div><div className="rounded-2xl border bg-white/70 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Last health check</p><p className="mt-1 font-bold">{status?.lastSuccessfulHealthCheck ? new Date(status.lastSuccessfulHealthCheck).toLocaleString() : 'Not verified'}</p></div><div className="rounded-2xl border bg-white/70 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Last operation</p><p className="mt-1 font-black capitalize">{status?.lastOperation?.status || 'Unknown'}</p><p className="mt-1 text-xs font-bold text-slate-500">{status?.lastOperation?.message || 'No switch attempted'}</p></div></div>
    </div>
    <div className="grid gap-5 lg:grid-cols-2"><ProviderCard provider="local" status={status} selected={selectedProvider === 'local'} busy={busy} onTest={test} onSelect={setSelectedProvider} /><ProviderCard provider="atlas" status={status} selected={selectedProvider === 'atlas'} busy={busy} onTest={test} onSelect={setSelectedProvider} /></div>
    <div className="glass-panel rounded-3xl border p-5 sm:p-6"><h3 className="font-black">Target configuration</h3><p className="mt-1 text-xs font-bold text-slate-500">Use letters, numbers, hyphens, or underscores. Changing the name never migrates data.</p><div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Database name</span><input value={databaseName} onChange={(event) => setDatabaseName(event.target.value)} maxLength={63} className="h-11 w-full rounded-xl border border-slate-300 bg-white/80 px-3 text-sm font-bold outline-none focus:border-blue-600" /></label><button type="button" disabled={busy || !databaseName.trim()} onClick={() => setConfirmation(true)} className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">Switch to {targetLabel}</button></div>
      {selectedProvider === 'local' && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black">Local MongoDB setup</p><p className="text-xs font-bold text-slate-500">Detect or start the existing Windows MongoDB service. Installation is never performed silently.</p></div><button type="button" onClick={setupLocal} disabled={busy} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black">Check / start service</button></div>{localSetup && <pre className="mt-3 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{localSetup.message}</pre>}</div>}
    </div>
    {confirmation && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="switch-title"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 id="switch-title" className="text-xl font-black">Confirm database switch</h3><p className="mt-1 text-sm font-bold text-slate-500">The backend will test the target before applying it.</p></div><button type="button" onClick={() => setConfirmation(false)} aria-label="Cancel switch" className="grid size-9 place-items-center rounded-xl bg-slate-100"><X size={18} /></button></div><div className="mt-5 space-y-3 rounded-2xl border bg-amber-50 p-4 text-sm font-bold text-amber-900"><p><strong>Current:</strong> {providerLabels[status?.provider]} / {status?.databaseName}</p><p><strong>Target:</strong> {targetLabel} / {target.databaseName}</p><p className="flex gap-2"><AlertTriangle size={18} className="shrink-0" />These providers may contain different records. Active requests can briefly lose their database connection while the transition is applied. No data will be copied, merged, or deleted.</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmation(false)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-black">Cancel</button><button type="button" onClick={switchDatabase} disabled={busy} className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">{busy ? 'Verifying...' : 'Test and switch'}</button></div></div></div>}
  </section>
}
