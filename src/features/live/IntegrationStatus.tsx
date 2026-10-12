import { useCallback, useEffect, useState } from 'react'
import type { SpeakingConfigurationSummary } from '../../../shared/speaking'
import type { Locale } from '../../../shared/portal'
import { apiRequest } from '@/features/auth/client'

interface Status {
  speaking: SpeakingConfigurationSummary & { keyConfigured: boolean }
  emailEnabled: boolean
  vocabularyAI: boolean
}
export function IntegrationStatus({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const load = useCallback((signal?: AbortSignal) => {
    return apiRequest<Status>('portal/integration-status', { signal })
      .then((value) => {
        if (!signal?.aborted) setStatus(value)
      })
      .catch(() => {
        if (!signal?.aborted) setFailed(true)
      })
      .finally(() => {
        if (!signal?.aborted) setBusy(false)
      })
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  return (
    <section className="mis-panel mis-stack">
      <div className="live-heading">
        <h2>{t('Dịch vụ kết nối', 'Connected services')}</h2>
        <button
          type="button"
          className="mis-button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setFailed(false)
            void load()
          }}
        >
          {t('Làm mới trạng thái', 'Refresh status')}
        </button>
      </div>
      {busy && <p role="status">{t('Đang đọc trạng thái dịch vụ…', 'Loading service status…')}</p>}
      {failed && (
        <p role="alert" className="live-error">
          {t(
            'Chưa kiểm tra được trạng thái hiện tại. Hãy thử lại.',
            'Current service status is unavailable. Try again.',
          )}
        </p>
      )}
      {status && !failed && (
        <dl className="live-integration-list">
          <div>
            <dt>Zoom</dt>
            <dd>
              {t(
                'Quản trị viên, giáo viên hoặc trợ giảng nhập link dùng chung cho lớp hoặc riêng từng buổi tại Thời khóa biểu.',
                'Administrators, teachers or assistants enter shared class links or individual session links in Timetable.',
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Email nhắc lịch', 'Email reminders')}</dt>
            <dd>
              {status.emailEnabled
                ? t(
                    'Đã bật bộ gửi. Trạng thái dịch vụ nhận thư và hộp thư đến cần kiểm tra riêng.',
                    'Delivery worker is enabled. Provider acceptance and inbox delivery require separate checks.',
                  )
                : t(
                    'Chưa bật gửi email. Thông báo trong cổng học vẫn hoạt động.',
                    'Email delivery is disabled. In-portal notifications remain available.',
                  )}
            </dd>
          </div>
          <div>
            <dt>
              Speaking AI · {status.speaking.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'}
            </dt>
            <dd>
              {status.speaking.enabled
                ? t(
                    'Đã bật gửi yêu cầu AI. Khả năng xử lý phụ thuộc kết nối và hạn mức dịch vụ; chất lượng phản hồi cần được giáo viên nghiệm thu.',
                    'AI requests are enabled. Processing depends on provider availability and quota; feedback quality requires teacher validation.',
                  )
                : status.speaking.reason === 'expired'
                  ? t(
                      'Đã hết thời gian dùng thử; hệ thống đã ngừng gửi yêu cầu AI mới.',
                      'The trial has expired; new AI requests are disabled.',
                    )
                  : status.speaking.keyConfigured
                    ? t(
                        'Đã lưu khóa API; chưa bật gọi AI.',
                        'API key is saved; AI requests are disabled.',
                      )
                    : t('Chưa cấu hình khóa API.', 'API key is not configured.')}
              {status.speaking.expiresAt && (
                <p>
                  {t('Thời hạn dùng thử: ', 'Trial deadline: ')}
                  <time dateTime={status.speaking.expiresAt}>
                    {new Date(status.speaking.expiresAt).toLocaleString(
                      locale === 'vi' ? 'vi-VN' : 'en-GB',
                      { dateStyle: 'medium', timeStyle: 'long' },
                    )}
                  </time>
                </p>
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Luyện từ vựng AI', 'AI vocabulary practice')}</dt>
            <dd>
              {t(
                'Chưa triển khai các dạng bài AI. Sổ từ và ôn tập tự đánh giá vẫn sử dụng được.',
                'AI exercise formats are not implemented yet. The notebook and self-review remain available.',
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
