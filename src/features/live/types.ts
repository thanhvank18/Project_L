import type { ActionResult, LiveState, Locale } from '../../../shared/portal'
import { PortalApiError } from '@/features/auth/client'

export interface LiveViewProps {
  state: LiveState
  locale: Locale
  run: (type: string, payload: Record<string, unknown>) => Promise<ActionResult>
  refresh: () => Promise<void>
}

export function errorMessage(error: unknown, locale: Locale): string {
  const vi = locale === 'vi'
  if (error instanceof PortalApiError) {
    if (error.status === 409)
      return vi
        ? 'Dữ liệu đã thay đổi hoặc thông tin đã tồn tại. Tải lại danh sách và kiểm tra trước khi lưu; nội dung bạn nhập vẫn được giữ.'
        : 'The record changed or already exists. Refresh and check it before saving; your input has been kept.'
    if (error.status === 400 || error.status === 422)
      return vi
        ? 'Thông tin chưa hợp lệ. Kiểm tra các trường bắt buộc, ngày giờ và tài khoản được chọn.'
        : 'Some information is invalid. Check required fields, dates and selected accounts.'
    if (error.status === 403)
      return vi
        ? 'Bạn không có quyền thực hiện thao tác này hoặc chưa đủ điều kiện truy cập.'
        : 'You do not have permission or have not met the access requirements.'
    if (error.status === 404)
      return vi
        ? 'Nội dung không còn khả dụng. Hãy tải lại danh sách.'
        : 'This content is no longer available. Refresh the list.'
    if (error.status === 429)
      return vi
        ? 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.'
        : 'Too many attempts. Please wait and try again.'
    if (error.status === 401)
      return vi
        ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
        : 'Your session expired. Sign in again to continue.'
  }
  return vi
    ? 'Chưa lưu được dữ liệu trên máy chủ. Giữ nội dung đang nhập và thử lại khi có kết nối.'
    : 'Could not save to the server. Keep your input and retry when the connection is available.'
}
