import { useState } from 'react'
import { UserRound, X } from 'lucide-react'

export default function AssignmentModal({ count, teachers, onConfirm, onClose }) {
  const [teacherId, setTeacherId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (!teacherId) { setError('Select a teacher to continue'); return }
    setSaving(true); setError('')
    try { await onConfirm(teacherId); onClose() } catch (requestError) { setError(requestError.response?.data?.message || 'Could not assign teacher') } finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <form role="dialog" aria-modal="true" aria-labelledby="assign-teacher-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl border bg-slate-50 p-4 shadow-2xl sm:p-5">
      <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-blue-100 text-blue-700"><UserRound size={20} /></div><div><h2 id="assign-teacher-title" className="text-xl font-black">Assign Teacher</h2><p className="text-xs font-bold text-slate-500">{count} student{count === 1 ? '' : 's'} selected</p></div></div><button type="button" onClick={onClose} aria-label="Close assignment dialog" className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-200"><X size={18} /></button></div>
      <label className="mt-5 block text-xs font-black uppercase tracking-wide text-slate-600">Teacher</label>
      <select autoFocus value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300/70 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500"><option value="">Select a teacher...</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select>
      <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">This assignment will update {count} selected student{count === 1 ? '' : 's'}.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-black text-slate-600">Cancel</button><button disabled={saving || !teacherId} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Assigning...' : 'Confirm Assignment'}</button></div>
    </form>
  </div>
}
