export interface DriveFolder {
  id: string
  name: string
}

/** Sanitized administrator-only state. Provider credentials never cross this boundary. */
export interface DriveConnectionStatus {
  configured: boolean
  portalOrigin?: string
  connected: boolean
  uploadEnabled: boolean
  authRequired?: boolean
  previousFilesUnavailable: boolean
  version: number
  account: { email: string; name: string } | null
  folder: DriveFolder | null
}

export interface DriveFolderPage {
  folders: DriveFolder[]
  nextPageToken: string | null
}

export interface DriveAuthorization {
  authorizationUrl: string
}
