import { useEffect, useRef } from 'react'
import { MessageSquareText, PhoneCall, Trash2, UserRound } from 'lucide-react'
import { toneClasses } from '../../services/data'

const YEAR_LABELS = { '1': 'First Year', '2': 'Second Year', '3': 'Third Year' }

export default function ContactsTable({ contacts, selectedIds, onToggle, onTogglePage, onCall, onMessage, onStudentDetails, user, onDelete, callingId }) {
  const headerRef = useRef(null)
  const ids = contacts.map((contact) => String(contact._id))
  const selectedOnPage = ids.filter((id) => selectedIds.has(id)).length
  const allSelected = ids.length > 0 && selectedOnPage === ids.length
  useEffect(() => { if (headerRef.current) headerRef.current.indeterminate = selectedOnPage > 0 && !allSelected }, [selectedOnPage, allSelected])
  return <div className="glass-panel min-w-0 overflow-hidden rounded-2xl border shadow-glass sm:rounded-3xl">
    <div className="overflow-x-auto"><table className="w-full min-w-[31rem] text-xs sm:min-w-0 sm:text-sm">
      <thead className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50 to-slate-100"><tr>
        <th className="w-11 px-2 py-3 sm:px-4"><input ref={headerRef} type="checkbox" checked={allSelected} onChange={(event) => onTogglePage(event.target.checked)} aria-label="Select all students on this page" className="size-4 accent-blue-700" /></th>
        <th className="px-2 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 sm:text-xs">Student</th>
        <th className="hidden px-2 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 sm:text-xs md:table-cell">Phone</th>
        <th className="px-2 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 sm:text-xs">Actions</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-200/70">{contacts.map((contact) => {
        const id = String(contact._id); const name = contact.student?.name || contact.student || contact.name || '—'; const selected = selectedIds.has(id)
        return <tr key={id} className={`${selected ? 'bg-blue-50/80' : 'bg-white/45'} transition hover:bg-white/60`}>
          <td className="px-2 py-3 text-center sm:px-4 sm:py-4"><input type="checkbox" checked={selected} onChange={() => onToggle(id)} aria-label={`Select ${name}`} className="size-4 accent-blue-700" /></td>
          <td className="px-2 py-3 sm:px-4 sm:py-4"><button type="button" onClick={() => onStudentDetails(contact)} className="flex min-w-0 items-center gap-2 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500" title="Open student details"><div className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-10 sm:rounded-xl ${toneClasses[contact.tone]}`}><UserRound size={16} /></div><div className="min-w-0"><p className="break-words text-xs font-black text-slate-950 sm:text-sm">{name}</p>{(contact.student?.admissionType || contact.student?.grade || contact.student?.department) && <p className="truncate text-[10px] font-bold text-slate-500 sm:text-xs">{contact.student.admissionType || YEAR_LABELS[contact.student.grade] || contact.student.grade}{contact.student.department ? ` · ${contact.student.department}` : ''}</p>}</div></button></td>
          <td className="hidden px-2 py-3 sm:px-4 sm:py-4 md:table-cell"><p className="text-xs font-bold text-slate-950 sm:text-sm">{contact.phone || '—'}</p></td>
          <td className="px-2 py-3 sm:px-4 sm:py-4"><div className="flex flex-nowrap gap-1.5 sm:gap-2"><button onClick={() => onCall(contact)} disabled={callingId === contact._id} aria-label="Call parent or guardian" title="Call parent or guardian" className="grid size-10 place-items-center rounded-lg bg-blue-600/90 text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"><PhoneCall size={14} /></button><button onClick={() => onMessage(contact)} aria-label="Message parent or guardian" title="Message parent or guardian" className="grid size-10 place-items-center rounded-lg bg-emerald-600/90 text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"><MessageSquareText size={14} /></button>{user?.role === 'admin' && <button onClick={() => onDelete(contact)} aria-label={`Delete ${name}`} title="Delete contact" className="grid size-10 place-items-center rounded-lg bg-red-600/80 text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"><Trash2 size={14} /></button>}</div></td>
        </tr>
      })}</tbody>
    </table></div>
    {!contacts.length && <p className="px-4 py-12 text-center text-sm font-bold text-slate-500">No students match these filters.</p>}
  </div>
}
