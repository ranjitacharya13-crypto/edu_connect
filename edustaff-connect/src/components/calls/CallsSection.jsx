import { useMemo, useState } from 'react'
import {
  ChevronDown, Clock3, MessageSquareText, PhoneCall, PhoneMissed, PhoneOff,
  PhoneOutgoing, Send, Trash2, TrendingUp, UserRound,
} from 'lucide-react'
import { callOutcomeOptions, callStatusMeta, formatDuration, relativeTime } from '../../services/data'

const statusPill = {
  ringing: 'border-blue-500/40 bg-blue-500/10 text-blue-700',
  attended: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  missed: 'border-red-500/40 bg-red-500/10 text-red-700',
  'no-answer': 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  busy: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  'wrong-number': 'border-violet-500/40 bg-violet-500/10 text-violet-700',
  cancelled: 'border-slate-400/40 bg-slate-400/10 text-slate-600',
}

const outcomeButton = {
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
  red: 'bg-red-600 text-white hover:bg-red-700',
  amber: 'bg-amber-600 text-white hover:bg-amber-700',
  slate: 'bg-slate-600 text-white hover:bg-slate-700',
}

const statusIcons = { PhoneCall, PhoneMissed, PhoneOff, PhoneOutgoing }

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ringing', label: 'In progress' },
  { key: 'attended', label: 'Attended' },
  { key: 'unanswered', label: 'Unanswered' },
]

function StatusBadge({ status }) {
  const meta = callStatusMeta[status] || callStatusMeta.cancelled
  const Icon = statusIcons[meta.icon] || PhoneCall
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusPill[status] || statusPill.cancelled}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  )
}

function SummaryCard({ icon: Icon, value, label, accent }) {
  return (
    <article className="glass-panel rounded-2xl border p-4 shadow-glass">
      <Icon size={22} className={accent} />
      <strong className="mt-2 block text-2xl font-black text-slate-950">{value}</strong>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </article>
  )
}

/** One row of the call history, with its notes folded underneath. */
function CallCard({ call, user, onSetStatus, onAddNote, onDelete, busyId }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const notes = call.notes || []
  const isRinging = call.status === 'ringing'
  const busy = busyId === call._id

  async function submitNote(event) {
    event.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      await onAddNote(call, note.trim())
      setNote('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={`glass-panel overflow-hidden rounded-2xl border shadow-glass transition ${isRinging ? 'ring-2 ring-blue-500/40' : ''}`}>
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${isRinging ? 'bg-blue-600/15 text-blue-700' : 'bg-slate-500/10 text-slate-600'}`}>
          <UserRound size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-black text-slate-950">{call.studentName || call.contactName || 'Student'}</p>
            <StatusBadge status={call.status} />
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {call.grade ? `${call.grade} · ` : ''}{call.phone || 'No phone'} · {relativeTime(call.startedAt || call.createdAt)}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            By {call.createdBy}{call.durationSeconds ? ` · ${formatDuration(call.durationSeconds)}` : ''}
          </p>
        </div>

        {/* Notes live with the call, so the toggle sits on the history row. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(!open)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${
              open ? 'bg-blue-700 text-white' : 'bg-blue-600/10 text-blue-700 hover:bg-blue-600/20'
            }`}
            title="Notes for this call"
          >
            <MessageSquareText size={14} />
            Notes{notes.length ? ` (${notes.length})` : ''}
            <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => onDelete(call)}
              className="grid size-9 place-items-center rounded-lg bg-red-600/80 text-white transition hover:bg-red-700"
              title="Delete call record"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* While a call is live the teacher records what happened. */}
      {isRinging && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/60 bg-blue-500/5 px-4 py-3">
          <span className="text-xs font-black uppercase tracking-wide text-blue-700">Did they answer?</span>
          {callOutcomeOptions.map((option) => (
            <button
              key={option.status}
              disabled={busy}
              onClick={() => onSetStatus(call, option.status)}
              className={`min-h-9 rounded-lg px-3 text-xs font-black shadow-sm transition disabled:opacity-50 ${outcomeButton[option.tone]}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="border-t border-slate-200/60 bg-white/40 px-4 py-4">
          <form onSubmit={submitNote} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a note about this call…"
              className="h-11 flex-1 rounded-xl border border-slate-300/70 bg-white/70 px-4 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              disabled={saving || !note.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Send size={15} />
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {notes.map((entry) => (
              <div key={entry._id} className="rounded-xl border border-slate-200/60 bg-white/60 p-3">
                <p className="whitespace-pre-wrap text-sm font-bold text-slate-700">{entry.summary}</p>
                <p className="mt-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  {entry.createdBy} · {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {!notes.length && (
              <p className="py-2 text-center text-xs font-bold text-slate-400">
                No notes on this call yet.
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

export default function CallsSection({ calls, summary, user, onSetStatus, onAddNote, onDelete, busyId, loading }) {
  const [filter, setFilter] = useState('all')

  const visible = useMemo(() => {
    if (filter === 'all') return calls
    if (filter === 'unanswered') {
      return calls.filter((call) => ['missed', 'no-answer', 'busy', 'wrong-number'].includes(call.status))
    }
    return calls.filter((call) => call.status === filter)
  }, [calls, filter])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={PhoneOutgoing} value={summary.total ?? 0} label="Total calls" accent="text-blue-700" />
        <SummaryCard icon={PhoneCall} value={summary.attended ?? 0} label="Attended" accent="text-emerald-600" />
        <SummaryCard icon={PhoneMissed} value={summary.unanswered ?? 0} label="Unanswered" accent="text-red-600" />
        <SummaryCard icon={TrendingUp} value={`${summary.attendRate ?? 0}%`} label="Attend rate" accent="text-violet-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            onClick={() => setFilter(option.key)}
            className={`min-h-9 rounded-xl px-3.5 text-xs font-black transition ${
              filter === option.key
                ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20'
                : 'glass-panel border text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <Clock3 size={14} />
          {formatDuration(summary.talkTimeSeconds ?? 0)} talk time
        </span>
      </div>

      <div className="space-y-3">
        {visible.map((call) => (
          <CallCard
            key={call._id}
            call={call}
            user={user}
            onSetStatus={onSetStatus}
            onAddNote={onAddNote}
            onDelete={onDelete}
            busyId={busyId}
          />
        ))}

        {!visible.length && (
          <div className="glass-panel rounded-2xl border py-16 text-center shadow-glass">
            <PhoneCall className="mx-auto text-slate-400" size={40} />
            <h2 className="mt-3 text-xl font-black text-slate-900">
              {loading ? 'Loading calls…' : filter === 'all' ? 'No calls yet' : 'Nothing in this filter'}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {filter === 'all'
                ? 'Press the call button on a contact and it will be tracked here.'
                : 'Try a different filter to see more history.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
