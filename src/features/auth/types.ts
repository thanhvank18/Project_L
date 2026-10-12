export type PortalRole = 'student' | 'teacher' | 'assistant' | 'admin'

export interface PortalUser {
  id: string
  name: string
  email: string
  backendRole: string
}

export interface PortalSession {
  mode: 'authenticated' | 'preview'
  user: PortalUser
  role: PortalRole
}

export type PortalSessionStatus = 'loading' | 'signed-out' | 'ready' | 'error' | 'unsupported'
