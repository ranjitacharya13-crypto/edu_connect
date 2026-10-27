import { useEffect, useState } from 'react'
import {
  ArrowRight, BarChart3, ChevronLeft, ChevronRight, Download, Eye, EyeOff, GraduationCap, LogIn,
  Plus, Search, Settings, Trash2, UserPlus, UserRound,
} from 'lucide-react'
import { useTheme } from './context/ThemeContext'
import { useToast } from './context/ToastContext'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import ContactsTable from './components/contacts/ContactsTable'
import ContactFilters from './components/contacts/ContactFilters'
import CallsSection from './components/calls/CallsSection'
import ActiveCallModal from './components/calls/ActiveCallModal'
import IconButton from './components/ui/IconButton'
import StudentUpload from './components/uploads/StudentUpload'
import { activitiesApi, adminApi, authApi, callsApi, communicationsApi, contactsApi } from './services/api'
import { MessageModal } from './components/contacts/CommunicationModal'
import StudentDetailsModal from './components/contacts/StudentDetailsModal'
import AssignmentModal from './components/contacts/AssignmentModal'
import DatabaseManagement from './components/admin/DatabaseManagement'
import { validateTeacherDateOfBirth } from './services/ageValidation'

function FloatingOrbs() {
  return <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <div className="orb orb-1" /><div className="orb orb-2" />
    <div className="orb orb-3" /><div className="orb orb-4" />
  </div>
}

function AuthPage({ onAuth }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: '', dateOfBirth: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [dateOfBirthError, setDateOfBirthError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
    if (field === 'dateOfBirth') setDateOfBirthError('')
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    if (isSignUp) {
      const dateError = validateTeacherDateOfBirth(form.dateOfBirth)
      if (dateError) { setDateOfBirthError(dateError); setLoading(false); return }
    }
    try {
      const result = isSignUp ? await authApi.signup(form) : await authApi.login(form)
      onAuth(result)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to authenticate')
    } finally {
      setLoading(false)
    }
  }

  return <main className="app-shell min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 relative">
    <FloatingOrbs />
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-blue-700 text-white shadow-2xl mb-4"><GraduationCap size={32} /></div>
        <h1 className="text-3xl font-black text-slate-950">EduStaff</h1>
        <p className="text-sm text-slate-600 font-bold mt-1">{isSignUp ? 'Create your teacher account' : 'Sign in to your workspace'}</p>
      </div>
      <div className="glass-panel rounded-3xl border shadow-glass p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-4">
          {isSignUp && <>
            <Field label="Full name" value={form.name} onChange={(v) => update('name', v)} required />
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
              <div><Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => update('dateOfBirth', v)} required max={new Date().toISOString().slice(0, 10)} error={dateOfBirthError} /><p className="mt-1 text-[10px] font-bold text-slate-500">Teacher accounts require age 18 or older.</p></div>
              <Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} required />
            </div>
          </>}
          <Field label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} required />
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)}
                minLength={6} required className="w-full h-11 rounded-xl border border-slate-300/70 bg-white/65 px-4 pr-11 outline-none text-sm font-bold" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
          <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 min-h-12 rounded-xl px-4 font-black bg-blue-700 text-white disabled:opacity-50">
            {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
            {loading ? 'Please wait…' : isSignUp ? 'Create Teacher Account' : 'Sign In'} <ArrowRight size={16} />
          </button>
        </form>
        <p className="mt-6 text-center text-xs font-bold text-slate-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError('') }} className="text-blue-700 underline">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  </main>
}

function Field({ label, value, onChange, type = 'text', required = false, max, error }) {
  return <div>
    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} max={max} aria-invalid={Boolean(error)} aria-describedby={error ? `${label.replace(/\s+/g, '-').toLowerCase()}-error` : undefined}
      className={`w-full h-11 rounded-xl border ${error ? 'border-red-500' : 'border-slate-300/70'} bg-white/65 px-4 outline-none text-sm font-bold`} />
    {error && <p id={`${label.replace(/\s+/g, '-').toLowerCase()}-error`} role="alert" className="mt-1 text-xs font-bold text-red-700">{error}</p>}
  </div>
}

function ProfilePanel({ user, onClose, onLogout }) {
  const permissionLabels = {
    canUploadStudents: 'Manual student entry',
    canEditContacts: 'Edit permitted contacts',
    canBulkUpload: 'CSV bulk upload',
    canAssignContacts: 'Assign students to teachers',
    canDeleteContacts: 'Delete student contacts',
    canManageUsers: 'Manage teacher accounts',
    canViewMetrics: 'View system metrics',
  }
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
    <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-slate-50 p-4 sm:p-6 shadow-2xl">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-black uppercase text-blue-700">Account details</p><h2 className="text-2xl font-black">{user.name}</h2></div>
        <button onClick={onClose} className="text-2xl">×</button>
      </div>
      <div className="mt-6 space-y-4">
        <Info label="Account type" value={user.role === 'admin' ? 'Super Admin' : 'Teacher'} />
        <Info label="Email" value={user.email} />
        <Info label="Phone" value={user.phone || 'Not provided'} />
        <Info label="Account created" value={new Date(user.createdAt).toLocaleDateString()} />
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs font-black uppercase text-slate-500">Permissions</p>
          <ul className="mt-3 space-y-2 text-sm font-bold">
            {Object.entries(user.permissions || {}).filter(([, enabled]) => enabled).map(([key]) =>
              <li key={key} className="flex gap-2"><span className="text-green-600">✓</span>{permissionLabels[key]}</li>)}
          </ul>
        </div>
      </div>
      <button onClick={onLogout} className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 font-black text-white">Sign out</button>
    </aside>
  </div>
}

function Info({ label, value }) {
  return <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>
}

function AdminPanel({ metrics, teachers, onDeleteTeacher }) {
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <Metric label="Registered teachers" value={metrics.teacherCount ?? '—'} />
      <Metric label="Student contacts" value={metrics.contactCount ?? '—'} />
    </div>
    <div className="glass-panel rounded-3xl border p-5">
      <h2 className="text-xl font-black">Teacher accounts</h2>
      <div className="mt-4 space-y-3">
        {teachers.map((teacher) => <div key={teacher.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-white/65 p-3">
          <div className="min-w-0"><p className="truncate font-black">{teacher.name}</p><p className="truncate text-xs text-slate-500">{teacher.email}</p></div>
          <button onClick={() => onDeleteTeacher(teacher)} title="Delete teacher" className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-600 p-2 text-white"><Trash2 size={16} /></button>
        </div>)}
        {!teachers.length && <p className="text-sm text-slate-500">No teacher accounts yet.</p>}
      </div>
    </div>
    <DatabaseManagement />
  </div>
}

function Metric({ label, value }) {
  return <div className="glass-panel rounded-3xl border p-5"><BarChart3 className="text-blue-700" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-sm font-bold text-slate-500">{label}</p></div>
}

function Placeholder({ icon: Icon, title }) {
  return <div className="py-20 text-center"><Icon className="mx-auto text-slate-400" size={42} /><h2 className="mt-3 text-2xl font-black">{title}</h2></div>
}
function Dashboard({ user, onLogout }) {
  const { theme } = useTheme()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('Contacts')
  const [contacts, setContacts] = useState([])
  const [teachers, setTeachers] = useState([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teachersError, setTeachersError] = useState('')
  const [calls, setCalls] = useState([])
  const [callSummary, setCallSummary] = useState({})
  const [callsLoading, setCallsLoading] = useState(true)
  const [metrics, setMetrics] = useState({})
  const [filters, setFilters] = useState({ search: '', admissionType: '', department: '', assignedTo: '', page: 1, pageSize: 20 })
  const [query, setQuery] = useState('')
  const [totalContacts, setTotalContacts] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactsError, setContactsError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [activeCall, setActiveCall] = useState(null)
  const [callingId, setCallingId] = useState(null)
  const [busyCallId, setBusyCallId] = useState(null)
  const [messageContact, setMessageContact] = useState(null)
  const [history, setHistory] = useState([])
  const [detailsContact, setDetailsContact] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [showAssignment, setShowAssignment] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState(false)

  const loadContacts = async (params = filters) => {
    setContactsLoading(true); setContactsError('')
    try { const data = await contactsApi.list(params); setContacts(data.contacts || []); setTotalContacts(data.total || 0); setTotalPages(data.totalPages || 1) }
    catch (error) { setContactsError(error.response?.data?.message || 'Could not load contacts'); throw error }
    finally { setContactsLoading(false) }
  }
  const loadCalls = async () => {
    const data = await callsApi.list()
    setCalls(data.calls || [])
    setCallSummary(data.summary || {})
  }
  const loadAdmin = async () => {
    if (user.role !== 'admin') return
    setTeachersLoading(true); setTeachersError('')
    try {
      const [metricData, teacherData] = await Promise.all([adminApi.metrics(), adminApi.teachers()])
      setMetrics(metricData); setTeachers(teacherData)
    } catch (error) {
      setTeachersError(error.response?.data?.message || 'Could not load teachers')
      throw error
    } finally { setTeachersLoading(false) }
  }

  useEffect(() => { loadContacts().catch(() => showToast('Could not load contacts')) }, [])
  useEffect(() => {
    loadCalls().catch(() => showToast('Could not load call history')).finally(() => setCallsLoading(false))
  }, [])
  useEffect(() => { loadAdmin().catch(() => showToast('Could not load admin data')) }, [user.role])

  const visibleContacts = contacts.filter((contact) => `${contact.student?.name || ''} ${contact.name || ''}`.toLowerCase().includes(query.toLowerCase())).map((contact) => ({ ...contact, tone: 'blue' }))

  function applyFilters(next) { const updated = { ...filters, ...next, page: 1 }; setFilters(updated); setSelectedIds(new Set()); loadContacts(updated).catch(() => showToast('Could not load contacts')) }
  function goToPage(page) { const updated = { ...filters, page }; setFilters(updated); loadContacts(updated).catch(() => showToast('Could not load contacts')) }
  function toggleSelected(id) { setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function togglePage(checked) { setSelectedIds((current) => { const next = new Set(current); visibleContacts.forEach((contact) => checked ? next.add(String(contact._id)) : next.delete(String(contact._id))); return next }) }
  function clearSelection() { setSelectedIds(new Set()) }
  async function exportContacts(ids = []) { try { const blob = await contactsApi.exportCsv({ ...filters, ...(ids.length ? { ids: ids.join(',') } : {}) }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = ids.length ? 'educonnect-selected-students.csv' : 'educonnect-filtered-students.csv'; link.click(); URL.revokeObjectURL(url); showToast('Export downloaded') } catch (error) { showToast(error.response?.data?.message || 'Could not export students') } }

  async function saveAssignment(contact, teacherId) {
    await adminApi.assignContact(contact._id, teacherId || null)
    await loadContacts()
    if (detailsContact?._id === contact._id) setDetailsContact((current) => ({ ...current, assignedTo: teachers.find((teacher) => teacher.id === teacherId) || null }))
    showToast(teacherId ? 'Student assigned' : 'Student unassigned')
  }
  async function bulkAssign(teacherId) {
    const result = await adminApi.assignContacts([...selectedIds], teacherId)
    await loadContacts()
    showToast(`${result.modified ?? result.matched} student${(result.modified ?? result.matched) === 1 ? '' : 's'} assigned`)
  }
  async function removeContact(contact) {
    if (!window.confirm(`Delete ${contact.student?.name}?`)) return
    await contactsApi.remove(contact._id); await Promise.all([loadContacts(), loadAdmin()])
  }
  async function removeTeacher(teacher) {
    if (!window.confirm(`Delete teacher ${teacher.name}?`)) return
    await adminApi.deleteTeacher(teacher.id); await Promise.all([loadContacts(), loadAdmin()])
  }

  /** Pressing Call logs the attempt straight away, then opens the dialer. */
  async function startCall(contact) {
    setCallingId(contact._id)
    try {
      const communication = await communicationsApi.startCall(contact._id)
      const call = await callsApi.start(contact._id)
      await loadCalls()
      setActiveCall(call)
      showToast(`Calling ${call.studentName || contact.name}…`)

      const number = communication.dialNumber
      if (number) window.location.href = `tel:${number}`
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not start the call')
    } finally {
      setCallingId(null)
    }
  }

  async function openStudentDetails(contact) {
    setDetailsContact(contact); setDetailsLoading(true); setDetailsError('')
    try { setHistory(await communicationsApi.history(contact._id)) } catch (error) { setDetailsError(error.response?.data?.message || 'Could not load communication history') } finally { setDetailsLoading(false) }
  }

  async function addStudentNote(summary) {
    await activitiesApi.create({ contactId: detailsContact._id, summary, type: 'note' })
    setHistory(await communicationsApi.history(detailsContact._id))
    showToast('Note saved')
  }

  async function sendMessage(message) {
    const record = await communicationsApi.sendSms(messageContact._id, message, crypto.randomUUID())
    showToast(record.status === 'queued' ? 'Message queued' : `Message ${record.status}`)
  }

  function openNativeMessage(contact) {
    const number = (contact.phone || '').replace(/[\s().-]/g, '')
    if (!/^\+?[1-9]\d{7,14}$/.test(number)) {
      showToast('A valid guardian phone number is required')
      return
    }
    try {
      // This opens a compose screen only; the user still reviews and sends it.
      // A regular web app cannot force Android to show a chooser.
      window.location.assign(`sms:${encodeURI(number)}`)
    } catch {
      showToast('No compatible messaging app could be opened')
    }
  }

  /** Record whether the student attended, missed the call, etc. */
  async function resolveCall(call, status, durationSeconds) {
    setBusyCallId(call._id)
    try {
      const updated = await callsApi.setStatus(call._id, status, { durationSeconds })
      await loadCalls()
      showToast(status === 'attended' ? 'Call marked as attended' : `Call marked as ${status.replace('-', ' ')}`)
      return updated
    } finally {
      setBusyCallId(null)
    }
  }

  /** Notes always belong to a call, so they show up in that call's history. */
  async function addCallNote(call, summary) {
    await callsApi.addNote(call._id, summary)
    await loadCalls()
    showToast('Note added to call')
  }

  async function removeCall(call) {
    if (!window.confirm(`Delete this call record for ${call.studentName || call.contactName}?`)) return
    await callsApi.remove(call._id)
    await loadCalls()
    showToast('Call record deleted')
  }

  let content
  if (activeTab === 'Contacts') content = <>
    <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row">
      <label className="flex min-w-0 w-full flex-1 items-center gap-2 rounded-2xl border bg-white/65 px-4"><Search size={18} className="shrink-0" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students…" className="h-11 min-w-0 w-full bg-transparent outline-none font-bold" /></label>
      <IconButton onClick={() => setShowUpload(true)} className="w-full shrink-0 bg-blue-700 text-white px-4 sm:w-auto"><Plus size={16} /> Add Student</IconButton>
    </div>
    <ContactFilters value={filters} teachers={teachers} isAdmin={user.role === 'admin'} total={totalContacts} onApply={applyFilters} />
    {selectedIds.size > 0 && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3"><p className="mr-auto text-sm font-black text-blue-900">{selectedIds.size} students selected</p>{user.role === 'admin' && <button onClick={() => setShowAssignment(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 text-xs font-black text-white"><UserRound size={14} /> Assign Teacher</button>}<button onClick={() => exportContacts([...selectedIds])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 text-xs font-black text-slate-700"><Download size={14} /> Export selected</button><button onClick={clearSelection} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Clear selection</button></div>}
    {contactsError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{contactsError}<button onClick={() => loadContacts().catch(() => {})} className="ml-3 underline">Retry</button></div>}
    {contactsLoading ? <div className="glass-panel rounded-3xl border p-12 text-center text-sm font-bold text-slate-500">Loading students...</div> : <ContactsTable contacts={visibleContacts} selectedIds={selectedIds} onToggle={toggleSelected} onTogglePage={togglePage} user={user} onDelete={removeContact} onCall={startCall} onMessage={setMessageContact} onStudentDetails={openStudentDetails} callingId={callingId} />}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button onClick={() => exportContacts()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 text-xs font-black text-slate-700"><Download size={14} /> Export filtered</button><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">Page {filters.page} of {totalPages}</span><button disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)} className="grid size-10 place-items-center rounded-xl border bg-white disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button><button disabled={filters.page >= totalPages} onClick={() => goToPage(filters.page + 1)} className="grid size-10 place-items-center rounded-xl border bg-white disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button></div></div>
  </>
  else if (activeTab === 'Upload') content = <StudentUpload user={user} onSuccess={() => { loadContacts(); showToast('Student added') }} />
  else if (activeTab === 'Settings' && user.role === 'admin') content = <AdminPanel metrics={metrics} teachers={teachers} onDeleteTeacher={removeTeacher} />
  else if (activeTab === 'Calls') content = <CallsSection calls={calls} summary={callSummary} user={user}
    onSetStatus={resolveCall} onAddNote={addCallNote} onDelete={removeCall} busyId={busyCallId} loading={callsLoading} />
  else content = <Placeholder icon={Settings} title={activeTab} />

  const subtitle = {
    Contacts: 'Call a student and the attempt is tracked automatically.',
    Calls: 'Every call, its outcome and the notes recorded against it.',
    Upload: 'Add students one at a time or import a CSV.',
    Settings: 'Manage teacher accounts and review system metrics.',
  }[activeTab]

  return <main data-theme={theme} className="app-shell min-h-[100dvh] min-w-0 overflow-x-hidden text-slate-900 relative">
    <FloatingOrbs />
    <Header activeTab={activeTab} onTabChange={setActiveTab} user={user} onProfile={() => setShowProfile(true)} />
    <section className="page-content mx-auto min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
      <p className="text-xs font-black uppercase text-blue-700">{activeTab}</p>
      <h1 className="text-3xl font-black">{activeTab === 'Settings' && user.role === 'admin' ? 'Administration' : activeTab}</h1>
      {subtitle && <p className="mb-6 mt-1 text-sm font-bold text-slate-500">{subtitle}</p>}
      {content}
    </section>
    <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    {showUpload && <div className="fixed inset-0 z-40 overflow-y-auto bg-black/50 p-2 sm:p-4"><StudentUpload user={user} onCancel={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); loadContacts(); loadAdmin() }} /></div>}
    {showProfile && <ProfilePanel user={user} onClose={() => setShowProfile(false)} onLogout={onLogout} />}
    {activeCall && <ActiveCallModal
      call={activeCall}
      onResolve={resolveCall}
      onAddNote={addCallNote}
      onClose={() => setActiveCall(null)}
      onViewHistory={() => { setActiveCall(null); setActiveTab('Calls') }}
    />}
    {messageContact && <MessageModal contact={messageContact} onSend={sendMessage} onNativeMessage={openNativeMessage} onClose={() => setMessageContact(null)} />}
    {detailsContact && <StudentDetailsModal contact={detailsContact} records={history} loading={detailsLoading} error={detailsError} onRetry={() => openStudentDetails(detailsContact)} onAddNote={addStudentNote} teachers={teachers} teachersLoading={teachersLoading} teachersError={teachersError} onRetryTeachers={() => loadAdmin().catch(() => {})} canAssign={user.role === 'admin'} assignmentSaving={assignmentSaving} onAssign={async (teacherId) => { setAssignmentSaving(true); try { await saveAssignment(detailsContact, teacherId) } finally { setAssignmentSaving(false) } }} onClose={() => setDetailsContact(null)} />}
    {showAssignment && <AssignmentModal count={selectedIds.size} teachers={teachers} onConfirm={bulkAssign} onClose={() => setShowAssignment(false)} />}
  </main>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem('edustaff_token')))

  useEffect(() => {
    if (!checking) return
    authApi.me().then(setUser).catch(() => { localStorage.removeItem('edustaff_token'); setUser(null) }).finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem('edustaff_token')
      setUser(null)
      setChecking(false)
    }
    window.addEventListener('edustaff:session-expired', handleSessionExpired)
    return () => window.removeEventListener('edustaff:session-expired', handleSessionExpired)
  }, [])

  function authenticated({ token, user: account }) {
    localStorage.setItem('edustaff_token', token)
    setUser(account)
  }
  async function logout() {
    try { await authApi.logout() } catch { /* local logout still succeeds */ }
    localStorage.removeItem('edustaff_token'); setUser(null)
  }

  if (checking) return <div className="app-shell min-h-screen grid place-items-center font-black">Loading account…</div>
  return user ? <Dashboard user={user} onLogout={logout} /> : <AuthPage onAuth={authenticated} />
}
