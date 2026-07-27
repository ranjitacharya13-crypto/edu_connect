import { useEffect, useState } from 'react'
import { MessageSquareText, PhoneCall, Send, UserRound, X } from 'lucide-react'
import { callOutcomeOptions, formatDuration } from '../../services/data'

const outcomeButton = {
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
  red: 'bg-red-600 text-white hover:bg-red-700',
  amber: 'bg-amber-600 text-white hover:bg-amber-700',
  slate: 'bg-slate-600 text-white hover:bg-slate-700',
}

/**
 * Shown the moment a call starts. The teacher comes back from the dialer and
 * marks the outcome here; the result is what the Calls section displays.
 */
export default function ActiveCallModal({ call, onResolve, onAddNote, onClose, onViewHistory }) {
  const [elapsed, setElapsed] = useState(0)
  const [resolved, setResolved] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Live timer while the call is still open.
  useEffect(() => {
    if (resolved) return undefined
    const started = new Date(call.startedAt || Date.now()).getTime()
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - started) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [call.startedAt, resolved])

  async function resolve(status) {
    setError('')
    try {
      const updated = await onResolve(call, status, elapsed)
      setResolved(updated || { ...call, status, durationSeconds: elapsed })
    } catch (resolveError) {
      setError(resolveError.response?.data?.message || 'Could not update the call')
    }
  }

  async function submitNote(event) {
    event.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    setError('')
    try {
      await onAddNote(call, note.trim())
      setNote('')
      onClose()
    } catch (noteError) {
      setError(noteError.response?.data?.message || 'Could not save the note')
    } finally {
      setSaving(false)
    }
  }

  const student = call.studentName || call.contactName || 'Student'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl border bg-slate-50 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`grid size-12 place-items-center rounded-2xl ${resolved ? 'bg-emerald-600/15 text-emerald-700' : 'animate-pulse bg-blue-600/15 text-blue-700'}`}>
              <PhoneCall size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-blue-700">
                {resolved ? 'Call logged' : 'Call in progress'}
              </p>
              <h2 className="text-xl font-black text-slate-950">{student}</h2>
              <p className="text-xs font-bold text-slate-500">{call.phone || 'No phone on file'}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {!resolved ? (
          <>
            <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-center">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ringing for</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{formatDuration(elapsed)}</p>
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-wide text-slate-600">
              Mark what happened
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {callOutcomeOptions.map((option) => (
                <button
                  key={option.status}
                  onClick={() => resolve(option.status)}
                  className={`min-h-11 rounded-xl px-4 text-sm font-black shadow-lg transition ${outcomeButton[option.tone]}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] font-bold text-slate-400">
              This call is already saved in the Calls section.
            </p>
          </>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-sm font-black text-emerald-700">
                Marked as {resolved.status === 'no-answer' ? 'no answer' : resolved.status} · {formatDuration(resolved.durationSeconds || elapsed)}
              </p>
            </div>

            <form onSubmit={submitNote} className="mt-5">
              <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-600">
                <MessageSquareText size={14} /> Add a note to this call
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                autoFocus
                placeholder="What was discussed, follow-ups, reminders…"
                className="mt-2 w-full resize-none rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={onViewHistory} className="rounded-xl border border-slate-300/70 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">
                  View call history
                </button>
                <button
                  disabled={saving || !note.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 disabled:opacity-50"
                >
                  <Send size={15} />
                  {saving ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </form>
          </>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        {!resolved && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400">
            <UserRound size={12} /> {call.grade || 'Student contact'}
          </p>
        )}
      </div>
    </div>
  )
}
