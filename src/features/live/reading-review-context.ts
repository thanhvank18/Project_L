import { createContext } from 'react'

/** Private review flags share the workbench's versioned save and conflict handling. */
export const ReadingReviewContext = createContext<{
  assignmentVersion: number
  flagged: string[]
  disabled: boolean
  onChange: (flagged: string[]) => void
} | null>(null)
