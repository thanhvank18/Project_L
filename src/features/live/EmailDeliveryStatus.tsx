import { useCallback, useEffect, useState } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react'
import { apiRequest } from '@/features/auth/client'
import type { Locale } from '../../../shared/portal'

interface EmailStatus {
  enabled: boolean
  configured: boolean
  provider: 'disabled' | 'resend'
  initialized: boolean
  delivery: 'disabled' | 'ready' | 'unconfigured'
  counts: Record<'scheduled' | 'pending' | 'sent' | 'failed' | 'cancelled', number>
  nextDueAt: string | null
}
export function EmailDeliveryStatus({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [busy, setBusy] = useState(true)
  const [failed, setFailed] = useState(false)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const load = useCallback(
    (signal?: AbortSignal) =>
      apiRequest<EmailStatus>('portal/email-status', { signal })
        .then((result) => {
          if (!signal?.aborted) setStatus(result)
        })
        .catch(() => {
          if (!signal?.aborted) setFailed(true)
        })
        .finally(() => {
          if (!signal?.aborted) setBusy(false)
        }),
    [],
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  return (
    <section className="mis-panel mis-stack">
      <div className="live-heading">
        <h2>{t('Hàng đợi email', 'Email queue')}</h2>
        <button
          className="mis-button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setFailed(false)
            void load()
          }}
        >
          <ArrowClockwise size={17} aria-hidden="true" />
          {t('Làm mới', 'Refresh')}
        </button>
      </div>
      {busy && (
        <p role="status">{t('Đang kiểm tra trạng thái gửi…', 'Checking delivery status…')}</p>
      )}
      {failed && (
        <p role="alert" className="mis-error">
          {t(
            'Chưa đọc được trạng thái email. Hãy thử làm mới.',
            'Email status is unavailable. Try refreshing.',
          )}
        </p>
      )}
      {status && (
        <>
          <p>
            {status.delivery === 'ready'
              ? t(
                  'Đã bật gửi email qua dịch vụ được cấu hình.',
                  'Email delivery is enabled with the configured service.',
                )
              : t(
                  'Chưa bật gửi email. Hàng đợi được lưu; chưa có email nào được gửi bởi cấu hình hiện tại.',
                  'Email delivery is disabled. The queue is stored; this configuration sends no emails.',
                )}
          </p>
          <dl className="live-integration-list">
            {(['scheduled', 'pending', 'sent', 'failed', 'cancelled'] as const).map((key) => (
              <div key={key}>
                <dt>
                  {
                    {
                      scheduled: t('Đã lên lịch', 'Scheduled'),
                      pending: t('Đang xử lý', 'Processing'),
                      sent: t('Dịch vụ đã nhận', 'Accepted by provider'),
                      failed: t('Gửi chưa thành công', 'Failed'),
                      cancelled: t('Đã hủy / hết hiệu lực', 'Cancelled / expired'),
                    }[key]
                  }
                </dt>
                <dd>{status.counts[key]}</dd>
              </div>
            ))}
          </dl>
          <p className="live-help">
            {t(
              '“Dịch vụ đã nhận” chưa xác nhận thư vào hộp thư. Quản trị viên kỹ thuật cần cấu hình người gửi, dịch vụ email và địa chỉ website HTTPS trước khi bật gửi.',
              '“Accepted by provider” does not confirm inbox delivery. A technical administrator must configure the sender, email provider and HTTPS website origin before enabling delivery.',
            )}
          </p>
        </>
      )}
    </section>
  )
}
