import { useState } from 'react'
import { Upload, UserPlus, FileText, AlertCircle, CheckCircle, Download, X } from 'lucide-react'
import api from '../../services/api'
import TeacherUpload from './TeacherUpload'
import { STUDENT_ADMISSION_TYPES as ADMISSION_TYPE_OPTIONS, departmentsForAdmissionType } from '../../../shared/studentOptions.js'

const STUDENT_CSV_HEADERS = 'Student Name,Admission Type,Department,Parent/Guardian Phone,Notes'

function downloadStudentTemplate() {
  const csv = `${STUDENT_CSV_HEADERS}\n"Arun Kumar","Regular","CSE","9876543210","Sample record"\n"Karthik Raj","Part Time","EEE","9988776655","Sample record"\n`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = 'educonnect-students-template.csv'; link.click(); URL.revokeObjectURL(url)
}

export default function StudentUpload({ onSuccess, onCancel, user }) {
  const [accountType, setAccountType] = useState('student')
  const [activeTab, setActiveTab] = useState('manual') // 'manual' or 'csv'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  
  // Manual form state
  const [formData, setFormData] = useState({
    studentName: '',
    admissionType: '',
    department: '',
    guardianPhone: '',
    notes: '',
  })

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)
  const [csvErrors, setCsvErrors] = useState([])
  const canBulkUpload = Boolean(user?.permissions?.canBulkUpload)
  const departmentOptions = departmentsForAdmissionType(formData.admissionType)

  // Handle manual form input change
  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'admissionType' && !departmentsForAdmissionType(value).includes(prev.department)
        ? { department: '' }
        : {}),
    }))
    if (errors.includes(name)) {
      setErrors(prev => prev.filter(err => err !== name))
    }
  }

  // Validate manual form
  const validateManualForm = () => {
    const newErrors = []
    if (!formData.studentName.trim()) newErrors.push('studentName')
    if (!ADMISSION_TYPE_OPTIONS.includes(formData.admissionType)) newErrors.push('admissionType')
    if (!departmentsForAdmissionType(formData.admissionType).includes(formData.department)) newErrors.push('department')
    if (!formData.guardianPhone.trim()) newErrors.push('guardianPhone')
    setErrors(newErrors)
    return newErrors.length === 0
  }

  // Handle manual form submission
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!validateManualForm()) return

    setLoading(true)
    setErrors([])
    setSuccessMessage('')

    try {
      const response = await api.post('/uploads/manual', formData)
      setSuccessMessage('Student added successfully!')
      setFormData({
        studentName: '',
        admissionType: '',
        department: '',
        guardianPhone: '',
        notes: '',
      })
      if (onSuccess) onSuccess(response.data.contact)
    } catch (error) {
      setErrors(error.response?.data?.errors || ['Failed to add student'])
    } finally {
      setLoading(false)
    }
  }

  // Handle CSV file selection
  const handleCsvSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setCsvFile(file)
    setCsvErrors([])
    setCsvPreview(null)
    setSuccessMessage('')
  }

  // Preview CSV
  const handleCsvPreview = async () => {
    if (!csvFile) return

    setLoading(true)
    setCsvErrors([])

    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      const response = await api.post('/uploads/csv/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCsvPreview(response.data)
      if (response.data.errors?.length > 0) {
        setCsvErrors(response.data.errors)
      }
    } catch (error) {
      setCsvErrors([error.response?.data?.message || 'Failed to preview CSV'])
    } finally {
      setLoading(false)
    }
  }

  // Import CSV
  const handleCsvImport = async () => {
    if (!csvFile) return

    setLoading(true)
    setCsvErrors([])

    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      const response = await api.post('/uploads/csv/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const failedImports = response.data.failedImports || []
      setSuccessMessage(
        `Imported ${response.data.importedCount} student${response.data.importedCount === 1 ? '' : 's'}${failedImports.length ? `; ${failedImports.length} failed` : ''}.`
      )
      setCsvErrors(failedImports)
      if (onSuccess) onSuccess(null)
    } catch (error) {
      setCsvErrors([error.response?.data?.message || 'Failed to import CSV'])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel mx-auto w-full max-w-4xl rounded-2xl border p-4 shadow-glass sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-black text-slate-900 sm:text-2xl">{accountType === 'teacher' ? 'Teacher Upload' : 'Student Upload'}</h2>
        {onCancel && (
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X size={24} />
          </button>
        )}
      </div>

      {user?.role === 'admin' && <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setAccountType('student')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${accountType === 'student' ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}>Student Upload</button><button onClick={() => setAccountType('teacher')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${accountType === 'teacher' ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}>Teacher Upload</button></div>}

      {accountType === 'teacher' ? <TeacherUpload onSuccess={onSuccess} /> : <>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
          <CheckCircle size={20} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200/70 sm:gap-4">
        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-3 px-2 font-bold transition ${
            activeTab === 'manual'
              ? 'text-blue-700 border-b-2 border-blue-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex min-h-11 items-center gap-2">
            <UserPlus size={18} />
            Manual Entry
          </div>
        </button>
        {canBulkUpload && <button
          onClick={() => setActiveTab('csv')}
          className={`pb-3 px-2 font-bold transition ${
            activeTab === 'csv'
              ? 'text-blue-700 border-b-2 border-blue-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex min-h-11 items-center gap-2">
            <Upload size={18} />
            CSV Upload
          </div>
        </button>}
      </div>

      {/* Manual Entry Form */}
      {activeTab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">
                Student Name *
              </label>
              <input
                type="text"
                name="studentName"
                value={formData.studentName}
                onChange={handleFormChange}
                className={`w-full h-11 rounded-xl border px-4 bg-white/65 outline-none text-sm font-bold transition ${
                  errors.includes('studentName')
                    ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-slate-300/70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="John Doe"
              />
              {errors.includes('studentName') && (
                <p className="text-xs font-bold text-red-600 mt-1">Student name is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">
                Admission Type *
              </label>
              <select
                name="admissionType"
                value={formData.admissionType}
                onChange={handleFormChange}
                className={`w-full h-11 rounded-xl border px-4 bg-white/65 outline-none text-sm font-bold transition ${
                  errors.includes('admissionType')
                    ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-slate-300/70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              >
                <option value="">Select Admission Type</option>
                {ADMISSION_TYPE_OPTIONS.map((admissionType) => (
                  <option key={admissionType} value={admissionType}>{admissionType}</option>
                ))}
              </select>
              {errors.includes('admissionType') && (
                <p className="text-xs font-bold text-red-600 mt-1">Admission type is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">
                Department *
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleFormChange}
                className={`w-full h-11 rounded-xl border px-4 bg-white/65 outline-none text-sm font-bold transition ${
                  errors.includes('department')
                    ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-slate-300/70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              >
                <option value="">Select Department</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              {errors.includes('department') && (
                <p className="text-xs font-bold text-red-600 mt-1">Department is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">
                Parent/Guardian Phone *
              </label>
              <input
                type="tel"
                name="guardianPhone"
                value={formData.guardianPhone}
                onChange={handleFormChange}
                className={`w-full h-11 rounded-xl border px-4 bg-white/65 outline-none text-sm font-bold transition ${
                  errors.includes('guardianPhone')
                    ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-slate-300/70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="+1 555-123-4567"
              />
              {errors.includes('guardianPhone') && (
                <p className="text-xs font-bold text-red-600 mt-1">Parent/Guardian phone is required</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              rows={3}
              className="w-full rounded-xl border border-slate-300/70 bg-white/65 px-4 py-3 outline-none text-sm font-bold transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-black bg-blue-700 text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-all disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Student'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 rounded-xl px-6 font-bold text-slate-700 border border-slate-300/70 bg-white/65 hover:bg-white/80 transition sm:px-6"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* CSV Upload */}
      {activeTab === 'csv' && canBulkUpload && (
        <div className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-slate-300/70 rounded-2xl p-4 text-center bg-white/40 sm:p-8">
            {!csvFile ? (
              <>
                <FileText size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-bold text-slate-700 mb-2">
                  Upload a CSV file
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  Required columns: Student Name, Admission Type, Department, Parent/Guardian Phone, Notes
                  <br />
                  Admission Type: Regular, Lateral Entry, or Part Time. Part Time allows only EEE or Mech.
                  <br />
                  Departments: CSE, Civil, AI/ML, Mech, ECE, EEE, or Automobile.
                </p>
                <label className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl px-6 font-black bg-blue-700 text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-all cursor-pointer">
                  <Upload size={18} />
                  Select File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvSelect}
                    className="hidden"
                  />
                </label>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <FileText size={32} className="text-blue-700" />
                  <div className="min-w-0 max-w-[calc(100%-5rem)] text-left">
                    <p className="truncate font-bold text-slate-900">{csvFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(csvFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCsvFile(null)
                      setCsvPreview(null)
                      setCsvErrors([])
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                {!csvPreview ? (
                  <button
                    onClick={handleCsvPreview}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl px-6 font-black bg-blue-700 text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Previewing...' : 'Preview CSV'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    {/* Preview Stats */}
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-center sm:gap-4">
                      <div className="text-center p-3 bg-slate-100 rounded-xl">
                        <p className="text-2xl font-black text-blue-700">
                          {csvPreview.totalRows}
                        </p>
                        <p className="text-xs font-bold text-slate-600">Total Rows</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-xl">
                        <p className="text-2xl font-black text-green-700">
                          {csvPreview.validRows}
                        </p>
                        <p className="text-xs font-bold text-slate-600">Valid Rows</p>
                      </div>
                    </div>

                    {/* Preview Table */}
                    {csvPreview.preview?.length > 0 && (
                      <div className="overflow-x-auto">
                        <p className="text-sm font-black text-slate-700 mb-2">Preview:</p>
                        <table className="w-full text-sm border border-slate-200/70 rounded-xl overflow-hidden">
                          <thead className="bg-slate-100">
                            <tr>
                              {Object.keys(csvPreview.preview[0]).map(col => (
                                <th key={col} className="px-3 py-2 text-left font-black text-slate-700">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70">
                            {csvPreview.preview.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="bg-white/45">
                                {Object.values(row).map((val, i) => (
                                  <td key={i} className="px-3 py-2 text-slate-900 font-bold">
                                    {val}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {csvPreview.preview.length > 5 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Showing first 5 of {csvPreview.preview.length} rows
                          </p>
                        )}
                      </div>
                    )}

                    {/* Errors */}
                    {csvErrors.length > 0 && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={18} className="text-red-600" />
                          <p className="font-bold text-red-700">
                            {csvErrors.length} error(s) found:
                          </p>
                        </div>
                        <ul className="list-disc list-inside text-sm text-red-700">
                          {csvErrors.slice(0, 10).map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                          {csvErrors.length > 10 && (
                            <li>... and {csvErrors.length - 10} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Import Button */}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
                      <button
                        onClick={() => {
                          setCsvFile(null)
                          setCsvPreview(null)
                          setCsvErrors([])
                        }}
                        className="min-h-11 rounded-xl px-6 font-bold text-slate-700 border border-slate-300/70 bg-white/65 hover:bg-white/80 transition"
                      >
                        Choose Another File
                      </button>
                      <button
                        onClick={handleCsvImport}
                        disabled={loading || csvPreview.validRows === 0}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 font-black bg-green-700 text-white shadow-lg shadow-green-700/20 hover:bg-green-800 transition-all disabled:opacity-50"
                      >
                        {loading ? 'Importing...' : 'Import Students'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CSV Error Display */}
          {csvErrors.length > 0 && !csvPreview && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={18} className="text-red-600" />
                <p className="font-bold text-red-700">Error:</p>
              </div>
              <ul className="list-disc list-inside text-sm text-red-700">
                {csvErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sample CSV Template */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200/70">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-700">Sample CSV Format:</p><button type="button" onClick={downloadStudentTemplate} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"><Download size={14} /> Download template</button></div>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
              Student Name,Admission Type,Department,Parent/Guardian Phone,Notes
              <br />
              "Arun Kumar","Regular","CSE","9876543210","Sample record"
              <br />
              "Karthik Raj","Part Time","EEE","9988776655",""
            </pre>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}

