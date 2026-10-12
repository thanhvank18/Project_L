import { vercelConfiguration } from './deploy/vercel-config.ts'

// Only the public backend origin belongs on Vercel. Provider keys stay on Railway.
export const config = vercelConfiguration(process.env.PORTAL_API_ORIGIN)
