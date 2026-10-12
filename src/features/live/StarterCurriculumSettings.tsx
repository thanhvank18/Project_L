import { useEffect, useRef, useState } from 'react'
import { ArrowClockwise, BookOpen } from '@phosphor-icons/react'
import type {
  StarterCurriculumStatus,
  StarterCurriculumImportResult,
  StarterTeacherGuide,
} from '../../../shared/curriculum'
import { apiRequest } from '@/features/auth/client'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { TeacherGuideContent } from '@/features/live/TeacherGuideContent'

export function StarterCurriculumSettings(props: LiveViewProps) {
  const { locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const [status, setStatus] = useState<StarterCurriculumStatus | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<'created' | 'exists' | null>(null)
  const [guide, setGuide] = useState<StarterTeacherGuide | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    void apiRequest<StarterCurriculumStatus>('admin/starter-curriculum', {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setStatus(value)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause, locale))
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [locale])
  async function load() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      setStatus(await apiRequest<StarterCurriculumStatus>('admin/starter-curriculum'))
    } catch (cause) {
      setError(errorMessage(cause, locale))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function create() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setSuccess(null)
    try {
      const result = await apiRequest<StarterCurriculumImportResult>('admin/starter-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      setSuccess(result.created ? 'created' : 'exists')
      setStatus(await apiRequest<StarterCurriculumStatus>('admin/starter-curriculum'))
      await props.refresh()
    } catch (cause) {
      setError(errorMessage(cause, locale))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function openGuide() {
    if (pending.current || !status?.imported) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      setGuide(
        await apiRequest<StarterTeacherGuide>(
          `classes/${encodeURIComponent(status.imported.classId)}/starter-guide`,
        ),
      )
    } catch (cause) {
      setError(errorMessage(cause, locale))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <section className="mis-panel mis-stack" aria-labelledby="starter-pack-title" aria-busy={busy}>
      <div className="live-heading">
        <h2 id="starter-pack-title">{t('Học liệu tự biên soạn', 'Original learning materials')}</h2>
        <button type="button" className="mis-button" disabled={busy} onClick={() => void load()}>
          <ArrowClockwise size={17} aria-hidden="true" />
          {t('Làm mới', 'Refresh')}
        </button>
      </div>
      {busy && <p role="status">{t('Đang xử lý học liệu…', 'Loading learning materials…')}</p>}
      {status && (
        <>
          <h3>{status.title[locale]}</h3>
          <p>{status.description[locale]}</p>
          <p>
            {t(
              `${status.unitCount} bài học · ${status.assignmentCount} bài tập bốn kỹ năng · ${status.audioCount} audio Listening`,
              `${status.unitCount} lessons · ${status.assignmentCount} four-skill assignments · ${status.audioCount} Listening recordings`,
            )}
          </p>
          <p className="live-help">
            {t(
              'Nội dung gốc để giáo viên duyệt. Tạo một lớp riêng tư với bài tập nháp, chưa có học viên, lịch hoặc link Zoom. Audio dùng giọng đọc tổng hợp; không phải bài thi IELTS chính thức.',
              'Original content for teacher review. Creates a private class with draft assignments, without students, dates or Zoom links. Listening uses synthetic speech; this is not an official IELTS test.',
            )}
          </p>
          <div className="live-actions">
            {status.imported ? (
              <>
                <a className="mis-button" href="#courses">
                  {t('Mở danh sách lớp', 'Open classes')}
                </a>
                <a className="mis-button" href="#assignments">
                  {t('Duyệt bài tập nháp', 'Review draft assignments')}
                </a>
                <button
                  type="button"
                  className="mis-button"
                  disabled={busy}
                  onClick={() => void openGuide()}
                >
                  {t('Xem hướng dẫn giáo viên', 'View teacher guide')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="mis-button mis-primary"
                disabled={busy}
                onClick={() => void create()}
              >
                <BookOpen size={18} aria-hidden="true" />
                {t('Tạo lớp và học liệu nháp', 'Create class and draft materials')}
              </button>
            )}
          </div>
        </>
      )}
      {success && (
        <p className="live-success" role="status">
          {success === 'created'
            ? t(
                'Đã tạo lớp riêng và học liệu nháp. Chọn giáo viên, lịch học rồi duyệt bài trước khi đăng.',
                'Private class and draft materials created. Assign teachers and a schedule, then review the tasks before publishing.',
              )
            : t(
                'Bộ học liệu đã được tạo trước đó; không tạo trùng.',
                'This pack was already created; no duplicate was added.',
              )}
        </p>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {guide && <TeacherGuideContent guide={guide} locale={locale} />}
    </section>
  )
}
