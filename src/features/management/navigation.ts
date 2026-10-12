import type { PortalRole } from '../learning/types.ts'
import type { ManagementSection } from './types.ts'
export const roleSections: Record<PortalRole, readonly ManagementSection[]> = {
  student: [
    'overview',
    'courses',
    'schedule',
    'syllabus',
    'materials',
    'assignments',
    'attendance',
    'reports',
    'notebook',
    'notifications',
    'settings',
  ],
  teacher: [
    'overview',
    'students',
    'courses',
    'attendance',
    'syllabus',
    'schedule',
    'materials',
    'assignments',
    'grading',
    'reports',
    'notifications',
    'settings',
  ],
  assistant: [
    'overview',
    'students',
    'courses',
    'attendance',
    'schedule',
    'materials',
    'assignments',
    'notifications',
    'settings',
  ],
  admin: [
    'overview',
    'students',
    'courses',
    'attendance',
    'syllabus',
    'schedule',
    'materials',
    'assignments',
    'grading',
    'reports',
    'notifications',
    'users',
    'settings',
  ],
}
export function sectionForPath(path: string): string {
  if (path === 'notebook/practice') return 'notebook'
  if (path === 'courses/open') return 'courses'
  if (path === 'schedule/consultations') return 'schedule'
  return path.startsWith('assignment/') ? 'assignments' : path
}
export function canViewPath(role: PortalRole, path: string): boolean {
  if (path.startsWith('assignment/')) return role === 'student'
  return roleSections[role].some((section) => section === sectionForPath(path))
}
