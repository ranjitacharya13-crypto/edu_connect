export const STUDENT_ADMISSION_TYPES = Object.freeze(['Regular', 'Lateral Entry', 'Part Time'])
export const STUDENT_DEPARTMENT_OPTIONS = Object.freeze(['CSE', 'Civil', 'AI/ML', 'Mech', 'ECE', 'EEE', 'Automobile'])
export const PART_TIME_DEPARTMENT_OPTIONS = Object.freeze(['EEE', 'Mech'])

export function canonicalStudentOption(value, options) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return options.find((option) => option.toLowerCase() === normalized) || ''
}

export function departmentsForAdmissionType(admissionType) {
  const canonicalAdmissionType = canonicalStudentOption(admissionType, STUDENT_ADMISSION_TYPES)
  if (!canonicalAdmissionType) return []
  return canonicalAdmissionType === 'Part Time' ? PART_TIME_DEPARTMENT_OPTIONS : STUDENT_DEPARTMENT_OPTIONS
}

export function canonicalAdmissionType(value) {
  return canonicalStudentOption(value, STUDENT_ADMISSION_TYPES)
}

export function canonicalDepartment(value, admissionType) {
  return canonicalStudentOption(value, departmentsForAdmissionType(admissionType))
}

