import { useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw, X } from 'lucide-react'

const TYPES = [['text', 'Short text'], ['long_text', 'Long text'], ['number', 'Number'], ['email', 'Email'], ['phone', 'Phone'], ['date', 'Date'], ['select', 'Dropdown'], ['multi_select', 'Multi-select'], ['boolean', 'Checkbox'], ['url', 'URL']]
const blank = { key: '', label: '', type: 'text', required: false, options: '', formVisible: true, tableVisible: true, filterable: true, state: 'active' }

export default function CustomFieldManager({ fields, onSave, onClose }) {
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSaving, setActionSaving] = useState('')
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const open = (field = null) => { setEditing(field); setFormOpen(true); setForm(field ? { ...field, options: (field.options || []).map((option) => option.value).join(', ') } : blank); setError(''); setActionError('') }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const options = ['select', 'multi_select'].includes(form.type) ? form.options.split(',').map((value) => ({ value: value.trim(), label: value.trim() })).filter((option) => option.value) : []
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(form.key)) throw new Error('Field ID must start with a lowercase letter and contain only lowercase letters, numbers, or underscores')
      if (['select', 'multi_select'].includes(form.type) && new Set(options.map((option) => option.value.toLowerCase())).size !== options.length) throw new Error('Dropdown options must be unique')
      await onSave(editing?._id, { ...form, options })
      setEditing(null); setFormOpen(false)
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not save field') } finally { setSaving(false) }
  }
  async function changeState(field, state) {
    setActionSaving(field._id); setActionError('')
    try { await onSave(field._id, { state }) }
    catch (requestError) { setActionError(requestError.response?.data?.message || requestError.message || 'Could not update field') }
    finally { setActionSaving('') }
  }
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-slate-50 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="custom-fields-title">
      <div className="flex items-center justify-between border-b p-4"><div><h2 id="custom-fields-title" className="text-xl font-black">Student columns</h2><p className="text-xs font-bold text-slate-500">Manage reusable student fields</p></div><button onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="min-h-0 overflow-y-auto p-4"><button onClick={() => open()} className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 text-xs font-black text-white"><Plus size={15} /> Add Column</button>{actionSaving && <p role="status" aria-live="polite" className="mb-3 text-xs font-bold text-blue-700">Saving field changes…</p>}{actionError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{actionError}</p>}<div className="space-y-2">{fields.map((field) => <div key={field._id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><div className="min-w-0 flex-1"><p className="font-black">{field.label}</p><p className="break-all text-xs font-bold text-slate-500">{field.key} · {field.type} · {field.state}</p></div><button onClick={() => open(field)} className="grid size-9 shrink-0 place-items-center rounded-lg border" aria-label={`Edit ${field.label}`}><Pencil size={14} /></button>{field.state === 'archived' ? <button disabled={actionSaving === field._id} onClick={() => changeState(field, 'active')} className="grid size-9 shrink-0 place-items-center rounded-lg border text-green-700 disabled:opacity-50" aria-label={`Restore ${field.label}`} aria-busy={actionSaving === field._id}><RotateCcw size={14} className={actionSaving === field._id ? 'animate-spin' : ''} /></button> : <button disabled={actionSaving === field._id} onClick={() => changeState(field, 'archived')} className="grid size-9 shrink-0 place-items-center rounded-lg border text-red-700 disabled:opacity-50" aria-label={`Archive ${field.label}`} aria-busy={actionSaving === field._id}><Archive size={14} className={actionSaving === field._id ? 'animate-pulse' : ''} /></button>}</div>)}</div></div>
      {formOpen && <form onSubmit={submit} className="space-y-3 border-t bg-white p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black">Label<input required maxLength={120} value={form.label} onChange={(e) => update('label', e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" /></label><label className="text-xs font-black">Field ID<input required disabled={Boolean(editing)} pattern="[a-z][a-z0-9_]{0,63}" title="Use lowercase letters, numbers, and underscores; start with a letter." value={form.key} onChange={(e) => update('key', e.target.value.toLowerCase())} placeholder="class_section" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm disabled:bg-slate-100" /></label></div><label className="block text-xs font-black">Type<select value={form.type} onChange={(e) => update('type', e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm">{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{['select', 'multi_select'].includes(form.type) && <label className="block text-xs font-black">Options (comma separated)<input required value={form.options} onChange={(e) => update('options', e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" placeholder="A, B, C" /></label>}<div className="flex flex-wrap gap-3 text-xs font-bold"><label><input type="checkbox" checked={form.required} onChange={(e) => update('required', e.target.checked)} /> Required</label><label><input type="checkbox" checked={form.formVisible} onChange={(e) => update('formVisible', e.target.checked)} /> Show in forms</label><label><input type="checkbox" checked={form.tableVisible} onChange={(e) => update('tableVisible', e.target.checked)} /> Show in table</label><label><input type="checkbox" checked={form.filterable} onChange={(e) => update('filterable', e.target.checked)} /> Filterable</label></div>{error && <p role="alert" className="text-xs font-bold text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-3 py-2 text-xs font-black">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white">{saving ? 'Saving…' : 'Save column'}</button></div></form>}
    </div>
  </div>
}
