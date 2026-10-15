import { Filter, RotateCcw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

const initial = { search: '', admissionType: '', department: '', assignedTo: '' }
const departments = ['CSE', 'Civil', 'AI/ML', 'Mech', 'ECE', 'EEE', 'Automobile']

export default function ContactFilters({ value = initial, teachers = [], isAdmin, total, onApply }) {
  const [draft, setDraft] = useState({ ...initial, ...value })
  const departmentOptions = draft.admissionType === 'Part Time' ? ['EEE', 'Mech'] : departments
  useEffect(() => setDraft({ ...initial, ...value }), [value])
  const update = (key, next) => setDraft((current) => ({ ...current, [key]: next }))
  function apply(event) { event.preventDefault(); onApply({ ...draft, page: 1 }) }
  function clear() { setDraft(initial); onApply({ ...initial, page: 1 }) }
  function updateAdmissionType(next) {
    setDraft((current) => ({ ...current, admissionType: next, department: next === 'Part Time' && !['', 'EEE', 'Mech'].includes(current.department) ? '' : current.department }))
  }
  return <form onSubmit={apply} className="glass-panel mb-4 rounded-2xl border p-3 shadow-glass sm:p-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter size={17} className="text-blue-700" /><p className="text-sm font-black">Filter students</p><span className="text-xs font-bold text-slate-500">{total} matching</span></div><button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-black text-slate-600 hover:bg-white/70"><RotateCcw size={13} /> Clear</button></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-300/70 bg-white/65 px-3 sm:col-span-2 lg:col-span-2"><Search size={15} className="shrink-0 text-slate-500" /><input value={draft.search} onChange={(event) => update('search', event.target.value)} placeholder="Search student name..." className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" /></label>
      <Select label="Admission type" value={draft.admissionType} onChange={updateAdmissionType} options={['Regular', 'Lateral Entry', 'Part Time'].map((item) => [item, item])} />
      <Select label="Department" value={draft.department} onChange={(value) => update('department', value)} options={departmentOptions.map((item) => [item, item])} />
      {isAdmin && <Select label="Assigned teacher" value={draft.assignedTo} onChange={(value) => update('assignedTo', value)} options={teachers.map((teacher) => [teacher.id, teacher.name])} />}
    </div>
    <button className="mt-3 min-h-10 rounded-xl bg-blue-700 px-4 text-xs font-black text-white shadow-md hover:bg-blue-800">Apply filters</button>
  </form>
}

function Select({ label, value, onChange, options }) { return <label className="flex min-w-0 flex-col gap-1"><span className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-xl border border-slate-300/70 bg-white/65 px-3 text-xs font-bold outline-none focus:border-blue-500"><option value="">All</option>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label> }
