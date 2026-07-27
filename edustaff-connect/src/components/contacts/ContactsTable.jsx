import { PhoneCall, Trash2, UserRound } from 'lucide-react'
import { toneClasses } from '../../services/data'

export default function ContactsTable({ contacts, onCall, user, teachers = [], onAssign, onDelete, callingId }) {
  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl border shadow-glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/70">
            <tr>
              <th className="px-2 sm:px-4 py-3 sm:py-4 text-left font-black text-slate-700 uppercase tracking-wider text-[10px] sm:text-xs">Student</th>
              <th className="px-2 sm:px-4 py-3 sm:py-4 text-left font-black text-slate-700 uppercase tracking-wider text-[10px] sm:text-xs hidden md:table-cell">Phone</th>
              {user?.role === 'admin' && <th className="px-2 sm:px-4 py-3 sm:py-4 text-left font-black text-slate-700 uppercase tracking-wider text-[10px] sm:text-xs">Assigned teacher</th>}
              <th className="px-2 sm:px-4 py-3 sm:py-4 text-left font-black text-slate-700 uppercase tracking-wider text-[10px] sm:text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {contacts.map((contact) => (
              <tr key={contact._id || contact.name} className="hover:bg-white/60 transition bg-white/45">
                <td className="px-2 sm:px-4 py-3 sm:py-4">
                  <div className="flex items-center gap-2">
                    <div className={`grid size-8 sm:size-10 shrink-0 place-items-center rounded-lg sm:rounded-xl ${toneClasses[contact.tone]}`}>
                      <UserRound size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-950 truncate text-xs sm:text-sm">{contact.student?.name || contact.student || contact.name || '—'}</p>
                      {contact.student?.grade && <p className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">{contact.student.grade}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-2 sm:px-4 py-3 sm:py-4 hidden md:table-cell">
                  <p className="font-bold text-slate-950 text-xs sm:text-sm">{contact.phone || contact.guardianContact || '—'}</p>
                </td>
                {user?.role === 'admin' && <td className="px-2 sm:px-4 py-3 sm:py-4">
                  <select
                    value={contact.assignedTo?._id || contact.assignedTo || ''}
                    onChange={(event) => onAssign(contact, event.target.value)}
                    className="max-w-44 rounded-lg border border-slate-300/70 bg-white/65 px-2 py-2 text-xs font-bold"
                  >
                    <option value="">Unassigned</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                  </select>
                </td>}
                <td className="px-2 sm:px-4 py-3 sm:py-4">
                  <div className="flex gap-1 sm:gap-2 flex-wrap">
                    {/* Starting a call logs it to the Calls section, where notes are kept. */}
                    <button
                      onClick={() => onCall(contact)}
                      disabled={callingId === contact._id}
                      className="inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-lg bg-blue-600/90 px-2.5 sm:px-3 text-white hover:bg-blue-700 transition shadow-md disabled:opacity-60"
                      title="Call and track"
                    >
                      <PhoneCall size={14} />
                      <span className="text-[11px] sm:text-xs font-black">
                        {callingId === contact._id ? 'Calling…' : 'Call'}
                      </span>
                    </button>
                    {user?.role === 'admin' && <button
                      onClick={() => onDelete(contact)}
                      className="grid size-8 sm:size-9 place-items-center rounded-lg bg-red-600/80 text-white hover:bg-red-700 transition shadow-md"
                      title="Delete contact"
                    >
                      <Trash2 size={14} />
                    </button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!contacts.length && (
        <p className="px-4 py-12 text-center text-sm font-bold text-slate-500">No students match this search.</p>
      )}
    </div>
  )
}
