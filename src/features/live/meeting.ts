import type { Locale } from '../../../shared/portal'

export function isZoomMeetingUrl(value: string): boolean {
  if (!value.trim() || value.trim().length > 2000) return false
  try {
    const url = new URL(value.trim())
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us')) &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      /^\/(j|my)\//.test(url.pathname)
    )
  } catch {
    return false
  }
}

export function zoomMeetingUrlError(locale: Locale): string {
  return locale === 'vi'
    ? 'Nhập liên kết HTTPS của zoom.us hoặc tên miền con Zoom, có đường dẫn /j/ hoặc /my/. Không dùng liên kết chứa tên đăng nhập, mật khẩu tài khoản hoặc cổng tùy chỉnh.'
    : 'Enter an HTTPS link on zoom.us or a Zoom subdomain, with a /j/ or /my/ path. Links cannot contain account credentials or a custom port.'
}
