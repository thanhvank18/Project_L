import { useEffect, useId, useRef, useState } from 'react'
import { BookOpen, DownloadSimple } from '@phosphor-icons/react'
import type { StarterTeacherGuide } from '../../../shared/curriculum'
import { apiRequest, PortalApiError } from '@/features/auth/client'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { TeacherGuideContent } from '@/features/live/TeacherGuideContent'

function SelectedTeacherGuide({
  classId,
  classTitle,
  locale,
}: {
  classId: string
  classTitle: string
  locale: LiveViewProps['locale']
}) {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const headingId = useId()
  const [guide, setGuide] = useState<StarterTeacherGuide | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  async function load(download = false) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<StarterTeacherGuide>(
        `classes/${encodeURIComponent(classId)}/starter-guide`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setGuide(result)
      if (download) {
        const url = URL.createObjectURL(
          new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' }),
        )
        const link = document.createElement('a')
        link.href = url
        link.download = 'english-foundations-teacher-guide.md'
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (cause) {
      if (controller.signal.aborted) return
      setGuide(null)
      setError(
        cause instanceof PortalApiError && cause.status === 404
          ? t(
              'Lớp này chưa có hướng dẫn của bộ học liệu khởi đầu, hoặc quyền truy cập đã thay đổi. Kiểm tra lớp được phân công rồi thử lại.',
              'This class has no starter-pack guide, or your access changed. Check your class assignment and retry.',
            )
          : cause instanceof PortalApiError && [401, 403].includes(cause.status)
            ? errorMessage(cause, locale)
            : t(
                'Chưa tải được hướng dẫn. Kiểm tra kết nối và bấm mở hướng dẫn để thử lại.',
                'The guide could not be loaded. Check your connection and choose Open teacher guide to retry.',
              ),
      )
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return (
    <section className="mis-panel mis-stack" aria-labelledby={headingId} aria-busy={busy}>
      <div className="live-heading">
        <div>
          <h2 id={headingId}>{t('Hướng dẫn giáo viên', 'Teacher guide')}</h2>
          <p>{classTitle}</p>
        </div>
        <div className="live-actions">
          <button type="button" className="mis-button" disabled={busy} onClick={() => void load()}>
            <BookOpen size={18} aria-hidden="true" />
            {guide
              ? t('Tải lại hướng dẫn', 'Reload teacher guide')
              : t('Mở hướng dẫn giáo viên', 'Open teacher guide')}
          </button>
          {guide && (
            <button
              type="button"
              className="mis-button"
              disabled={busy}
              onClick={() => void load(true)}
            >
              <DownloadSimple size={18} aria-hidden="true" />
              {t('Tải tệp hướng dẫn', 'Download guide')}
            </button>
          )}
        </div>
      </div>
      <p className="live-help">
        {t(
          'Đáp án, bản chép lời và gợi ý review riêng cho bộ English Foundations. Kiểm tra lại hướng dẫn nếu đã sửa đề bài.',
          'Private answer keys, transcripts and review guidance for English Foundations. Recheck the guide if you have edited the tasks.',
        )}
      </p>
      {busy && <p role="status">{t('Đang tải hướng dẫn…', 'Loading teacher guide…')}</p>}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {guide && <TeacherGuideContent guide={guide} locale={locale} />}
    </section>
  )
}

/** The existing class filter selects one guide; nothing is fetched before an explicit action. */
export function TeacherGuidePanel({ props, classId }: { props: LiveViewProps; classId: string }) {
  const { user, classes } = props.state
  if (!user.active || !['admin', 'teacher'].includes(user.role)) return null
  const room = classes.find((value) => value.id === classId)
  if (!classId)
    return (
      <p className="live-help">
        {props.locale === 'vi'
          ? 'Chọn một lớp ở bộ lọc để mở hướng dẫn giáo viên của bộ English Foundations.'
          : 'Choose a class in the filter to open its English Foundations teacher guide.'}
      </p>
    )
  if (!room || (user.role === 'teacher' && (!room.active || !room.teacherIds.includes(user.id))))
    return null
  return (
    <SelectedTeacherGuide
      key={`${user.id}:${classId}`}
      classId={classId}
      classTitle={room.title}
      locale={props.locale}
    />
  )
}
