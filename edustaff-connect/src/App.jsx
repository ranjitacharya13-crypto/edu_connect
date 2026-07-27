import { useEffect, useState } from 'react'
import {
  ArrowRight, BarChart3, Eye, EyeOff, GraduationCap, LogIn,
  MessageSquareText, PhoneCall, Plus, Search, Settings, Trash2, UserPlus, X,
} from 'lucide-react'
import { useTheme } from './context/ThemeContext'
import { useToast } from './context/ToastContext'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import ContactsTable from './components/contacts/ContactsTable'
import IconButton from './components/ui/IconButton'
import StudentUpload from './components/uploads/StudentUpload'
import { activitiesApi, adminApi, authApi, contactsApi } from './services/api'

function FloatingOrbs() {
  return <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <div className="orb orb-1" /><div className="orb orb-2" />
    <div className="orb orb-3" /><div className="orb orb-4" />
  </div>
}

function AuthPage({ onAuth }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: '', age: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = isSignUp ? await authApi.signup(form) : await authApi.login(form)
      onAuth(result)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to authenticate')
    } finally {
      setLoading(false)
    }
  }

  return <main className="app-shell min-h-screen flex items-center justify-center p-4 relative">
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" type="number" value={form.age} onChange={(v) => update('age', v)} />
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

function Field({ label, value, onChange, type = 'text', required = false }) {
  return <div>
    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
      className="w-full h-11 rounded-xl border border-slate-300/70 bg-white/65 px-4 outline-none text-sm font-bold" />
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
    <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-slate-50 p-6 shadow-2xl">
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
        {teachers.map((teacher) => <div key={teacher.id} className="flex items-center justify-between rounded-xl border bg-white/65 p-3">
          <div><p className="font-black">{teacher.name}</p><p className="text-xs text-slate-500">{teacher.email}</p></div>
          <button onClick={() => onDeleteTeacher(teacher)} title="Delete teacher" className="rounded-lg bg-red-600 p-2 text-white"><Trash2 size={16} /></button>
        </div>)}
        {!teachers.length && <p className="text-sm text-slate-500">No teacher accounts yet.</p>}
      </div>
    </div>
  </div>
}

function Metric({ label, value }) {
  return <div className="glass-panel rounded-3xl border p-5"><BarChart3 className="text-blue-700" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-sm font-bold text-slate-500">{label}</p></div>
}

function Placeholder({ icon: Icon, title }) {
  return <div className="py-20 text-center"><Icon className="mx-auto text-slate-400" size={42} /><h2 className="mt-3 text-2xl font-black">{title}</h2></div>
}

function NoteModal({ contact, onClose, onSave }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const studentName = contact?.student?.name || contact?.name || 'student'

  async function submit(event) {
    event.preventDefault()
    if (!note.trim()) {
      setError('Please enter a note before saving.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(note.trim())
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not save note')
    } finally {
      setSaving(false)
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
    <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border bg-slate-50 p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">Add note</p>
          <h2 className="text-2xl font-black text-slate-950">{studentName}</h2>
        </div>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-200">
          <X size={20} />
        </button>
      </div>
      <label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-600">Note</label>
      <textarea
        value={note}
        onChange={(event) => { setNote(event.target.value); setError('') }}
        rows={5}
        autoFocus
        placeholder="Write the call update, reminder, or follow-up note..."
        className="mt-2 w-full resize-none rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-300/70 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>
    </form>
  </div>
}

function NotesList({ activities }) {
  const notes = activities.filter((activity) => activity.type === 'note')
  if (!notes.length) return <Placeholder icon={MessageSquareText} title="No notes yet" />

  return <div className="space-y-3">
    {notes.map((note) => <article key={note._id} className="glass-panel rounded-2xl border p-4 shadow-glass">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">{note.contactName}</p>
          <h2 className="font-black text-slate-950">{note.title}</h2>
        </div>
        <p className="text-xs font-bold text-slate-500">{new Date(note.createdAt).toLocaleString()}</p>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm font-bold text-slate-700">{note.summary}</p>
      <p className="mt-3 text-xs font-black uppercase text-slate-400">Added by {note.createdBy}</p>
    </article>)}
  </div>
}

function Dashboard({ user, onLogout }) {
  const { theme } = useTheme()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('Contacts')
  const [contacts, setContacts] = useState([])
  const [teachers, setTeachers] = useState([])
  const [activities, setActivities] = useState([])
  const [metrics, setMetrics] = useState({})
  const [query, setQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [noteContact, setNoteContact] = useState(null)

  const loadContacts = async () => setContacts(await contactsApi.list())
  const loadActivities = async () => setActivities(await activitiesApi.list())
  const loadAdmin = async () => {
    if (user.role !== 'admin') return
    const [metricData, teacherData] = await Promise.all([adminApi.metrics(), adminApi.teachers()])
    setMetrics(metricData); setTeachers(teacherData)
  }

  useEffect(() => { loadContacts().catch(() => showToast('Could not load contacts')) }, [])
  useEffect(() => { loadActivities().catch(() => showToast('Could not load notes')) }, [])
  useEffect(() => { loadAdmin().catch(() => showToast('Could not load admin data')) }, [user.role])

  const visibleContacts = contacts.filter((contact) =>
    `${contact.student?.name || ''} ${contact.student?.grade || ''}`.toLowerCase().includes(query.toLowerCase()))
    .map((contact) => ({ ...contact, tone: 'blue' }))

  async function assign(contact, teacherId) {
    await adminApi.assignContact(contact._id, teacherId || null)
    await loadContacts()
    showToast(teacherId ? 'Student assigned' : 'Student unassigned')
  }
  async function removeContact(contact) {
    if (!window.confirm(`Delete ${contact.student?.name}?`)) return
    await contactsApi.remove(contact._id); await Promise.all([loadContacts(), loadAdmin()])
  }
  async function removeTeacher(teacher) {
    if (!window.confirm(`Delete teacher ${teacher.name}?`)) return
    await adminApi.deleteTeacher(teacher.id); await Promise.all([loadContacts(), loadAdmin()])
  }
  async function saveNote(note) {
    await activitiesApi.create({
      type: 'note',
      contactId: noteContact._id,
      summary: note,
    })
    setNoteContact(null)
    await loadActivities()
    showToast('Note saved')
  }

  let content
  if (activeTab === 'Contacts') content = <>
    <div className="mb-6 flex gap-3">
      <label className="flex flex-1 items-center gap-2 rounded-2xl border bg-white/65 px-4"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students…" className="h-11 w-full bg-transparent outline-none font-bold" /></label>
      <IconButton onClick={() => setShowUpload(true)} className="bg-blue-700 text-white px-4"><Plus size={16} /> Add Student</IconButton>
    </div>
    <ContactsTable contacts={visibleContacts} user={user} teachers={teachers} onAssign={assign} onDelete={removeContact}
      onCall={() => {}} onResolve={() => showToast('Marked resolved')} onAddNote={setNoteContact} />
  </>
  else if (activeTab === 'Upload') content = <StudentUpload user={user} onSuccess={() => { loadContacts(); showToast('Student added') }} />
  else if (activeTab === 'Settings' && user.role === 'admin') content = <AdminPanel metrics={metrics} teachers={teachers} onDeleteTeacher={removeTeacher} />
  else if (activeTab === 'Notes') content = <NotesList activities={activities} />
  else content = <Placeholder icon={activeTab === 'Calls' ? PhoneCall : activeTab === 'Notes' ? MessageSquareText : Settings} title={activeTab} />

  return <main data-theme={theme} className="app-shell min-h-screen text-slate-900 relative">
    <FloatingOrbs />
    <Header activeTab={activeTab} onTabChange={setActiveTab} user={user} onProfile={() => setShowProfile(true)} />
    <section className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 pb-28">
      <p className="text-xs font-black uppercase text-blue-700">{activeTab}</p>
      <h1 className="mb-6 text-3xl font-black">{activeTab === 'Settings' && user.role === 'admin' ? 'Administration' : activeTab}</h1>
      {content}
    </section>
    <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    {showUpload && <div className="fixed inset-0 z-40 overflow-y-auto bg-black/50 p-4"><StudentUpload user={user} onCancel={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); loadContacts(); loadAdmin() }} /></div>}
    {showProfile && <ProfilePanel user={user} onClose={() => setShowProfile(false)} onLogout={onLogout} />}
    {noteContact && <NoteModal contact={noteContact} onClose={() => setNoteContact(null)} onSave={saveNote} />}
  </main>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem('edustaff_token')))

  useEffect(() => {
    if (!checking) return
    authApi.me().then(setUser).catch(() => localStorage.removeItem('edustaff_token')).finally(() => setChecking(false))
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
