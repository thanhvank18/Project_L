import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ConsultationOutcome, Lesson } from '../../../shared/portal'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { consultationReview, reviewConfirmationSnapshot } from '@/features/live/main-review'
import '@/styles/consultation-outcomes.css'

export function ConsultationOutcomePanel({
  props,
  lesson,
  onEdit,
  disabled = false,
}: {
  props: LiveViewProps
  lesson: Lesson
  onEdit: (bookingId: string) => void
  disabled?: boolean
}) {
  const { state, locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  if (lesson.kind !== 'consultation' || state.user.role === 'assistant') return null
  const outcomes = state.consultationOutcomes.filter((outcome) => outcome.lessonId === lesson.id)
  const bookings = state.bookings.filter(
    (booking) => booking.lessonId === lesson.id && booking.status === 'booked',
  )
  const started = Date.parse(lesson.startsAt) <= Date.parse(state.fetchedAt)
  const host =
    state.user.role === 'teacher' && lesson.hostId === state.user.id && !lesson.cancelled && started
  if (!outcomes.length && (!started || !bookings.length || lesson.cancelled)) return null
  return (
    <section
      className="consultation-outcomes"
      aria-label={t('Kết quả review 1:1', '1:1 review outcome')}
    >
      <h3>{t('Kết quả review 1:1', '1:1 review outcome')}</h3>
      {bookings.map((booking) => {
        const outcome = outcomes.find((item) => item.bookingId === booking.id)
        const name =
          state.users.find((user) => user.id === booking.studentId)?.name ??
          t('Học viên', 'Student')
        return (
          <div key={booking.id} className="consultation-outcome-row">
            {state.user.role !== 'student' && <strong>{name}</strong>}
            {outcome ? (
              <>
                <span className="mis-status">
                  {outcome.status === 'completed'
                    ? t('Đã hoàn thành review', 'Review completed')
                    : t('Không tham dự', 'Did not attend')}
                </span>
                {outcome.feedback ? (
                  <p className="live-prose">{outcome.feedback}</p>
                ) : (
                  <p className="live-help">
                    {t(
                      'Giáo viên chưa thêm nhận xét cho buổi này.',
                      'No session feedback was added.',
                    )}
                  </p>
                )}
                <p className="live-help">
                  {t('Giáo viên xác nhận', 'Confirmed by')}{' '}
                  {state.users.find((user) => user.id === outcome.teacherId)?.name ??
                    t('giáo viên', 'teacher')}{' '}
                  ·{' '}
                  <time dateTime={outcome.updatedAt}>
                    {new Date(outcome.updatedAt).toLocaleString(
                      locale === 'vi' ? 'vi-VN' : 'en-GB',
                      { dateStyle: 'medium', timeStyle: 'short' },
                    )}
                  </time>
                </p>
              </>
            ) : (
              <p className="live-help">
                {t(
                  'Chờ giáo viên phụ trách xác nhận kết quả buổi review.',
                  'Awaiting the host teacher’s confirmation.',
                )}
              </p>
            )}
            {host &&
              state.users.some(
                (user) => user.id === booking.studentId && user.role === 'student' && user.active,
              ) &&
              state.classes.some(
                (room) => room.id === lesson.classId && room.studentIds.includes(booking.studentId),
              ) && (
                <div className="live-actions">
                  <button
                    className="mis-button"
                    type="button"
                    disabled={disabled}
                    onClick={() => onEdit(booking.id)}
                  >
                    {outcome
                      ? t('Sửa kết quả review', 'Correct review outcome')
                      : t('Xác nhận kết quả', 'Confirm outcome')}
                  </button>
                </div>
              )}
          </div>
        )
      })}
      {host && (
        <p className="live-help">
          {t(
            'Kết quả buổi review được ghi riêng với điểm bài tập. Nhận xét ở đây sẽ hiển thị cho học viên.',
            'Session outcomes are separate from assignment grades. This feedback is visible to the student.',
          )}
        </p>
      )}
    </section>
  )
}

export function ConsultationOutcomeEditor({
  props,
  bookingId,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  bookingId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { state, locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const booking = state.bookings.find((value) => value.id === bookingId)
  const lesson = state.lessons.find((value) => value.id === booking?.lessonId)
  const outcome = state.consultationOutcomes.find((value) => value.bookingId === bookingId)
  const review = lesson?.reviewForLessonId ? consultationReview(state.lessons, lesson) : undefined
  const currentReviewSnapshot = reviewConfirmationSnapshot(state.lessons, lesson)
  const retiredRelationship = Boolean(
    outcome &&
    lesson?.reviewForLessonId &&
    (outcome.reviewForLessonId !== review?.target?.id ||
      outcome.reviewedLessonId !== review?.previous?.id),
  )
  const [initialBooking] = useState(booking)
  const [initialLesson] = useState(lesson)
  const [status, setStatus] = useState<ConsultationOutcome['status']>(
    outcome?.status ?? 'completed',
  )
  const [feedback, setFeedback] = useState(outcome?.feedback ?? '')
  const [initialInput] = useState(JSON.stringify({ status, feedback }))
  const [baseline, setBaseline] = useState({
    outcome: outcome?.version ?? 0,
    lesson: lesson?.version ?? 0,
    booking: booking?.version ?? 0,
    ...currentReviewSnapshot,
  })
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const dirty = JSON.stringify({ status, feedback }) !== initialInput
  const room = state.classes.find((value) => value.id === lesson?.classId)
  const learner = state.users.find((value) => value.id === booking?.studentId)
  const available =
    Boolean(
      state.user.active &&
      state.user.role === 'teacher' &&
      booking?.status === 'booked' &&
      lesson?.kind === 'consultation' &&
      !lesson.cancelled &&
      lesson.hostId === state.user.id &&
      Date.parse(lesson.startsAt) <= Date.parse(state.fetchedAt) &&
      room?.active &&
      room.teacherIds.includes(state.user.id) &&
      learner?.active &&
      learner.role === 'student' &&
      room.studentIds.includes(learner.id),
    ) &&
    (!lesson?.reviewForLessonId || Boolean(review?.valid && !retiredRelationship))
  const changed = Boolean(
    available &&
    (baseline.outcome !== (outcome?.version ?? 0) ||
      baseline.lesson !== lesson?.version ||
      baseline.booking !== booking?.version ||
      baseline.expectedReviewForLessonId !== currentReviewSnapshot.expectedReviewForLessonId ||
      baseline.expectedReviewForLessonVersion !==
        currentReviewSnapshot.expectedReviewForLessonVersion ||
      baseline.expectedReviewedLessonId !== currentReviewSnapshot.expectedReviewedLessonId ||
      baseline.expectedReviewedLessonVersion !==
        currentReviewSnapshot.expectedReviewedLessonVersion),
  )
  useEffect(() => {
    heading.current?.focus()
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  useEffect(() => {
    if (!dirty && !busy && !refreshing) return
    const allow = () =>
      !pending.current &&
      !refreshing &&
      window.confirm(
        locale === 'vi'
          ? 'Rời biểu mẫu và bỏ kết quả review chưa lưu?'
          : 'Leave and discard the unsaved review outcome?',
      )
    const leave = (event: Event) => {
      if (!allow()) event.preventDefault()
    }
    const unload = (event: BeforeUnloadEvent) => event.preventDefault()
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest('a[href], .mis-signout') : null
      if (
        !target ||
        target.getAttribute('href')?.startsWith('#') ||
        target.hasAttribute('download')
      )
        return
      if (!allow()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('project-l:before-leave', leave)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('project-l:before-leave', leave)
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
    }
  }, [dirty, busy, refreshing, locale])
  function close() {
    if (pending.current || refreshing) return
    if (
      !dirty ||
      window.confirm(
        t('Đóng và bỏ kết quả review chưa lưu?', 'Close and discard the unsaved review outcome?'),
      )
    )
      onClose()
  }
  async function refresh() {
    if (pending.current || refreshing) return
    setRefreshing(true)
    try {
      await props.refresh()
    } catch (cause) {
      setError(errorMessage(cause, locale))
    } finally {
      setRefreshing(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current || refreshing || !available || changed) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await props.run('consultation.outcome.save', {
        bookingId,
        expectedVersion: baseline.outcome,
        expectedLessonVersion: baseline.lesson,
        expectedBookingVersion: baseline.booking,
        expectedReviewForLessonId: baseline.expectedReviewForLessonId,
        expectedReviewForLessonVersion: baseline.expectedReviewForLessonVersion,
        expectedReviewedLessonId: baseline.expectedReviewedLessonId,
        expectedReviewedLessonVersion: baseline.expectedReviewedLessonVersion,
        status,
        feedback,
      })
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause, locale))
      await props.refresh().catch(() => undefined)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className="mis-panel live-editor consultation-outcome-editor"
      onSubmit={(event) => void save(event)}
    >
      <div className="live-heading">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {t('Xác nhận kết quả review 1:1', 'Confirm 1:1 review outcome')}
          </h2>
          <p>
            {lesson?.title ?? initialLesson?.title} ·{' '}
            {learner?.name ??
              state.users.find((value) => value.id === initialBooking?.studentId)?.name ??
              t('Học viên', 'Student')}
          </p>
        </div>
        <button className="mis-button" type="button" disabled={busy || refreshing} onClick={close}>
          {t('Đóng', 'Close')}
        </button>
      </div>
      <p className="live-help">
        {t(
          'Học viên sẽ thấy kết quả và nhận xét này. Sau khi xác nhận, lịch và lượt đặt chỗ được giữ để bảo toàn lịch sử; giáo viên phụ trách vẫn có thể sửa kết quả.',
          'The student can see this outcome and feedback. Confirmation preserves the session and reservation history; the host teacher may still correct the outcome.',
        )}
      </p>
      {review?.target && review.previous && (
        <p className="live-prose">
          {t('Xác nhận đã ôn bài', 'Confirm review of')} <strong>{review.previous.title}</strong>{' '}
          {t('để vào buổi chính', 'before the main lesson')} <strong>{review.target.title}</strong>.{' '}
          {t(
            'Chỉ xác nhận hoàn thành khi bạn đã trực tiếp review với học viên.',
            'Confirm completion only after conducting this review with the student.',
          )}
        </p>
      )}
      {retiredRelationship && (
        <p role="alert" className="live-error">
          {t(
            'Thứ tự bài học đã thay đổi sau khi xác nhận. Kết quả này được giữ trong lịch sử; cần một buổi review mới cho bài học hiện tại.',
            'The lesson sequence changed after confirmation. This outcome stays in history; a new review is required for the current lesson.',
          )}
        </p>
      )}
      {!available && (
        <p role="alert" className="live-error">
          {t(
            'Buổi review hoặc quyền xác nhận không còn khả dụng. Nội dung đang nhập được giữ để bạn sao chép.',
            'This review or your confirmation permission is no longer available. Your input is preserved for copying.',
          )}
        </p>
      )}
      {changed && (
        <div className="mis-stack">
          <p role="alert" className="live-error">
            {t(
              'Lịch, bài cần ôn, buổi chính tiếp theo, đặt chỗ hoặc kết quả đã thay đổi. Kiểm tra thông tin mới trước khi lưu; nội dung bạn nhập vẫn được giữ.',
              'The schedule, previous lesson, next main lesson, reservation or outcome changed. Check the latest details before saving; your input is preserved.',
            )}
          </p>
          {outcome && (
            <details>
              <summary>{t('Xem kết quả đang lưu', 'View saved outcome')}</summary>
              <p>
                {outcome.status === 'completed'
                  ? t('Đã hoàn thành', 'Completed')
                  : t('Không tham dự', 'Did not attend')}
              </p>
              <p className="live-prose">{outcome.feedback}</p>
            </details>
          )}
          <button
            className="mis-button"
            type="button"
            disabled={busy || refreshing || !available}
            onClick={() => {
              setBaseline({
                outcome: outcome?.version ?? 0,
                lesson: lesson!.version,
                booking: booking!.version,
                ...currentReviewSnapshot,
              })
              setError('')
            }}
          >
            {t(
              'Giữ nội dung nhập và dùng phiên bản mới',
              'Keep my input and use the latest version',
            )}
          </button>
        </div>
      )}
      <fieldset className="live-fieldset" disabled={busy || refreshing}>
        <label className="mis-field">
          {t('Kết quả buổi review', 'Session outcome')}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ConsultationOutcome['status'])}
          >
            <option value="completed">{t('Đã hoàn thành review', 'Review completed')}</option>
            <option value="no_show">{t('Học viên không tham dự', 'Student did not attend')}</option>
          </select>
        </label>
        <label className="mis-field">
          {t('Nhận xét gửi học viên (không bắt buộc)', 'Feedback for the student (optional)')}
          <textarea
            rows={5}
            maxLength={5000}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
        <div className="live-actions">
          <button type="submit" className="mis-button mis-primary" disabled={!available || changed}>
            {busy ? t('Đang lưu…', 'Saving…') : t('Lưu kết quả review', 'Save review outcome')}
          </button>
          <button type="button" className="mis-button" onClick={close}>
            {t('Hủy', 'Cancel')}
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {(error || !available) && (
        <button
          className="mis-button"
          type="button"
          disabled={busy || refreshing}
          onClick={() => void refresh()}
        >
          {refreshing
            ? t('Đang kiểm tra…', 'Checking…')
            : t('Kiểm tra dữ liệu mới', 'Check for updates')}
        </button>
      )}
    </form>
  )
}
