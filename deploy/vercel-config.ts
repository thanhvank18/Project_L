/** Build-time routing only; this module is never imported by the browser. */
export function vercelConfiguration(apiOrigin?: string) {
  const rewrites: { source: string; destination: string }[] = []
  if (apiOrigin?.trim()) {
    let url: URL
    try {
      url = new URL(apiOrigin.trim())
    } catch {
      throw new Error('PORTAL_API_ORIGIN must be the public HTTPS backend origin.')
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(url.hostname) ||
      /(?:^|\.)(?:localhost|local|internal)$/i.test(url.hostname)
    )
      throw new Error(
        'PORTAL_API_ORIGIN must be a public HTTPS origin without credentials or a path.',
      )
    rewrites.push(
      { source: '/api/v1', destination: `${url.origin}/api/v1` },
      { source: '/api/v1/:path*', destination: `${url.origin}/api/v1/:path*` },
    )
  }
  // Exact SPA routes preserve real 404 responses for missing APIs and assets.
  for (const route of ['vi', 'en', 'login', 'learn', 'dashboard', 'courses', 'studio-demo'])
    rewrites.push({ source: `/${route}`, destination: '/index.html' })
  return {
    framework: 'vite',
    installCommand: 'npx --yes pnpm@11.25.0 install --frozen-lockfile',
    buildCommand: 'npx --yes pnpm@11.25.0 build',
    outputDirectory: 'dist',
    trailingSlash: false,
    rewrites,
    headers: [
      {
        source: '/api/v1/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ],
  }
}
