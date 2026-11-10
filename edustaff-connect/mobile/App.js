import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'expo-router'
import { Link } from 'solito/link'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Line, Path } from 'react-native-svg'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import './global.css'
import { api, clearToken, savedToken, setUnauthorizedHandler, storeToken } from './src/api'
import { admissionTypes, callOutcomes, colors, departmentsByAdmission } from './src/theme'

const pageSize = 20
const studentName = (contact) => contact?.student?.name || contact?.name || 'Student'
const requestKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const errorMessage = (error) => error?.message || 'Something went wrong. Please try again.'
const userIsAdmin = (user) => user?.role === 'admin'

export default function App() {
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState('')
  const [tab, setTab] = useState('Home')
  const [selectedContact, setSelectedContact] = useState(null)
  const [editingContact, setEditingContact] = useState(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    let active = true
    ;(async () => {
      try {
        const token = await savedToken()
        if (token) {
          const currentUser = await api('/auth/me', { token })
          if (active) setUser(currentUser)
        }
      } catch (error) {
        await clearToken()
        if (active) setBootError(errorMessage(error))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingContact !== undefined) {
        setEditingContact(undefined)
        return true
      }
      if (selectedContact) {
        setSelectedContact(null)
        return true
      }
      return false
    })
    return () => subscription.remove()
  }, [editingContact, selectedContact])

  const showNotice = (message) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3500)
  }

  const onAuthenticated = async (result) => {
    await storeToken(result.token)
    setUser(result.user)
    setBootError('')
  }

  const logout = async () => {
    let logoutError
    try { await api('/auth/logout', { method: 'POST' }) } catch (error) { logoutError = error }
    await clearToken()
    setUser(null)
    setSelectedContact(null)
    setEditingContact(undefined)
    setTab('Home')
    if (logoutError) Alert.alert('Signed out on this device', `The server session could not be invalidated: ${errorMessage(logoutError)}`)
  }

  if (loading) return <LoadingScreen />
  if (!user) return <AuthScreen onAuthenticated={onAuthenticated} initialError={bootError} initialMode={pathname === '/signup' ? 'signup' : 'login'} />

  if (editingContact !== undefined) {
    return (
      <StudentEditor
        contact={editingContact || null}
        user={user}
        onCancel={() => setEditingContact(undefined)}
        onSaved={(contact) => {
          setEditingContact(undefined)
          setRefreshKey((value) => value + 1)
          if (editingContact) setSelectedContact(contact)
          showNotice(editingContact ? 'Student details updated.' : 'Student added.')
        }}
      />
    )
  }

  if (selectedContact) {
    return (
      <ContactDetails
        contact={selectedContact}
        user={user}
        onBack={() => setSelectedContact(null)}
        onEdit={() => setEditingContact(selectedContact)}
        onChanged={(contact) => {
          setSelectedContact(contact || null)
          setRefreshKey((value) => value + 1)
        }}
        showNotice={showNotice}
      />
    )
  }

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <AppHeader user={user} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.content}>
        {tab === 'Home' && <HomeScreen user={user} refreshKey={refreshKey} onNavigate={setTab} />}
        {tab === 'Students' && (
          <ContactsScreen
            user={user}
            refreshKey={refreshKey}
            onOpen={setSelectedContact}
            onAdd={() => setEditingContact(null)}
            showNotice={showNotice}
          />
        )}
        {tab === 'Calls' && <CallsScreen refreshKey={refreshKey} />}
        {tab === 'Uploads' && <UploadsScreen user={user} onStudentAdded={() => setRefreshKey((value) => value + 1)} />}
        {tab === 'Settings' && <SettingsScreen user={user} onLogout={logout} showNotice={showNotice} />}
      </View>
      <BottomTabs current={tab} onChange={setTab} />
    </View>
  )
}

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>E</Text></View>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.mutedText}>Connecting to EduConnect…</Text>
    </View>
  )
}

function AuthScreen({ onAuthenticated, initialError, initialMode = 'login' }) {
  const mode = initialMode
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('1990-01-01')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api(mode === 'login' ? '/auth/login' : '/auth/signup', {
        method: 'POST',
        body: mode === 'login'
          ? { email, password }
          : { name, email, phone, dateOfBirth, password },
      })
      await onAuthenticated(result)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#eaf2ff', '#f8fafc', '#ffffff']} locations={[0, 0.48, 1]} style={styles.authShell}>
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
        <View className="mx-auto w-full max-w-md">
        <View className="mb-7 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-700 shadow-lg">
            <CapIcon />
          </View>
          <Text className="text-3xl font-black tracking-tight text-slate-950">EduStaff</Text>
          <Text className="mt-1 text-sm font-bold text-slate-600">{mode === 'login' ? 'Sign in to your workspace' : 'Create your teacher account'}</Text>
        </View>
        <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <Text className="mb-1 text-lg font-extrabold text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create teacher account'}</Text>
          <Text className="mb-5 text-sm text-slate-500">{mode === 'login' ? 'Enter your details to continue.' : 'Set up your teacher access.'}</Text>
          {error ? <InlineError message={error} /> : null}
          {mode === 'signup' ? (
            <>
              <AuthField label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
              <AuthField label="Phone" value={phone} onChangeText={setPhone} placeholder="Guardian or work phone" keyboardType="phone-pad" />
              <AuthField label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />
            </>
          ) : null}
          <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="name@school.edu" keyboardType="email-address" autoCapitalize="none" />
          <View className="mb-4">
            <Text className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600">Password</Text>
            <View className="h-12 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#94a3b8" secureTextEntry={!showPassword} autoCapitalize="none" className="h-full flex-1 text-sm font-semibold text-slate-900" />
              <Pressable onPress={() => setShowPassword((visible) => !visible)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={10}>
                <Text className="px-2 py-2 text-xs font-bold text-blue-700">{showPassword ? 'HIDE' : 'SHOW'}</Text>
              </Pressable>
            </View>
          </View>
          <Pressable disabled={busy} onPress={submit} className="mt-1 min-h-12 flex-row items-center justify-center rounded-xl bg-blue-700 px-4 shadow-md active:bg-blue-800">
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-black text-white">{mode === 'login' ? 'Sign In' : 'Create Teacher Account'}  →</Text>}
          </Pressable>
          <View className="mt-5 flex-row flex-wrap justify-center">
            <Text className="text-xs font-bold text-slate-600">{mode === 'login' ? 'New to EduStaff?  ' : 'Already registered?  '}</Text>
            <Link href={mode === 'login' ? '/signup' : '/'}>
              <Text className="text-xs font-bold text-blue-700 underline">{mode === 'login' ? 'Create an account' : 'Sign in'}</Text>
            </Link>
          </View>
        </View>
        <Text className="mt-5 text-center text-xs font-semibold text-slate-500">Secure access · Your school account</Text>
        </View>
      </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  )
}

function AuthField({ label, ...props }) {
  return <View className="mb-4">
    <Text className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600">{label}</Text>
    <TextInput {...props} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900" />
  </View>
}

function CapIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none" accessibilityLabel="Graduation cap">
      <Path d="M2.5 11.5 17 4l14.5 7.5L17 19 2.5 11.5Z" stroke="#fff" strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M8 14.5v7c5.5 4.2 12.5 4.2 18 0v-7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="31.5" y1="12" x2="31.5" y2="21" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Path d="M29.5 23c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2Z" fill="#fff" />
    </Svg>
  )
}

function AppHeader({ user }) {
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
  return (
    <View style={styles.header}>
      <View style={styles.headerBrandRow}>
        <View style={styles.brandMarkSmall}><Text style={styles.brandMarkTextSmall}>E</Text></View>
        <View>
          <Text style={styles.headerBrand}>EduConnect</Text>
          <Text style={styles.headerCaption}>STUDENT RELATIONSHIP HUB</Text>
        </View>
      </View>
      <View style={styles.avatar}><Text style={styles.avatarText}>{firstName.slice(0, 1).toUpperCase()}</Text></View>
    </View>
  )
}

function BottomTabs({ current, onChange }) {
  const items = [
    ['Home', '⌂'],
    ['Students', '◉'],
    ['Calls', '↗'],
    ['Uploads', '＋'],
    ['Settings', '⚙'],
  ]
  return (
    <View style={styles.tabBar}>
      {items.map(([name, glyph]) => {
        const active = name === current
        return (
          <Pressable key={name} style={styles.tabButton} onPress={() => onChange(name)}>
            <Text style={[styles.tabGlyph, active && styles.tabGlyphActive]}>{glyph}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{name}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function HomeScreen({ user, refreshKey, onNavigate }) {
  const [data, setData] = useState({ contacts: 0, calls: 0, teachers: 0 })
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [contactData, callData] = await Promise.all([
        api('/contacts', { query: { page: 1, pageSize: 1 } }),
        api('/calls'),
      ])
      let teachers = 0
      if (userIsAdmin(user)) {
        const metrics = await api('/admin/metrics')
        teachers = metrics.teacherCount || 0
      }
      setData({ contacts: contactData.total || 0, calls: callData.summary?.total || callData.calls?.length || 0, teachers })
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }, [user])

  useEffect(() => { load() }, [load, refreshKey])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenPad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.greetingBlock}>
        <Text style={styles.eyebrow}>YOUR WORKSPACE</Text>
        <Text style={styles.heroTitle}>Good day, {user?.name?.split(' ')[0] || 'Teacher'}.</Text>
        <Text style={styles.heroSub}>Keep every student connection moving forward.</Text>
      </View>
      {error ? <InlineError message={error} /> : null}
      <View style={styles.metricGrid}>
        <MetricCard label="Students" value={data.contacts} accent={colors.primary} />
        <MetricCard label="Call records" value={data.calls} accent={colors.violet} />
        {userIsAdmin(user) ? <MetricCard label="Teachers" value={data.teachers} accent={colors.sky} /> : null}
      </View>
      <SectionHeading title="Quick actions" subtitle="Jump back into your daily work." />
      <View style={styles.quickGrid}>
        <QuickAction title="Find a student" subtitle="Search your records" glyph="⌕" onPress={() => onNavigate('Students')} />
        <QuickAction title="Log a call" subtitle="Review call outcomes" glyph="↗" onPress={() => onNavigate('Calls')} />
        <QuickAction title="Add students" subtitle="Manual entry or CSV" glyph="＋" onPress={() => onNavigate('Uploads')} />
        <QuickAction title="Account & tools" subtitle="Profile and settings" glyph="⚙" onPress={() => onNavigate('Settings')} />
      </View>
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerTitle}>Everything in one place</Text>
        <Text style={styles.infoBannerText}>Student records, communication history, and follow-ups stay connected to your school account.</Text>
      </View>
    </ScrollView>
  )
}

function ContactsScreen({ user, refreshKey, onOpen, onAdd, showNotice }) {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState('')
  const [admissionType, setAdmissionType] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [customFilters, setCustomFilters] = useState({})
  const [filterFields, setFilterFields] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [teachers, setTeachers] = useState([])
  const [showBulkAssign, setShowBulkAssign] = useState(false)

  const admin = userIsAdmin(user)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const customQuery = Object.fromEntries(Object.entries(customFilters)
        .filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== '')
        .map(([key, value]) => [`customField_${key}`, value]))
      const result = await api('/contacts', { query: { search, grade, admissionType, department, status, ...customQuery, page, pageSize } })
      setContacts(result.contacts || [])
      setTotalPages(Math.max(1, result.totalPages || 1))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search, grade, admissionType, department, status, customFilters, page])
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    if (admin) api('/admin/teachers').then(setTeachers).catch((requestError) => setError(errorMessage(requestError)))
  }, [admin])
  useEffect(() => {
    api('/custom-fields')
      .then((items) => setFilterFields(items.filter((field) => field.filterable && field.state === 'active')))
      .catch((requestError) => setError(errorMessage(requestError)))
  }, [])

  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])

  const bulkAssign = () => {
    if (!selectedIds.length) return
    setShowBulkAssign(true)
  }

  const assignSelected = async (teacherId) => {
    try {
      await api('/admin/contacts/bulk-assignment', { method: 'PATCH', body: { contactIds: selectedIds, teacherId } })
      const count = selectedIds.length
      setSelectedIds([])
      setShowBulkAssign(false)
      showNotice(`Assigned ${count} students.`)
      load()
    } catch (requestError) { setError(errorMessage(requestError)) }
  }

  const exportSelected = async () => {
    try {
      const csv = await api('/contacts/export', { query: { ids: selectedIds } , responseType: 'text' })
      const filePath = `${FileSystem.cacheDirectory}educonnect-selected-students.csv`
      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 })
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export selected students' })
      else showNotice(`CSV saved to ${filePath}`)
    } catch (requestError) { setError(errorMessage(requestError)) }
  }

  const setCustomFilter = (key, value) => {
    setPage(1)
    setCustomFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenPad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />}
    >
      <SectionHeading title="Students" subtitle="Search and manage your school relationships." />
      <View style={styles.searchRow}>
        <TextInput value={search} onChangeText={(value) => { setPage(1); setSearch(value) }} placeholder="Search students…" placeholderTextColor={colors.muted} style={[styles.input, styles.searchInput]} />
        <Pressable style={styles.primarySquare} onPress={onAdd}><Text style={styles.plusText}>＋</Text></Pressable>
      </View>
      <View style={styles.filterRow}>
        <ChoiceChip label="All years" selected={!grade} onPress={() => { setGrade(''); setPage(1) }} />
        {['1', '2', '3'].map((value) => <ChoiceChip key={value} label={`Year ${value}`} selected={grade === value} onPress={() => { setGrade(grade === value ? '' : value); setPage(1) }} />)}
      </View>
      <View style={styles.filterRow}>
        <ChoiceChip label="All admission" selected={!admissionType} onPress={() => { setAdmissionType(''); setPage(1) }} />
        {admissionTypes.map((value) => <ChoiceChip key={value} label={value} selected={admissionType === value} onPress={() => { setAdmissionType(admissionType === value ? '' : value); setPage(1) }} />)}
      </View>
      <View style={styles.filterRow}>
        <ChoiceChip label="All departments" selected={!department} onPress={() => { setDepartment(''); setPage(1) }} />
        {(admissionType
          ? departmentsByAdmission[admissionType]
          : [...new Set(Object.values(departmentsByAdmission).flat())]
        ).map((value) => <ChoiceChip key={value} label={value} selected={department === value} onPress={() => { setDepartment(department === value ? '' : value); setPage(1) }} />)}
      </View>
      {admin ? (
        <View style={styles.filterRow}>
          <ChoiceChip label="All statuses" selected={!status} onPress={() => { setStatus(''); setPage(1) }} />
          {['Primary Guardian', 'Medical Alert', 'New Admission', 'Absent Today', 'Inquiry'].map((value) => <ChoiceChip key={value} label={value} selected={status === value} onPress={() => { setStatus(status === value ? '' : value); setPage(1) }} />)}
        </View>
      ) : null}
      {selectedIds.length ? (
        <View style={styles.rowActions}>
          <OutlineButton title={`Export ${selectedIds.length} selected`} onPress={exportSelected} compact />
          {admin ? <ActionButton title={`Assign ${selectedIds.length} selected`} onPress={bulkAssign} compact /> : null}
        </View>
      ) : null}
      {filterFields.map((field) => (
        <View key={field.key}>
          <Text style={styles.inputLabel}>{field.label}</Text>
          {field.type === 'boolean' ? (
            <View style={styles.filterRow}>
              <ChoiceChip label="Any" selected={!customFilters[field.key]} onPress={() => setCustomFilter(field.key, '')} />
              <ChoiceChip label="Yes" selected={customFilters[field.key] === 'true'} onPress={() => setCustomFilter(field.key, 'true')} />
              <ChoiceChip label="No" selected={customFilters[field.key] === 'false'} onPress={() => setCustomFilter(field.key, 'false')} />
            </View>
          ) : ['select', 'multi_select'].includes(field.type) ? (
            <View style={styles.filterRow}>
              <ChoiceChip label="Any" selected={!customFilters[field.key]} onPress={() => setCustomFilter(field.key, '')} />
              {(field.options || []).map((option) => {
                const current = customFilters[field.key] || (field.type === 'multi_select' ? [] : '')
                const selected = field.type === 'multi_select' ? current.includes(option.value) : current === option.value
                return (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={selected}
                    onPress={() => setCustomFilter(
                      field.key,
                      field.type === 'multi_select'
                        ? selected ? current.filter((value) => value !== option.value) : [...current, option.value]
                        : selected ? '' : option.value,
                    )}
                  />
                )
              })}
            </View>
          ) : (
            <Input label="" value={customFilters[field.key] || ''} onChangeText={(value) => setCustomFilter(field.key, value)} placeholder={`Filter by ${field.label.toLowerCase()}`} />
          )}
        </View>
      ))}
      {error ? <InlineError message={error} /> : null}
      {loading && !refreshing ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {!loading && contacts.length === 0 ? <EmptyState title="No students found" subtitle="Try a different search or add your first student." /> : null}
      {contacts.map((contact) => (
        <ContactCard
          key={contact._id}
          contact={contact}
          admin={admin}
          selected={selectedIds.includes(contact._id)}
          onToggle={() => toggleSelected(contact._id)}
          onPress={() => onOpen(contact)}
        />
      ))}
      <View style={styles.pager}>
        <Text style={styles.mutedText}>Page {page} of {totalPages}</Text>
        <View style={styles.pagerActions}>
          <OutlineButton title="Previous" disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
          <OutlineButton title="Next" disabled={page >= totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))} />
        </View>
        <Modal visible={showBulkAssign} transparent animationType="slide" onRequestClose={() => setShowBulkAssign(false)}>
          <View style={styles.modalScrim}><Card style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Assign selected students</Text>
            <OutlineButton title="Unassign" onPress={() => assignSelected(null)} />
            {teachers.map((teacher) => <OutlineButton key={teacher.id || teacher._id} title={teacher.name} onPress={() => assignSelected(teacher.id || teacher._id)} />)}
            <OutlineButton title="Cancel" onPress={() => setShowBulkAssign(false)} />
          </Card></View>
        </Modal>
      </View>
    </ScrollView>
  )
}

function ContactCard({ contact, admin, selected, onToggle, onPress }) {
  const student = contact.student || {}
  return (
    <View style={[styles.contactCard, selected && styles.contactCardSelected]}>
      {admin ? (
        <Pressable style={styles.checkBox} onPress={onToggle}><Text style={styles.checkText}>{selected ? '✓' : ''}</Text></Pressable>
      ) : null}
      <Pressable style={styles.contactCardMain} onPress={onPress}>
        <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{studentName(contact).slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>{studentName(contact)}</Text>
          <Text style={styles.contactSub}>{student.grade ? `Year ${student.grade} · ` : ''}{student.department || 'Student record'}</Text>
          <Text style={styles.contactPhone}>{contact.phone || 'No guardian phone'}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {contact.assignedTo?.name ? <Text style={styles.assignedLabel}>Assigned to {contact.assignedTo.name}</Text> : null}
    </View>
  )
}

function StudentEditor({ contact, user, onCancel, onSaved }) {
  const [name, setName] = useState(studentName(contact) === 'Student' ? '' : studentName(contact))
  const [phone, setPhone] = useState(contact?.phone || '')
  const [admissionType, setAdmissionType] = useState(contact?.student?.admissionType || 'Regular')
  const [department, setDepartment] = useState(contact?.student?.department || '')
  const [grade, setGrade] = useState(contact?.student?.grade || '')
  const [notes, setNotes] = useState(contact?.notes || '')
  const [status, setStatus] = useState(contact?.status || '')
  const [fields, setFields] = useState([])
  const [customValues, setCustomValues] = useState(contact?.customFields || {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const admin = userIsAdmin(user)
  const departments = departmentsByAdmission[admissionType] || []

  useEffect(() => {
    api('/custom-fields').then((items) => {
      setFields(items.filter((field) => field.formVisible !== false && field.state === 'active'))
      if (!contact) {
        setCustomValues(Object.fromEntries(items.filter((field) => field.defaultValue != null).map((field) => [field.key, field.defaultValue])))
      }
    }).catch((requestError) => setError(errorMessage(requestError)))
  }, [contact])

  const updateCustom = (key, value) => setCustomValues((values) => ({ ...values, [key]: value }))

  const save = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      let result
      if (contact) {
        const body = {
          name,
          phone,
          student: { ...(contact.student || {}), name, admissionType, department, ...(grade ? { grade } : {}) },
          customFields: customValues,
          ...(admin ? { status, notes } : {}),
        }
        result = await api(`/contacts/${contact._id}`, { method: 'PATCH', body })
      } else {
        const response = await api('/uploads/manual', {
          method: 'POST',
          body: { studentName: name, admissionType, department, guardianPhone: phone, notes: admin ? notes : '', customFields: customValues },
        })
        result = response.contact
      }
      if (contact && grade && result.student?.grade !== grade) {
        result = await api(`/contacts/${contact._id}`, { method: 'PATCH', body: { student: { ...(result.student || {}), grade } } })
      }
      onSaved(result)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.fullScreen}>
      <AppHeader user={user} />
      <ScrollView contentContainerStyle={styles.screenPad}>
        <BackTitle title={contact ? 'Edit student' : 'Add student'} onBack={onCancel} />
        <Card>
          <Input label="Student name" value={name} onChangeText={setName} placeholder="Full name" />
          <Input label="Parent / guardian phone" value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" keyboardType="phone-pad" />
          <Text style={styles.inputLabel}>Admission type</Text>
          <OptionChips values={admissionTypes} value={admissionType} onChange={(value) => { setAdmissionType(value); setDepartment('') }} />
          <Text style={styles.inputLabel}>Department</Text>
          <OptionChips values={departments} value={department} onChange={setDepartment} />
          {contact ? (
            <>
              <Text style={styles.inputLabel}>Year of study</Text>
              <OptionChips values={['1', '2', '3']} value={grade} onChange={setGrade} />
            </>
          ) : null}
          {admin ? (
            <>
              <Input label="Status" value={status} onChangeText={setStatus} placeholder="Inquiry, New Admission…" />
              <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Add a note" multiline />
            </>
          ) : null}
        </Card>
        {fields.map((field) => (
          <CustomFieldInput key={field.key} field={field} value={customValues[field.key]} onChange={(value) => updateCustom(field.key, value)} />
        ))}
        {error ? <InlineError message={error} /> : null}
        <ActionButton title={contact ? 'Save changes' : 'Add student'} onPress={save} loading={loading} />
        <OutlineButton title="Cancel" onPress={onCancel} />
      </ScrollView>
    </View>
  )
}

function CustomFieldInput({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <Card>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>{field.label}{field.required ? ' *' : ''}</Text>
            {field.helpText ? <Text style={styles.mutedText}>{field.helpText}</Text> : null}
          </View>
          <Switch value={Boolean(value)} onValueChange={onChange} trackColor={{ true: colors.primary }} />
        </View>
      </Card>
    )
  }
  if (field.type === 'select' || field.type === 'multi_select') {
    const selected = field.type === 'multi_select' ? (Array.isArray(value) ? value : []) : [value]
    return (
      <Card>
        <Text style={styles.inputLabel}>{field.label}{field.required ? ' *' : ''}</Text>
        <View style={styles.chipWrap}>
          {(field.options || []).map((option) => {
            const active = selected.includes(option.value)
            return (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={active}
                onPress={() => {
                  if (field.type === 'multi_select') onChange(active ? selected.filter((item) => item !== option.value) : [...selected, option.value])
                  else onChange(option.value)
                }}
              />
            )
          })}
        </View>
      </Card>
    )
  }
  return (
    <Card>
      <Input
        label={`${field.label}${field.required ? ' *' : ''}`}
        value={value == null ? '' : String(value)}
        onChangeText={(text) => onChange(field.type === 'number' && text !== '' ? Number(text) : text)}
        placeholder={field.placeholder || field.helpText || ''}
        keyboardType={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : 'default'}
        multiline={field.type === 'long_text'}
      />
    </Card>
  )
}

function ContactDetails({ contact, user, onBack, onEdit, onChanged, showNotice }) {
  const [history, setHistory] = useState([])
  const [calls, setCalls] = useState([])
  const [teachers, setTeachers] = useState([])
  const [smsText, setSmsText] = useState('')
  const [showSms, setShowSms] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const admin = userIsAdmin(user)
  const load = useCallback(async () => {
    try {
      const [records, callsResult] = await Promise.all([
        api(`/communications/contact/${contact._id}`),
        api('/calls', { query: { contactId: contact._id } }),
      ])
      setHistory(records || [])
      setCalls(callsResult.calls || [])
    } catch (requestError) { setError(errorMessage(requestError)) }
  }, [contact._id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (admin) api('/admin/teachers').then(setTeachers).catch((requestError) => setError(errorMessage(requestError)))
  }, [admin])

  const startCall = async () => {
    setBusy(true)
    try {
      await api('/calls', { method: 'POST', body: { contactId: contact._id } })
      await Linking.openURL(`tel:${contact.phone}`)
      showNotice('Call saved to your history.')
      await load()
    } catch (requestError) { Alert.alert('Could not start call', errorMessage(requestError)) }
    finally { setBusy(false) }
  }

  const sendSms = async () => {
    setBusy(true)
    try {
      await api('/communications/sms', {
        method: 'POST',
        body: { contactId: contact._id, message: smsText, idempotencyKey: requestKey() },
      })
      setSmsText('')
      setShowSms(false)
      showNotice('Message submitted.')
      await load()
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setBusy(false) }
  }

  const assignTeacher = async (teacherId) => {
    try {
      const updated = await api(`/admin/contacts/${contact._id}/assignment`, { method: 'PATCH', body: { teacherId } })
      setShowAssign(false)
      onChanged(updated)
    } catch (requestError) { Alert.alert('Assignment failed', errorMessage(requestError)) }
  }

  const deleteContact = () => Alert.alert('Delete student?', 'This removes the student record.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api(`/contacts/${contact._id}`, { method: 'DELETE' }); onChanged(null); showNotice('Student deleted.') }
      catch (requestError) { Alert.alert('Delete failed', errorMessage(requestError)) }
    } },
  ])

  const addCallNote = () => {
    const latest = calls[0]
    if (!latest) {
      Alert.alert('No call record', 'Start a tracked call before adding a call note.')
      return
    }
    setShowNote(true)
  }

  const saveCallNote = async () => {
    const latest = calls[0]
    if (!latest || !noteText.trim()) return
    setBusy(true)
    try {
      await api(`/calls/${latest._id}/notes`, { method: 'POST', body: { summary: noteText.trim() } })
      setNoteText('')
      setShowNote(false)
      showNotice('Note added to call history.')
      await load()
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setBusy(false) }
  }

  return (
    <View style={styles.fullScreen}>
      <AppHeader user={user} />
      <ScrollView contentContainerStyle={styles.screenPad}>
        <BackTitle title="Student details" onBack={onBack} right={admin ? <Pressable onPress={deleteContact}><Text style={styles.dangerLink}>Delete</Text></Pressable> : null} />
        {error ? <InlineError message={error} /> : null}
        <Card style={styles.detailHero}>
          <View style={styles.detailAvatar}><Text style={styles.detailAvatarText}>{studentName(contact).slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.detailName}>{studentName(contact)}</Text>
          <Text style={styles.mutedText}>{contact.student?.grade ? `Year ${contact.student.grade} · ` : ''}{contact.student?.department || 'Student'}</Text>
          <Text style={styles.detailPhone}>{contact.phone || 'No guardian phone'}</Text>
          <View style={styles.detailActions}>
            <ActionButton title="Call" onPress={startCall} loading={busy} compact disabled={!contact.phone} />
            <OutlineButton title="Edit" onPress={onEdit} compact />
            {contact.smsConsent?.status === 'granted'
              ? <OutlineButton title="Message" onPress={() => setShowSms(true)} compact />
              : <Text style={styles.consentText}>SMS disabled · consent not granted</Text>}
          </View>
        </Card>
        <Card>
          <Text style={styles.cardTitle}>Student information</Text>
          <DetailRow label="Admission" value={contact.student?.admissionType || '—'} />
          <DetailRow label="Department" value={contact.student?.department || '—'} />
          <DetailRow label="Year of study" value={contact.student?.grade || '—'} />
          <DetailRow label="Status" value={admin ? contact.status || '—' : 'Visible to administrators'} />
          {admin ? <DetailRow label="Notes" value={contact.notes || '—'} /> : null}
          {Object.entries(contact.customFields || {}).map(([key, value]) => <DetailRow key={key} label={key.replaceAll('_', ' ')} value={Array.isArray(value) ? value.join(', ') : String(value ?? '—')} />)}
        </Card>
        {admin ? (
          <Card>
            <Text style={styles.cardTitle}>Teacher assignment</Text>
            <Text style={styles.mutedText}>{contact.assignedTo?.name || 'Not assigned'}</Text>
            <OutlineButton title="Change assignment" onPress={() => setShowAssign(true)} />
          </Card>
        ) : null}
        <View style={styles.sectionHeadRow}>
          <View><Text style={styles.sectionTitle}>Communication history</Text><Text style={styles.mutedText}>Calls, messages, and notes for this student.</Text></View>
          <OutlineButton title="＋ Note" onPress={addCallNote} compact />
        </View>
        {!history.length ? <EmptyState title="No history yet" subtitle="Calls and messages will show here." /> : history.map((record, index) => <HistoryCard key={record._id || `${record.kind}-${index}`} record={record} />)}
      </ScrollView>
      <Modal visible={showSms} transparent animationType="slide" onRequestClose={() => setShowSms(false)}>
        <View style={styles.modalScrim}>
          <Card style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Send message</Text>
            <Text style={styles.mutedText}>Message to {contact.phone}. SMS consent is recorded for this contact.</Text>
            <Input label="Message" value={smsText} onChangeText={setSmsText} multiline placeholder="Write a short message…" />
            <Text style={styles.helperText}>{smsText.length}/1600 characters</Text>
            <ActionButton title="Send message" onPress={sendSms} loading={busy} disabled={!smsText.trim() || smsText.length > 1600} />
            <OutlineButton title="Cancel" onPress={() => setShowSms(false)} />
          </Card>
        </View>
      </Modal>
      <Modal visible={showNote} transparent animationType="slide" onRequestClose={() => setShowNote(false)}>
        <View style={styles.modalScrim}><Card style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Add call note</Text>
          <Text style={styles.mutedText}>This note will be attached to the latest call.</Text>
          <Input label="Note" value={noteText} onChangeText={setNoteText} multiline placeholder="What should be remembered?" />
          <ActionButton title="Save note" onPress={saveCallNote} loading={busy} disabled={!noteText.trim()} />
          <OutlineButton title="Cancel" onPress={() => setShowNote(false)} />
        </Card></View>
      </Modal>
      <Modal visible={showAssign} transparent animationType="slide" onRequestClose={() => setShowAssign(false)}>
        <View style={styles.modalScrim}><Card style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Assign student</Text>
          <OutlineButton title="Unassign student" onPress={() => assignTeacher(null)} />
          {teachers.map((teacher) => <OutlineButton key={teacher.id || teacher._id} title={teacher.name} onPress={() => assignTeacher(teacher.id || teacher._id)} />)}
          <OutlineButton title="Cancel" onPress={() => setShowAssign(false)} />
        </Card></View>
      </Modal>
    </View>
  )
}

function CallsScreen({ refreshKey }) {
  const [calls, setCalls] = useState([])
  const [summary, setSummary] = useState({})
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await api('/calls')
      setCalls(result.calls || [])
      setSummary(result.summary || {})
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { load() }, [load, refreshKey])

  const setOutcome = async (call, status) => {
    try {
      await api(`/calls/${call._id}`, { method: 'PATCH', body: { status } })
      load()
    } catch (requestError) { Alert.alert('Could not update call', errorMessage(requestError)) }
  }

  const setNoteInterest = async (call, note, interest) => {
    try {
      await api(`/calls/${call._id}/notes/${note._id}`, { method: 'PATCH', body: { interest } })
      await load()
    } catch (requestError) { Alert.alert('Could not update note', errorMessage(requestError)) }
  }

  const visibleCalls = calls.filter((call) => filter === 'all' || call.notes?.some((note) => note.interest === filter))

  return (
    <ScrollView contentContainerStyle={styles.screenPad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />}>
      <SectionHeading title="Call activity" subtitle="Tracked calls and follow-up outcomes." />
      <View style={styles.metricGrid}>
        <MetricCard label="Total calls" value={summary.total || calls.length} accent={colors.primary} />
        <MetricCard label="Attended" value={summary.attended || 0} accent={colors.green} />
        <MetricCard label="Needs follow-up" value={summary.unanswered || 0} accent={colors.amber} />
      </View>
      {error ? <InlineError message={error} /> : null}
      <View style={styles.outcomeWrap}>
        {[['all', 'All'], ['interested', 'Interested'], ['not_interested', 'Not interested']].map(([key, label]) => <ChoiceChip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />)}
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {!loading && visibleCalls.length === 0 ? <EmptyState title={calls.length === 0 ? 'No calls recorded' : 'No notes in this filter'} subtitle={calls.length === 0 ? 'Open a student record and tap Call to start tracking.' : 'Choose another filter to see call notes.'} /> : null}
      {visibleCalls.map((call) => (
        <Card key={call._id}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{call.studentName || call.contactName || call.phone || 'Student call'}</Text>
              <Text style={styles.mutedText}>{formatDate(call.startedAt)} · {call.durationLabel || call.status || 'in progress'}</Text>
            </View>
            <StatusBadge label={call.status || 'unknown'} />
          </View>
          <View style={styles.outcomeWrap}>
            {callOutcomes.map((outcome) => (
              <ChoiceChip key={outcome} label={outcome.replace('-', ' ')} selected={call.status === outcome} onPress={() => setOutcome(call, outcome)} />
            ))}
          </View>
          {call.notes?.length ? call.notes.map((note) => (
            <View key={note._id} style={styles.callNote}>
              <Text style={styles.noteText}>“{note.summary}”</Text>
              <View style={styles.outcomeWrap}>
                <ChoiceChip label="Interested" selected={note.interest === 'interested'} onPress={() => setNoteInterest(call, note, 'interested')} />
                <ChoiceChip label="Not interested" selected={note.interest === 'not_interested'} onPress={() => setNoteInterest(call, note, 'not_interested')} />
              </View>
            </View>
          )) : null}
        </Card>
      ))}
    </ScrollView>
  )
}

function UploadsScreen({ user, onStudentAdded }) {
  const [kind, setKind] = useState('students')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const admin = userIsAdmin(user)

  const chooseCsv = async () => {
    setError('')
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled) return
      const selected = result.assets?.[0]
      if (!selected || !selected.name?.toLowerCase().endsWith('.csv')) throw new Error('Choose a .csv file.')
      setFile(selected)
      setPreview(null)
    } catch (requestError) { setError(errorMessage(requestError)) }
  }

  const upload = async (action) => {
    if (!file || loading) return
    setLoading(true)
    setError('')
    try {
      const teacher = kind === 'teachers'
      const route = teacher ? `/uploads/teachers/csv/${action}` : `/uploads/csv/${action}`
      const result = await api(route, { method: 'POST', file })
      if (action === 'preview') setPreview(result)
      else {
        setPreview(result)
        onStudentAdded()
      }
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setLoading(false) }
  }

  return (
    <ScrollView contentContainerStyle={styles.screenPad}>
      <SectionHeading title="Uploads" subtitle="Add student records or import a CSV file." />
      <View style={styles.modeTabs}>
        <ChoiceChip label="Students" selected={kind === 'students'} onPress={() => { setKind('students'); setFile(null); setPreview(null) }} />
        {admin ? <ChoiceChip label="Teacher accounts" selected={kind === 'teachers'} onPress={() => { setKind('teachers'); setFile(null); setPreview(null) }} /> : null}
      </View>
      <Card style={styles.uploadCard}>
        <View style={styles.uploadIcon}><Text style={styles.uploadIconText}>⇧</Text></View>
        <Text style={styles.cardTitle}>{kind === 'students' ? 'Import student records' : 'Provision teacher accounts'}</Text>
        <Text style={styles.mutedText}>CSV files are validated by the server before records are created.</Text>
        {file ? <Text style={styles.selectedFile}>Selected: {file.name}</Text> : null}
        <OutlineButton title={file ? 'Choose a different CSV' : 'Choose CSV file'} onPress={chooseCsv} />
        {file ? <ActionButton title="Preview file" onPress={() => upload('preview')} loading={loading} /> : null}
      </Card>
      {error ? <InlineError message={error} /> : null}
      {preview ? (
        <Card>
          <Text style={styles.cardTitle}>{preview.fileName || 'Import preview'}</Text>
          <View style={styles.metricGrid}>
            <MetricCard label="Rows" value={preview.totalRows ?? preview.total ?? 0} accent={colors.primary} />
            <MetricCard label="Valid" value={preview.validRows ?? preview.created ?? 0} accent={colors.green} />
            <MetricCard label="Issues" value={(preview.errors || preview.failedImports || []).length || preview.failed || 0} accent={colors.amber} />
          </View>
          {(preview.errors || []).slice(0, 8).map((item, index) => <Text key={index} style={styles.errorLine}>{typeof item === 'string' ? item : `Row ${item.row}: ${item.message}`}</Text>)}
          {preview.preview?.slice(0, 5).map((row, index) => <Text key={index} style={styles.previewLine}>{JSON.stringify(row)}</Text>)}
          {preview.importedCount === undefined && preview.created === undefined ? (
            <ActionButton title={kind === 'teachers' ? 'Import teacher accounts' : 'Import valid students'} onPress={() => upload('import')} loading={loading} />
          ) : (
            <Text style={styles.successText}>Import finished. {preview.importedCount ?? preview.created ?? 0} records created.</Text>
          )}
        </Card>
      ) : null}
      {kind === 'students' ? (
        <Card>
          <Text style={styles.cardTitle}>Add one student</Text>
          <Text style={styles.mutedText}>Use the Students tab and tap + for the full guided form.</Text>
        </Card>
      ) : null}
    </ScrollView>
  )
}

function SettingsScreen({ user, onLogout, showNotice }) {
  const [section, setSection] = useState('account')
  const [metrics, setMetrics] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [fields, setFields] = useState([])
  const [dbStatus, setDbStatus] = useState(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [fieldModal, setFieldModal] = useState(false)
  const [fieldEditing, setFieldEditing] = useState(null)
  const [teacherModal, setTeacherModal] = useState(false)
  const [fieldDraft, setFieldDraft] = useState({ key: '', label: '', type: 'text', options: '' })
  const [teacherDraft, setTeacherDraft] = useState({ name: '', email: '', phone: '', dateOfBirth: '1990-01-01', password: '' })
  const [provider, setProvider] = useState('local')
  const [databaseName, setDatabaseName] = useState('edustaff-connect')
  const [localDetection, setLocalDetection] = useState(null)
  const admin = userIsAdmin(user)

  const loadAdmin = useCallback(async () => {
    if (!admin) return
    setError('')
    try {
      const [metricData, teacherData, fieldData, status, local] = await Promise.all([
        api('/admin/metrics'),
        api('/admin/teachers'),
        api('/custom-fields', { query: { includeArchived: true } }),
        api('/admin/database/status'),
        api('/admin/database/local-detection'),
      ])
      setMetrics(metricData)
      setTeachers(teacherData)
      setFields(fieldData)
      setDbStatus(status)
      setProvider(status.provider || status.activeProvider || 'local')
      setLocalDetection(local)
    } catch (requestError) { setError(errorMessage(requestError)) }
  }, [admin])
  useEffect(() => { loadAdmin() }, [loadAdmin])

  const exportCsv = async () => {
    setWorking(true)
    setError('')
    try {
      const csv = await api('/contacts/export', { responseType: 'text' })
      const filePath = `${FileSystem.cacheDirectory}educonnect-students.csv`
      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 })
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export student records' })
      else showNotice(`CSV saved to ${filePath}`)
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setWorking(false) }
  }

  const createTeacher = async () => {
    setWorking(true)
    try {
      await api('/uploads/teachers/manual', { method: 'POST', body: teacherDraft })
      setTeacherModal(false)
      setTeacherDraft({ name: '', email: '', phone: '', dateOfBirth: '1990-01-01', password: '' })
      showNotice('Teacher account created.')
      loadAdmin()
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setWorking(false) }
  }

  const saveField = async () => {
    setWorking(true)
    try {
      const options = ['select', 'multi_select'].includes(fieldDraft.type)
        ? fieldDraft.options.split(',').map((label) => label.trim()).filter(Boolean).map((label) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label }))
        : []
      const definition = { key: fieldDraft.key, label: fieldDraft.label, type: fieldDraft.type, options, required: false, formVisible: true, tableVisible: true, importable: true, searchable: false, filterable: true, state: 'active' }
      if (fieldEditing) {
        await api(`/custom-fields/${fieldEditing._id}`, { method: 'PATCH', body: definition })
      } else {
        await api('/custom-fields', { method: 'POST', body: definition })
      }
      setFieldModal(false)
      setFieldEditing(null)
      setFieldDraft({ key: '', label: '', type: 'text', options: '' })
      showNotice(fieldEditing ? 'Custom field updated.' : 'Custom field created.')
      loadAdmin()
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setWorking(false) }
  }

  const changeFieldState = async (field) => {
    try {
      if (field.state === 'archived') await api(`/custom-fields/${field._id}/restore`, { method: 'POST' })
      else await api(`/custom-fields/${field._id}`, { method: 'PATCH', body: { state: 'archived' } })
      loadAdmin()
    } catch (requestError) { Alert.alert('Could not update field', errorMessage(requestError)) }
  }

  const databaseAction = async (action) => {
    setWorking(true)
    setError('')
    try {
      const result = action === 'status'
        ? await api('/admin/database/status')
        : action === 'test'
          ? await api('/admin/database/test', { method: 'POST', body: { provider, databaseName } })
          : await api('/admin/database/switch', { method: 'POST', body: { provider, databaseName } })
      if (action === 'status') setDbStatus(result)
      else if (action === 'switch') { setDbStatus(result.status || result); showNotice('Database provider switched.') }
      else showNotice(`Database connection verified${result.latencyMs ? ` in ${result.latencyMs} ms` : ''}.`)
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setWorking(false) }
  }

  const setupLocalDatabase = async () => {
    setWorking(true)
    setError('')
    try {
      const result = await api('/admin/database/setup-local', { method: 'POST' })
      showNotice(result.message || 'Local database setup finished.')
      await loadAdmin()
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setWorking(false) }
  }

  const deleteTeacher = (teacher) => Alert.alert('Remove teacher?', `${teacher.name}'s account will be removed and students unassigned.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await api(`/admin/teachers/${teacher.id || teacher._id}`, { method: 'DELETE' }); loadAdmin() }
      catch (requestError) { Alert.alert('Could not remove teacher', errorMessage(requestError)) }
    } },
  ])

  return (
    <ScrollView contentContainerStyle={styles.screenPad}>
      <SectionHeading title="Settings" subtitle="Your account, exports, and school administration." />
      {error ? <InlineError message={error} /> : null}
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{(user.name || 'U').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{user.name}</Text>
            <Text style={styles.mutedText}>{user.email}</Text>
            <Text style={styles.roleLabel}>{user.role === 'admin' ? 'ADMINISTRATOR' : 'TEACHER'}</Text>
          </View>
        </View>
        <OutlineButton title="Export student CSV" onPress={exportCsv} loading={working} />
        <ActionButton title="Sign out" variant="subtle" onPress={onLogout} />
      </Card>
      {admin ? (
        <>
          <SectionHeading title="Administrator tools" subtitle="These actions use protected school API routes." />
          <View style={styles.adminTabs}>
            {['Overview', 'Teachers', 'Fields', 'Database'].map((name) => <ChoiceChip key={name} label={name} selected={section === name.toLowerCase()} onPress={() => setSection(name.toLowerCase())} />)}
          </View>
          {section === 'account' || section === 'overview' ? (
            <Card>
              <Text style={styles.cardTitle}>School overview</Text>
              <View style={styles.metricGrid}>
                <MetricCard label="Students" value={metrics?.contactCount ?? '—'} accent={colors.primary} />
                <MetricCard label="Teachers" value={metrics?.teacherCount ?? '—'} accent={colors.sky} />
              </View>
              <OutlineButton title="Refresh admin data" onPress={loadAdmin} />
            </Card>
          ) : null}
          {section === 'teachers' ? (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Teacher accounts</Text>
                <Pressable onPress={() => setTeacherModal(true)}><Text style={styles.linkText}>＋ Add</Text></Pressable>
              </View>
              {teachers.map((teacher) => (
                <View key={teacher.id || teacher._id} style={styles.teacherRow}>
                  <View style={styles.flex}><Text style={styles.bodyText}>{teacher.name}</Text><Text style={styles.mutedText}>{teacher.email}</Text></View>
                  <Pressable onPress={() => deleteTeacher(teacher)}><Text style={styles.dangerLink}>Remove</Text></Pressable>
                </View>
              ))}
              <Text style={styles.helperText}>For bulk provisioning, use Uploads → Teacher accounts CSV.</Text>
            </Card>
          ) : null}
          {section === 'fields' ? (
            <Card>
              <View style={styles.rowBetween}><Text style={styles.cardTitle}>Custom student fields</Text>              <Pressable onPress={() => { setFieldEditing(null); setFieldDraft({ key: '', label: '', type: 'text', options: '' }); setFieldModal(true) }}><Text style={styles.linkText}>＋ Add</Text></Pressable></View>
              {fields.map((field) => (
                <View key={field._id} style={styles.teacherRow}>
                  <View style={styles.flex}><Text style={styles.bodyText}>{field.label}</Text><Text style={styles.mutedText}>{field.key} · {field.type} · {field.state}</Text></View>
                  <View style={styles.inlineActions}>
                    {field.state !== 'archived' ? <Pressable onPress={() => {
                      setFieldEditing(field)
                      setFieldDraft({ key: field.key, label: field.label, type: field.type, options: (field.options || []).map((option) => option.label).join(', ') })
                      setFieldModal(true)
                    }}><Text style={styles.linkText}>Edit</Text></Pressable> : null}
                    <Pressable onPress={() => changeFieldState(field)}><Text style={styles.linkText}>{field.state === 'archived' ? 'Restore' : 'Archive'}</Text></Pressable>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          {section === 'database' ? (
            <Card>
              <Text style={styles.cardTitle}>Database management</Text>
              <Text style={styles.mutedText}>Current provider: {dbStatus?.provider || dbStatus?.activeProvider || 'Loading…'}</Text>
              <Text style={styles.mutedText}>Connection: {dbStatus?.connected ? 'Connected' : dbStatus?.state || 'Status available from API'}</Text>
              <Text style={styles.mutedText}>Local MongoDB: {localDetection?.installed ? 'Installed' : localDetection?.available ? 'Available' : localDetection?.message || 'Not detected'}</Text>
              <Text style={styles.inputLabel}>Target provider</Text>
              <OptionChips values={['local', 'atlas']} value={provider} onChange={setProvider} />
              <Input label="Database name" value={databaseName} onChangeText={setDatabaseName} placeholder="edustaff-connect" />
              <OutlineButton title="Refresh status" onPress={() => databaseAction('status')} loading={working} />
              <OutlineButton title="Set up local MongoDB" onPress={setupLocalDatabase} loading={working} />
              <OutlineButton title="Test target connection" onPress={() => databaseAction('test')} loading={working} />
              <ActionButton title="Switch database provider" variant="warning" onPress={() => Alert.alert('Switch database?', `Switch to ${provider} / ${databaseName}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Switch', onPress: () => databaseAction('switch') }])} loading={working} />
            </Card>
          ) : null}
        </>
      ) : null}
      <Modal visible={teacherModal} transparent animationType="slide" onRequestClose={() => setTeacherModal(false)}>
        <View style={styles.modalScrim}><Card style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Add teacher</Text>
          <Input label="Full name" value={teacherDraft.name} onChangeText={(name) => setTeacherDraft({ ...teacherDraft, name })} />
          <Input label="Email" value={teacherDraft.email} onChangeText={(email) => setTeacherDraft({ ...teacherDraft, email })} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone" value={teacherDraft.phone} onChangeText={(phone) => setTeacherDraft({ ...teacherDraft, phone })} keyboardType="phone-pad" />
          <Input label="Date of birth (YYYY-MM-DD)" value={teacherDraft.dateOfBirth} onChangeText={(dateOfBirth) => setTeacherDraft({ ...teacherDraft, dateOfBirth })} />
          <Input label="Temporary password" value={teacherDraft.password} onChangeText={(password) => setTeacherDraft({ ...teacherDraft, password })} secureTextEntry />
          <ActionButton title="Create teacher account" onPress={createTeacher} loading={working} />
          <OutlineButton title="Cancel" onPress={() => setTeacherModal(false)} />
        </Card></View>
      </Modal>
      <Modal visible={fieldModal} transparent animationType="slide" onRequestClose={() => setFieldModal(false)}>
        <View style={styles.modalScrim}><Card style={styles.modalCard}>
          <Text style={styles.sectionTitle}>{fieldEditing ? 'Edit custom field' : 'Add custom field'}</Text>
          <Input label="Field ID" value={fieldDraft.key} onChangeText={(key) => setFieldDraft({ ...fieldDraft, key: key.toLowerCase().replace(/[^a-z0-9_]/g, '') })} placeholder="guardian_language" autoCapitalize="none" editable={!fieldEditing} />
          <Input label="Display label" value={fieldDraft.label} onChangeText={(label) => setFieldDraft({ ...fieldDraft, label })} placeholder="Guardian language" />
          <Text style={styles.inputLabel}>Field type</Text>
          <OptionChips values={['text', 'long_text', 'number', 'email', 'phone', 'date', 'select', 'multi_select', 'boolean', 'url']} value={fieldDraft.type} onChange={(type) => setFieldDraft({ ...fieldDraft, type })} />
          {['select', 'multi_select'].includes(fieldDraft.type) ? <Input label="Options (comma separated)" value={fieldDraft.options} onChangeText={(options) => setFieldDraft({ ...fieldDraft, options })} placeholder="English, Hindi, Tamil" /> : null}
          <ActionButton title="Create field" onPress={saveField} loading={working} />
          <OutlineButton title="Cancel" onPress={() => setFieldModal(false)} />
        </Card></View>
      </Modal>
    </ScrollView>
  )
}

function HistoryCard({ record }) {
  const kind = record.kind || record.type || 'activity'
  const title = kind === 'call' ? 'Call' : kind === 'sms' ? 'SMS message' : 'Note'
  return (
    <Card style={styles.historyCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.historyDate}>{formatDate(record.createdAt || record.startedAt)}</Text>
      </View>
      <Text style={styles.bodyText}>{record.summary || record.message || record.outcome || record.status || 'Communication recorded'}</Text>
      {record.initiatedBy ? <Text style={styles.mutedText}>By {record.initiatedBy.name || record.initiatedBy}</Text> : null}
    </Card>
  )
}

function MetricCard({ label, value, accent }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

function QuickAction({ title, subtitle, glyph, onPress }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.quickIcon}><Text style={styles.quickGlyph}>{glyph}</Text></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Pressable>
  )
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

function SectionHeading({ title, subtitle }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.mutedText}>{subtitle}</Text> : null}
    </View>
  )
}

function BackTitle({ title, onBack, right }) {
  return (
    <View style={styles.backTitle}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.flex} />
      {right}
    </View>
  )
}

function Input({ label, style, multiline, ...props }) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multilineInput, style]}
      />
    </View>
  )
}

function ActionButton({ title, onPress, loading = false, disabled = false, compact = false, variant = 'primary' }) {
  const buttonStyle = variant === 'warning' ? styles.warningButton : variant === 'subtle' ? styles.subtleButton : styles.primaryButton
  const textStyle = variant === 'subtle' ? styles.subtleButtonText : styles.buttonText
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, buttonStyle, compact && styles.compactButton, (pressed || disabled) && styles.buttonDisabled]}
    >
      {loading ? <ActivityIndicator color={variant === 'subtle' ? colors.primary : colors.white} /> : <Text style={textStyle}>{title}</Text>}
    </Pressable>
  )
}

function OutlineButton({ title, onPress, disabled = false, loading = false, compact = false }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.outlineButton, compact && styles.compactOutline, (disabled || pressed) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.outlineButtonText}>{title}</Text>}
    </Pressable>
  )
}

function ChoiceChip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceChip, selected && styles.choiceChipSelected]}>
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

function OptionChips({ values, value, onChange }) {
  return (
    <View style={styles.chipWrap}>
      {values.map((item) => <ChoiceChip key={item} label={item} selected={String(value) === String(item)} onPress={() => onChange(value === item ? '' : item)} />)}
    </View>
  )
}

function InlineError({ message }) {
  return <View style={styles.errorBox}><Text style={styles.errorText}>{message}</Text></View>
}

function EmptyState({ title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>⌕</Text></View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </View>
  )
}

function StatusBadge({ label }) {
  const tone = label === 'attended' ? styles.badgeGreen : ['missed', 'no-answer', 'busy'].includes(label) ? styles.badgeAmber : styles.badgeBlue
  return <View style={[styles.badge, tone]}><Text style={styles.badgeText}>{String(label).replace('-', ' ')}</Text></View>
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  )
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.canvas },
  fullScreen: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1 },
  centered: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 18 },
  authShell: { flex: 1, backgroundColor: '#EAF2FF' },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingTop: 46, paddingBottom: 36 },
  authBrand: { marginBottom: 24 },
  authEyebrow: { fontSize: 11, letterSpacing: 2, color: colors.primary, fontWeight: '800', marginTop: 22 },
  authTitle: { fontSize: 38, lineHeight: 43, color: colors.ink, fontWeight: '800', marginTop: 8, letterSpacing: -1 },
  authSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 310 },
  authCard: { padding: 22 },
  authSwitch: { color: colors.primary, textAlign: 'center', fontWeight: '700', marginTop: 18, fontSize: 13 },
  authFootnote: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 20 },
  brandMark: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
  brandMarkText: { color: colors.white, fontSize: 28, fontWeight: '900' },
  brandMarkSmall: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandMarkTextSmall: { color: colors.white, fontSize: 22, fontWeight: '900' },
  header: { minHeight: 66, paddingHorizontal: 18, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBrand: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  headerCaption: { color: colors.muted, fontSize: 8, letterSpacing: 1.3, marginTop: 2, fontWeight: '700' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: '800' },
  tabBar: { backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingBottom: Platform.OS === 'android' ? 8 : 20, paddingTop: 8 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabGlyph: { color: '#94A3B8', fontSize: 21, height: 24, fontWeight: '700' },
  tabGlyphActive: { color: colors.primary },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  tabLabelActive: { color: colors.primary, fontWeight: '800' },
  screenPad: { padding: 18, paddingBottom: 35, gap: 12 },
  greetingBlock: { backgroundColor: colors.white, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.border },
  eyebrow: { color: colors.primary, letterSpacing: 1.5, fontSize: 10, fontWeight: '800' },
  heroTitle: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  heroSub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  sectionHeading: { marginTop: 7, marginBottom: 2, gap: 4 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  mutedText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  metricGrid: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' },
  metricCard: { flex: 1, minWidth: 100, backgroundColor: colors.white, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  metricAccent: { height: 3, width: 28, borderRadius: 2, marginBottom: 10 },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { width: '48%', minHeight: 132, backgroundColor: colors.white, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 34, height: 34, backgroundColor: '#EFF6FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  quickGlyph: { color: colors.primary, fontSize: 21, fontWeight: '800' },
  quickTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  quickSubtitle: { color: colors.muted, fontSize: 11, marginTop: 5, lineHeight: 16 },
  infoBanner: { backgroundColor: '#E7F0FF', padding: 18, borderRadius: 18, marginTop: 3 },
  infoBannerTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  infoBannerText: { color: '#355783', fontSize: 12, lineHeight: 18, marginTop: 5 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, marginBottom: 0 },
  primarySquare: { height: 48, width: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: colors.white, fontSize: 30, lineHeight: 32, fontWeight: '300' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { paddingHorizontal: 12, minHeight: 32, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  choiceChipSelected: { backgroundColor: '#EAF2FF', borderColor: '#9CC1FF' },
  choiceChipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  choiceChipTextSelected: { color: colors.primaryDark },
  contactCard: { backgroundColor: colors.white, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 12 },
  contactCardSelected: { borderColor: colors.primary, backgroundColor: '#F6FAFF' },
  contactCardMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  contactAvatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#E0ECFF', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontSize: 17, color: colors.primaryDark, fontWeight: '800' },
  contactInfo: { flex: 1, minWidth: 0 },
  contactName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  contactSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  contactPhone: { color: '#49637F', fontSize: 11, marginTop: 4 },
  chevron: { color: '#94A3B8', fontSize: 25, marginHorizontal: 4 },
  assignedLabel: { color: colors.violet, fontSize: 10, marginTop: 7, marginLeft: 55, fontWeight: '700' },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 5 },
  checkText: { color: colors.primary, fontWeight: '900' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  pagerActions: { flexDirection: 'row', gap: 7 },
  loader: { padding: 28 },
  emptyState: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 26, borderRadius: 18, borderWidth: 1, borderColor: colors.border, gap: 6 },
  emptyIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyGlyph: { color: colors.primary, fontSize: 26 },
  inputWrap: { marginBottom: 9 },
  inputLabel: { fontSize: 12, color: colors.ink, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: '#FBFDFF', paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, fontSize: 14 },
  multilineInput: { minHeight: 92, textAlignVertical: 'top' },
  actionButton: { minHeight: 47, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, marginTop: 4 },
  primaryButton: { backgroundColor: colors.primary },
  warningButton: { backgroundColor: colors.amber },
  subtleButton: { backgroundColor: '#EEF4FF' },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  subtleButtonText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13 },
  buttonDisabled: { opacity: 0.55 },
  compactButton: { minHeight: 38, marginTop: 0, paddingHorizontal: 13, flexGrow: 0, alignSelf: 'flex-start' },
  outlineButton: { minHeight: 43, borderRadius: 13, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 3 },
  compactOutline: { minHeight: 36, marginTop: 0, paddingHorizontal: 11, alignSelf: 'flex-start' },
  outlineButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 },
  errorBox: { borderRadius: 13, backgroundColor: colors.redSoft, padding: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: colors.red, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  notice: { backgroundColor: colors.greenSoft, color: colors.green, padding: 10, paddingHorizontal: 18, fontSize: 12, fontWeight: '700' },
  backTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  backButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { color: colors.primary, fontSize: 30, lineHeight: 32, marginTop: -4 },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailHero: { alignItems: 'center', paddingVertical: 22 },
  detailAvatar: { width: 68, height: 68, borderRadius: 23, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  detailAvatarText: { color: colors.primaryDark, fontWeight: '900', fontSize: 27 },
  detailName: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 9 },
  detailPhone: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 8 },
  detailActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  consentText: { color: colors.muted, fontSize: 10, maxWidth: 125 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, marginTop: 5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7', paddingVertical: 8 },
  detailLabel: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  detailValue: { color: colors.ink, fontSize: 12, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  historyCard: { gap: 6 },
  historyDate: { color: colors.muted, fontSize: 10 },
  bodyText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  badgeGreen: { backgroundColor: colors.greenSoft },
  badgeAmber: { backgroundColor: colors.amberSoft },
  badgeBlue: { backgroundColor: '#DBEAFE' },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.ink, textTransform: 'capitalize' },
  outcomeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  callNote: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 },
  noteText: { color: colors.muted, fontStyle: 'italic', fontSize: 12, marginTop: 5 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(15, 23, 42, .42)', justifyContent: 'flex-end', padding: 10 },
  modalCard: { maxHeight: '90%', borderRadius: 22, padding: 20 },
  helperText: { color: colors.muted, fontSize: 10, marginTop: -6 },
  dangerLink: { color: colors.red, fontSize: 12, fontWeight: '800' },
  linkText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  modeTabs: { flexDirection: 'row', gap: 8 },
  uploadCard: { alignItems: 'center', padding: 21 },
  uploadIcon: { width: 55, height: 55, borderRadius: 19, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  uploadIconText: { color: colors.primary, fontSize: 32, fontWeight: '500' },
  selectedFile: { color: colors.primaryDark, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  errorLine: { color: colors.red, fontSize: 11, lineHeight: 16 },
  previewLine: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatarLarge: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { color: colors.primaryDark, fontSize: 23, fontWeight: '900' },
  roleLabel: { color: colors.primary, fontWeight: '900', fontSize: 9, letterSpacing: 1.1, marginTop: 4 },
  adminTabs: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingVertical: 10 },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.78 },
})
