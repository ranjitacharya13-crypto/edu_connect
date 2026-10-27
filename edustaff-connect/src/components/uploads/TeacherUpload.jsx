import { useState } from 'react'
import { Download, FileText, Upload, UserPlus, X } from 'lucide-react'
import { teacherUploadApi } from '../../services/api'

const headers = ['Full Name', 'Date of Birth', 'Phone', 'Email', 'Password']
const initial = { name: '', email: '', phone: '', dateOfBirth: '', password: '' }

function downloadTemplate() {
  const blob = new Blob([[headers.join(','), 'Example Teacher,teacher@example.com,9876543210,1990-01-01,change-me-now'].join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'educonnect-teachers-template.csv'; link.click(); URL.revokeObjectURL(link.href)
}

export default function TeacherUpload({ onSuccess }) {
  const [tab, setTab] = useState('manual'); const [form, setForm] = useState(initial); const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState(''); const [errors, setErrors] = useState([]); const [preview, setPreview] = useState(null)
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  async function submitManual(event) {
    event.preventDefault(); setLoading(true); setErrors([]); setMessage('')
    try { await teacherUploadApi.create(form); setMessage('Teacher account created successfully.'); setForm(initial); onSuccess?.('teacher') }
    catch (error) { setErrors(Object.values(error.response?.data?.fields || {}).concat(error.response?.data?.message || 'Teacher account could not be created')) }
    finally { setLoading(false) }
  }
  async function previewCsv() {
    if (!file) { setErrors(['A CSV file is required']); return }; setLoading(true); setErrors([]); setMessage('')
    try { const result = await teacherUploadApi.preview(file); setPreview(result); setErrors((result.errors || []).map((error) => `Row ${error.row}: ${error.message}`)) }
    catch (error) { setErrors([error.response?.data?.message || 'CSV could not be validated']) } finally { setLoading(false) }
  }
  async function importCsv() {
    if (!file) { setErrors(['A CSV file is required']); return }; setLoading(true); setErrors([])
    try { const result = await teacherUploadApi.import(file); setMessage(`Created ${result.created}, skipped ${result.skipped}, failed ${result.failed}.`); setErrors(result.results.filter((r) => r.status !== 'created').map((r) => `Row ${r.row}: ${r.message || 'Invalid data'}`)); onSuccess?.('teacher') }
    catch (error) { setErrors([error.response?.data?.message || 'Teacher import failed']) } finally { setLoading(false) }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 border-b border-slate-200/70">
      {['manual', 'csv'].map((value) => { const Icon = value === 'manual' ? UserPlus : Upload; return <button key={value} onClick={() => setTab(value)} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-2 font-bold ${tab === value ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}><Icon size={18} />{value === 'manual' ? 'Manual Entry' : 'CSV Upload'}</button> })}
    </div>
    {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{message}</p>}
    {errors.length > 0 && <ul className="list-disc rounded-xl border border-red-200 bg-red-50 p-3 pl-7 text-sm font-bold text-red-700">{errors.slice(0, 20).map((error, i) => <li key={i}>{error}</li>)}</ul>}
    {tab === 'manual' ? <form onSubmit={submitManual} className="grid gap-4 md:grid-cols-2">
      {[['name', 'Full name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['dateOfBirth', 'Date of birth', 'date'], ['password', 'Password', 'password']].map(([name, label, type]) => <label key={name} className="text-sm font-black text-slate-700">{label} *<input required type={type} value={form[name]} onChange={(e) => update(name, e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300/70 bg-white/65 px-4 outline-none" /></label>)}
      <p className="text-xs font-bold text-slate-500 md:col-span-2">Teacher accounts require age 18 or older. Passwords are hashed by the server and never returned.</p>
      <button disabled={loading} className="min-h-11 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50 md:col-span-2">{loading ? 'Creatingâ€¦' : 'Create Teacher Account'}</button>
    </form> : <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-slate-300/70 bg-white/40 p-5 text-center"><FileText size={42} className="mx-auto mb-3 text-slate-400" /><p className="font-bold">Required columns: {headers.join(', ')}</p><p className="mb-4 text-xs font-bold text-slate-500">Use UTF-8 CSV with dates in YYYY-MM-DD format. Passwords are used only during provisioning and are never shown in previews or results.</p><div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={downloadTemplate} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black"><Download size={16} /> Template</button><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-700 px-4 font-black text-white"><Upload size={16} /> Select file<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const selectedFile = e.target.files?.[0] || null; setFile(selectedFile); setPreview(null); setErrors([]); setMessage(''); e.target.value = '' }} /></label></div>{file && <p className="mt-3 font-bold">{file.name} Â· {(file.size / 1024 / 1024).toFixed(2)} MB <button type="button" onClick={() => { setFile(null); setPreview(null); setErrors([]); setMessage('') }} aria-label="Remove selected file"><X size={16} className="inline" /></button></p>}</div>
      {file && !preview && <button onClick={previewCsv} disabled={loading} className="min-h-11 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50">{loading ? 'Validatingâ€¦' : 'Validate CSV'}</button>}
      {preview && <div className="space-y-3"><p className="font-black">{preview.totalRows} rows detected Â· {preview.validRows} valid</p><button onClick={importCsv} disabled={loading || preview.validRows === 0} className="min-h-11 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50">{loading ? 'Importingâ€¦' : 'Create Teacher Accounts'}</button></div>}
    </div>}
  </div>
}

