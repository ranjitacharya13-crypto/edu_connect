import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Clock3, MessageSquareText, Phone, Send, X } from 'lucide-react'

const labels = { queued: 'Queued', accepted: 'Accepted by provider', sent: 'Sent', delivered: 'Delivered', failed: 'Failed', undelivered: 'Undelivered', unknown: 'Unknown' }
const outcomes = ['connected', 'no_answer', 'busy', 'failed', 'unknown']

export function MessageModal({ contact, onSend, onNativeMessage, onClose }) {
  const [message, setMessage] = useState(`Hello, this is EduStaff regarding ${contact.student?.name || 'your student'}.`)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const titleRef = useRef(null)
  const consentGranted = contact.smsConsent?.status === 'granted'
  const hasPhone = Boolean(contact.phone?.trim())
  const blockedReason = !consentGranted ? 'SMS consent has not been granted for this contact.' : !hasPhone ? 'A valid guardian phone number is required.' : ''

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    titleRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape' && !sending) onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), textarea:not([disabled])')]
      if (!focusable.length) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [onClose, sending])

  async function submit(event) {
    event.preventDefault()
    if (!consentGranted || !hasPhone || sending || !message.trim()) return
    setSending(true); setError('')
    try { await onSend(message); onClose() } catch (requestError) { setError(requestError.response?.data?.message || 'Could not send message') } finally { setSending(false) }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) onClose() }}>
    <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="message-modal-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border bg-slate-50 shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
      <div className="shrink-0 p-4 pb-2 sm:p-5 sm:pb-3"><ModalHeader titleId="message-modal-title" titleRef={titleRef} icon={MessageSquareText} title="Message guardian" subtitle={`${contact.student?.name || contact.name} · ${contact.phone || 'No phone on file'}`} onClose={onClose} /></div>
      <div className="min-h-0 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
        <label htmlFor="guardian-message" className="block text-xs font-black uppercase tracking-wide text-slate-600">Message</label>
        <textarea id="guardian-message" spellCheck="false" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1600} rows={3} aria-describedby="message-count message-consent" className="mt-1.5 max-h-32 min-h-20 w-full resize-y overflow-y-auto rounded-2xl border border-slate-300/70 bg-white px-4 py-2.5 text-sm font-bold leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:min-h-24" />
        <p id="message-count" className="mt-0.5 text-right text-[11px] font-bold text-slate-400">{message.length}/1600</p>
        <p id="message-consent" role={blockedReason ? 'alert' : undefined} className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-bold leading-4 ${blockedReason ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{blockedReason || 'Consent recorded. Review the message before sending.'}</span></p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        <button type="submit" disabled={sending || !message.trim() || Boolean(blockedReason)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-black text-white shadow-lg shadow-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"><Send size={16} />{sending ? 'Sending...' : 'Send message'}</button>
        <button type="button" disabled={!hasPhone || sending} onClick={() => onNativeMessage(contact)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Open in phone's Messages app</button>
        <p className="mt-1 text-center text-[11px] font-bold leading-4 text-slate-400">{hasPhone ? 'Opens a messaging app for you to review and send manually.' : 'A valid guardian phone number is required.'}</p>
        <p className="mt-2 text-center text-[11px] font-bold leading-4 text-slate-400">Provider delivery is shown only after confirmation from the messaging provider.</p>
      </div>
    </form>
  </div>
}

export function HistoryModal({ contact, records, onOutcome, onClose }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-3 sm:p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border bg-slate-50 p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-5">
      <ModalHeader icon={Clock3} title="Contact history" subtitle={contact.student?.name || contact.name} onClose={onClose} />
      <div className="mt-4 space-y-3">{!records.length && <p className="rounded-2xl border bg-white p-5 text-center text-sm font-bold text-slate-500">No communication history yet.</p>}{records.map((record) => <div key={record._id} className="rounded-2xl border bg-white p-4"><div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">{record.type === 'sms' ? <MessageSquareText size={16} /> : <Phone size={16} />}</div><div className="min-w-0 flex-1"><p className="font-black">{record.type === 'sms' ? 'SMS' : 'Call'} <span className="text-xs font-bold text-slate-500">· {new Date(record.createdAt).toLocaleString()}</span></p><p className="mt-1 text-xs font-bold text-slate-600">{record.type === 'sms' ? (labels[record.status] || record.status) : `Outcome: ${record.outcome || 'Unknown'}`}</p>{record.failureDescription && <p className="mt-1 text-xs font-bold text-red-600">{record.failureDescription}</p>}</div></div>{record.type === 'call' && record.outcome === 'initiated' && <div className="mt-3 flex flex-wrap gap-2">{outcomes.map((outcome) => <button key={outcome} onClick={() => onOutcome(record._id, outcome)} className="rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-black text-slate-700 hover:bg-blue-100">{outcome.replace('_', ' ')}</button>)}</div>}</div>)}</div>
    </div>
  </div>
}

function ModalHeader({ icon: Icon, title, titleId, titleRef, subtitle, onClose }) {
  return <div className="flex min-w-0 items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700"><Icon size={20} /></div><div className="min-w-0"><h2 id={titleId} ref={titleRef} tabIndex={-1} className="truncate text-xl font-black outline-none">{title}</h2><p className="truncate text-xs font-bold text-slate-500" title={subtitle}>{subtitle}</p></div></div><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"><X size={19} /></button></div>
}
