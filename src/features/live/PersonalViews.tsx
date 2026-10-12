import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowSquareOut,
  CalendarBlank,
  Check,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react'
import type { Lesson, MainReviewPreparation, MeetingSource, Word } from '../../../shared/portal'
import { apiRequest, PortalApiError } from '@/features/auth/client'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { MeetingLinkEditor } from '@/features/live/MeetingLinkEditor'
import { EmailDeliveryStatus } from '@/features/live/EmailDeliveryStatus'
import { IntegrationStatus } from '@/features/live/IntegrationStatus'
import { DriveConnectionSettings } from '@/features/live/DriveConnectionSettings'
import { StarterCurriculumSettings } from '@/features/live/StarterCurriculumSettings'
import {
  consultationReview,
  mainLessonSequence,
  mainReviewAllowsJoin,
} from '@/features/live/main-review'
import {
  ConsultationOutcomeEditor,
  ConsultationOutcomePanel,
} from '@/features/live/ConsultationOutcomePanel'
import { isZoomMeetingUrl } from '@/features/live/meeting'
import '@/styles/live-administration.css'
import '@/styles/live-personal.css'

const tx = (vi: boolean, vietnamese: string, english: string) => (vi ? vietnamese : english)
function reviewLabel(status: MainReviewPreparation['status'] | undefined, vi: boolean) {
  switch (status) {
    case 'exempt':
      return tx(vi, 'Buổi đầu: miễn review 1:1', 'First lesson: no review required')
    case 'required':
      return tx(vi, 'Cần hoàn thành review 1:1', '1:1 review required')
    case 'booked':
      return tx(vi, 'Đã đặt review · Chưa hoàn thành', 'Review reserved · Not completed')
    case 'awaiting_confirmation':
      return tx(vi, 'Chờ giáo viên xác nhận review', 'Awaiting teacher confirmation')
    case 'completed':
      return tx(vi, 'Review đã được giáo viên xác nhận', 'Review confirmed by teacher')
    case 'no_show':
      return tx(vi, 'Không tham dự review · Cần đặt lại', 'Review missed · Book another slot')
    default:
      return tx(vi, 'Chưa tải được điều kiện review', 'Review status unavailable')
  }
}
function localTime(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function dateLabel(iso: string, vi: boolean) {
  return new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}
function preparation(props: LiveViewProps, classId: string, studentId = props.state.user.id) {
  const required = props.state.assignments.filter(
    (task) => task.classId === classId && task.published && task.required,
  )
  const submitted = required.filter((task) =>
    props.state.submissions.some(
      (submission) =>
        submission.assignmentId === task.id &&
        submission.assignmentVersion === task.version &&
        submission.studentId === studentId,
    ),
  )
  return {
    completed: submitted.length,
    total: required.length,
    missing: required.filter((task) => !submitted.includes(task)),
  }
}

function LessonEditor({
  props,
  lesson,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  lesson: Lesson | null
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const rooms = props.state.classes.filter(
    (room) =>
      room.active &&
      (props.state.user.role === 'admin' || room.teacherIds.includes(props.state.user.id)),
  )
  const initialClass = lesson?.classId ?? (rooms.length === 1 ? rooms[0]!.id : '')
  const [classId, setClassId] = useState(initialClass)
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [startsAt, setStartsAt] = useState(lesson ? localTime(lesson.startsAt) : '')
  const [endsAt, setEndsAt] = useState(lesson ? localTime(lesson.endsAt) : '')
  const [kind, setKind] = useState<Lesson['kind']>(lesson?.kind ?? 'class')
  const [reviewForLessonId, setReviewForLessonId] = useState(lesson?.reviewForLessonId ?? '')
  const [hostId, setHostId] = useState(
    lesson?.hostId ??
      (rooms.find((room) => room.id === initialClass)?.teacherIds.includes(props.state.user.id)
        ? props.state.user.id
        : ''),
  )
  const [capacity, setCapacity] = useState(lesson?.capacity ?? 1)
  const [cancelled, setCancelled] = useState(lesson?.cancelled ?? false)
  const [meetingSource, setMeetingSource] = useState<MeetingSource>(
    lesson?.meetingSource ?? 'class',
  )
  const [meetingMode, setMeetingMode] = useState(
    lesson?.meetingSource === 'lesson' && lesson.hasMeeting ? 'keep' : 'replace',
  )
  const [meetingUrl, setMeetingUrl] = useState('')
  const [baseline, setBaseline] = useState(lesson)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const latest = lesson ? props.state.lessons.find((value) => value.id === lesson.id) : null
  const finalized = Boolean(
    lesson && props.state.consultationOutcomes.some((value) => value.lessonId === lesson.id),
  )
  const room = props.state.classes.find((value) => value.id === classId)
  const allowedRole = props.state.user.role === 'admin' || props.state.user.role === 'teacher'
  const available = Boolean(
    props.state.user.active &&
    allowedRole &&
    (!lesson || latest) &&
    (!classId ||
      (room?.active &&
        (props.state.user.role === 'admin' || room.teacherIds.includes(props.state.user.id)))),
  )
  const changed = Boolean(lesson && latest && latest.version !== baseline?.version)
  const finalizedFieldsChanged = Boolean(
    finalized &&
    latest &&
    (startsAt !== localTime(latest.startsAt) ||
      endsAt !== localTime(latest.endsAt) ||
      kind !== latest.kind ||
      reviewForLessonId !== (latest.reviewForLessonId ?? '') ||
      hostId !== latest.hostId ||
      capacity !== latest.capacity ||
      cancelled !== latest.cancelled),
  )
  const canKeepMeeting = baseline?.meetingSource === 'lesson' && baseline.hasMeeting
  const needsMeetingUrl = meetingSource === 'lesson' && (meetingMode !== 'keep' || !canKeepMeeting)
  const draft = JSON.stringify([
    classId,
    title,
    startsAt,
    endsAt,
    kind,
    reviewForLessonId,
    hostId,
    capacity,
    cancelled,
    meetingSource,
    meetingMode,
    meetingUrl,
  ])
  const [initialDraft] = useState(draft)
  const dirty = draft !== initialDraft
  const classMeeting = props.state.classMeetings.find((meeting) => meeting.classId === classId)
  const hosts = props.state.users.filter(
    (user) =>
      user.active &&
      user.role === 'teacher' &&
      props.state.classes.find((room) => room.id === classId)?.teacherIds.includes(user.id),
  )
  const mainLessons = mainLessonSequence(props.state.lessons, classId)
  const reviewTargets = mainLessons
    .slice(1)
    .filter(
      (item) =>
        Date.parse(item.startsAt) > Date.parse(props.state.fetchedAt) ||
        item.id === reviewForLessonId,
    )
  const review = consultationReview(props.state.lessons, {
    classId,
    reviewForLessonId,
    startsAt,
    endsAt,
  })
  const needsReviewTarget = !lesson && kind === 'consultation' && reviewTargets.length > 0
  const reviewFieldsChanged =
    !baseline ||
    reviewForLessonId !== (baseline.reviewForLessonId ?? '') ||
    startsAt !== localTime(baseline.startsAt) ||
    endsAt !== localTime(baseline.endsAt) ||
    kind !== baseline.kind

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  useEffect(() => {
    if (!dirty && !busy) return
    const allowLeave = () =>
      !pending.current &&
      window.confirm(
        tx(
          vi,
          'Buổi học có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?',
          'This lesson has unsaved changes. Leave and discard them?',
        ),
      )
    const unload = (event: BeforeUnloadEvent) => event.preventDefault()
    const routeLeave = (event: Event) => {
      if (!allowLeave()) event.preventDefault()
    }
    const signOut = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.mis-signout') &&
        !allowLeave()
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('project-l:before-leave', routeLeave)
    document.addEventListener('click', signOut, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('project-l:before-leave', routeLeave)
      document.removeEventListener('click', signOut, true)
    }
  }, [dirty, busy, vi])
  function close() {
    if (pending.current) return
    if (
      !dirty ||
      window.confirm(
        tx(
          vi,
          'Buổi học có thay đổi chưa lưu. Đóng và bỏ các thay đổi?',
          'This lesson has unsaved changes. Close and discard them?',
        ),
      )
    )
      onClose()
  }
  async function refresh() {
    if (refreshing || pending.current) return
    setRefreshing(true)
    try {
      await props.refresh()
    } catch (cause) {
      setError(errorMessage(cause, props.locale))
    } finally {
      setRefreshing(false)
    }
  }
  function useLatest() {
    if (!latest || !changed || !available || pending.current || refreshing) return
    setBaseline(latest)
    if (meetingMode === 'keep' && !(latest.meetingSource === 'lesson' && latest.hasMeeting))
      setMeetingMode('replace')
    setError('')
  }
  function keepConfirmedSchedule() {
    if (!latest || !finalized || pending.current || refreshing) return
    setStartsAt(localTime(latest.startsAt))
    setEndsAt(localTime(latest.endsAt))
    setKind(latest.kind)
    setReviewForLessonId(latest.reviewForLessonId ?? '')
    setHostId(latest.hostId)
    setCapacity(latest.capacity)
    setCancelled(latest.cancelled)
    setError('')
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current || refreshing || !available || changed || finalizedFieldsChanged) return
    if (
      kind === 'consultation' &&
      !cancelled &&
      ((needsReviewTarget && !reviewForLessonId) ||
        (reviewForLessonId && reviewFieldsChanged && !review.valid))
    ) {
      setError(
        tx(
          vi,
          'Chọn buổi chính tiếp theo và đặt giờ review sau khi bài trước kết thúc, trước khi buổi chính bắt đầu.',
          'Choose the next main lesson and schedule this review after the previous lesson ends and before the next one starts.',
        ),
      )
      return
    }
    if (needsMeetingUrl && !isZoomMeetingUrl(meetingUrl)) {
      setError(
        tx(
          vi,
          'Nhập liên kết Zoom HTTPS hợp lệ, dạng zoom.us/j/… hoặc zoom.us/my/… (có thể dùng tên miền con của Zoom).',
          'Enter a valid HTTPS Zoom link using zoom.us/j/… or zoom.us/my/… (Zoom subdomains are supported).',
        ),
      )
      return
    }
    if (
      new Date(endsAt).getTime() <= new Date(startsAt).getTime() ||
      new Date(endsAt).getTime() - new Date(startsAt).getTime() > 86_400_000
    ) {
      setError(
        tx(
          vi,
          'Giờ kết thúc phải sau giờ bắt đầu, trong tối đa 24 giờ.',
          'End time must be after start time, within 24 hours.',
        ),
      )
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await props.run('lesson.save', {
        ...(lesson ? { id: lesson.id } : {}),
        expectedVersion: baseline?.version ?? 0,
        classId,
        title: title.trim(),
        startsAt:
          baseline && startsAt === localTime(baseline.startsAt)
            ? baseline.startsAt
            : new Date(startsAt).toISOString(),
        endsAt:
          baseline && endsAt === localTime(baseline.endsAt)
            ? baseline.endsAt
            : new Date(endsAt).toISOString(),
        kind,
        reviewForLessonId: kind === 'consultation' ? reviewForLessonId : '',
        hostId,
        capacity: kind === 'consultation' ? 1 : capacity,
        cancelled,
        meetingSource,
        ...(needsMeetingUrl ? { meetingUrl: meetingUrl.trim() } : {}),
      })
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause, props.locale))
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status))
        await props.refresh().catch(() => undefined)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form className="mis-panel live-editor" onSubmit={save}>
      <div className="live-heading">
        <h2 ref={heading} tabIndex={-1}>
          {lesson
            ? tx(vi, 'Chỉnh sửa buổi học', 'Edit lesson')
            : tx(vi, 'Tạo buổi học', 'Create lesson')}
        </h2>
        <button
          type="button"
          className="mis-button"
          disabled={busy}
          onClick={close}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <p className="live-help">
        {tx(vi, 'Giờ theo thiết bị của bạn', 'Times use your device timezone')}:{' '}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}.{' '}
        {tx(
          vi,
          'Đổi giờ buổi tư vấn đã có đặt chỗ cần hủy buổi cũ và tạo buổi mới.',
          'To reschedule a reserved consultation, cancel the old lesson and create a new one.',
        )}
      </p>
      {finalized && (
        <div className="mis-notice">
          <p>
            {tx(
              vi,
              'Buổi review đã có kết quả. Chỉ sửa tên hoặc link Zoom; lịch, giáo viên phụ trách và lượt đặt chỗ được giữ trong lịch sử.',
              'This review has a confirmed outcome. You may edit its title or Zoom link; its schedule, host and reservation history are preserved.',
            )}
          </p>
          {finalizedFieldsChanged && (
            <>
              <p>
                {tx(
                  vi,
                  'Kết quả được xác nhận trong khi biểu mẫu đang mở. Khôi phục lịch đã xác nhận để tiếp tục; tên và link Zoom bạn nhập vẫn được giữ.',
                  'An outcome was confirmed while this form was open. Restore the confirmed schedule to continue; your entered title and Zoom link are kept.',
                )}
              </p>
              <button
                type="button"
                className="mis-button"
                disabled={busy || refreshing}
                onClick={keepConfirmedSchedule}
              >
                {tx(vi, 'Giữ lịch đã xác nhận', 'Keep confirmed schedule')}
              </button>
            </>
          )}
        </div>
      )}
      {!available && (
        <p className="live-error" role="alert">
          {tx(
            vi,
            'Lớp hoặc buổi học không còn khả dụng, hoặc quyền chỉnh sửa đã thay đổi. Nội dung bạn nhập vẫn được giữ.',
            'The class or lesson is unavailable, or your editing access changed. Your input is kept.',
          )}
        </p>
      )}
      {available && changed && latest && (
        <div className="mis-notice" role="status">
          <p>
            {tx(
              vi,
              'Buổi học đã thay đổi từ khi bạn mở biểu mẫu. Kiểm tra bản đang lưu bên dưới rồi dùng phiên bản mới nhất để tiếp tục; các giá trị bạn đang nhập được giữ lại.',
              'This lesson changed after you opened the form. Check the saved version below, then use the latest version to continue; your entered values are kept.',
            )}
          </p>
          <p className="live-prose">
            <strong>{latest.title}</strong>
            {' · '}
            {dateLabel(latest.startsAt, vi)} — {dateLabel(latest.endsAt, vi)}
            {' · '}
            {props.state.users.find((user) => user.id === latest.hostId)?.name ??
              tx(vi, 'Giáo viên', 'Teacher')}
            {' · '}
            {latest.kind === 'consultation'
              ? tx(vi, 'Review 1:1', '1:1 review')
              : tx(vi, 'Lớp chính', 'Main class')}
            {' · '}
            {latest.capacity} {tx(vi, 'chỗ', 'places')}
            {' · '}
            {latest.cancelled ? tx(vi, 'Đã hủy', 'Cancelled') : tx(vi, 'Đang mở', 'Scheduled')}
            {' · '}
            {latest.meetingSource === 'class'
              ? tx(vi, 'Zoom: link chung của lớp', 'Zoom: shared class link')
              : latest.meetingSource === 'lesson'
                ? tx(vi, 'Zoom: link riêng', 'Zoom: lesson link')
                : tx(vi, 'Zoom: chưa gắn link', 'Zoom: no link')}
            {latest.kind === 'consultation' && (
              <>
                {' · '}
                {tx(vi, 'Review trước buổi', 'Review before')}:{' '}
                {props.state.lessons.find((item) => item.id === latest.reviewForLessonId)?.title ??
                  tx(vi, 'Chưa liên kết', 'Not linked')}
              </>
            )}
          </p>
          <button
            type="button"
            className="mis-button"
            disabled={busy || refreshing}
            onClick={useLatest}
          >
            {tx(vi, 'Dùng phiên bản mới nhất', 'Use latest version')}
          </button>
        </div>
      )}
      <fieldset className="live-fieldset" disabled={busy || !available}>
        <div className="live-form-grid">
          <label className="mis-field">
            {tx(vi, 'Lớp học', 'Class')}
            <select
              required
              value={classId}
              disabled={Boolean(lesson)}
              onChange={(event) => {
                setClassId(event.target.value)
                setHostId('')
                setReviewForLessonId('')
              }}
            >
              <option value="">{tx(vi, 'Chọn lớp', 'Choose class')}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.title}
                </option>
              ))}
            </select>
          </label>
          <label className="mis-field">
            {tx(vi, 'Tên buổi học', 'Lesson title')}
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="mis-field">
            {tx(vi, 'Bắt đầu', 'Starts at')}
            <input
              required
              type="datetime-local"
              value={startsAt}
              disabled={finalized}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label className="mis-field">
            {tx(vi, 'Kết thúc', 'Ends at')}
            <input
              required
              type="datetime-local"
              value={endsAt}
              disabled={finalized}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <label className="mis-field">
            {tx(vi, 'Loại buổi', 'Lesson type')}
            <select
              value={kind}
              disabled={finalized}
              onChange={(event) => {
                const next = event.target.value as Lesson['kind']
                setKind(next)
                setReviewForLessonId('')
                if (next === 'consultation') setCapacity(1)
                if (!lesson) setMeetingSource(next === 'class' ? 'class' : 'none')
              }}
            >
              <option value="class">{tx(vi, 'Lớp chính', 'Main class')}</option>
              <option value="consultation">{tx(vi, 'Review 1:1', '1:1 review')}</option>
            </select>
          </label>
          {kind === 'consultation' && (
            <label className="mis-field live-wide">
              {tx(vi, 'Review để vào buổi chính nào?', 'Main lesson unlocked by this review')}
              <select
                value={reviewForLessonId}
                required={needsReviewTarget && !cancelled}
                disabled={finalized}
                onChange={(event) => setReviewForLessonId(event.target.value)}
              >
                <option value="">
                  {tx(vi, 'Chưa liên kết · Review bổ sung', 'Not linked · Additional review')}
                </option>
                {reviewForLessonId &&
                  !reviewTargets.some((item) => item.id === reviewForLessonId) && (
                    <option value={reviewForLessonId}>
                      {tx(
                        vi,
                        'Buổi đã chọn không còn hợp lệ',
                        'Selected lesson is no longer valid',
                      )}
                    </option>
                  )}
                {reviewTargets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {dateLabel(item.startsAt, vi)}
                  </option>
                ))}
              </select>
              <span className="live-help">
                {reviewForLessonId && review.previous && review.target
                  ? tx(
                      vi,
                      `Ôn bài “${review.previous.title}”. Review phải bắt đầu từ ${dateLabel(review.previous.endsAt, vi)} và kết thúc trước ${dateLabel(review.target.startsAt, vi)}.`,
                      `Review “${review.previous.title}”. Start on or after ${dateLabel(review.previous.endsAt, vi)} and finish before ${dateLabel(review.target.startsAt, vi)}.`,
                    )
                  : tx(
                      vi,
                      'Buổi chính đầu tiên được miễn review. Review chưa liên kết không mở quyền vào buổi chính tiếp theo; hãy tạo lịch các buổi chính trước.',
                      'The first main lesson is exempt. An unlinked review does not unlock a later main lesson; schedule the main lessons first.',
                    )}
              </span>
            </label>
          )}
          <label className="mis-field">
            {tx(vi, 'Giáo viên phụ trách', 'Host teacher')}
            <select
              required
              value={hostId}
              disabled={finalized}
              onChange={(event) => setHostId(event.target.value)}
            >
              <option value="">
                {tx(vi, 'Chọn giáo viên của lớp', 'Choose an assigned teacher')}
              </option>
              {hosts.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mis-field">
            {tx(vi, 'Số chỗ', 'Capacity')}
            <input
              required
              type="number"
              min={1}
              max={10000}
              step={1}
              value={kind === 'consultation' ? 1 : capacity}
              disabled={kind === 'consultation' || finalized}
              onChange={(event) => setCapacity(Number(event.target.value))}
            />
            {kind === 'consultation' && (
              <span className="live-help">
                {tx(
                  vi,
                  'Mỗi giờ review dành cho một học viên.',
                  'Each review slot is reserved for one student.',
                )}
              </span>
            )}
          </label>
          <label className="mis-field">
            {tx(vi, 'Link Zoom cho buổi học', 'Zoom link for this lesson')}
            <select
              value={meetingSource}
              onChange={(event) => setMeetingSource(event.target.value as MeetingSource)}
            >
              <option value="class">{tx(vi, 'Dùng link của lớp', 'Use class link')}</option>
              <option value="lesson">
                {tx(vi, 'Link riêng cho buổi này', 'Link for this lesson only')}
              </option>
              <option value="none">{tx(vi, 'Chưa gắn link', 'No link yet')}</option>
            </select>
          </label>
          {meetingSource === 'class' && (
            <p className="live-help live-wide">
              {classMeeting?.hasMeeting
                ? tx(
                    vi,
                    'Buổi này sẽ dùng link Zoom chung của lớp. Khi link chung thay đổi, buổi này cũng dùng link mới.',
                    'This lesson uses the shared class link. Changes to the class link also apply to this lesson.',
                  )
                : tx(
                    vi,
                    'Lớp chưa có link chung. Bạn có thể lưu lịch trước, rồi thêm link ở “Link Zoom của lớp”.',
                    'This class has no shared link yet. Save the schedule, then add one under “Class Zoom link”.',
                  )}
            </p>
          )}
          {meetingSource === 'lesson' && canKeepMeeting && (
            <label className="mis-field live-wide">
              {tx(vi, 'Link riêng hiện tại', 'Current lesson link')}
              <select value={meetingMode} onChange={(event) => setMeetingMode(event.target.value)}>
                <option value="keep">{tx(vi, 'Giữ link đã lưu', 'Keep saved link')}</option>
                <option value="replace">
                  {tx(vi, 'Thay bằng link mới', 'Replace with a new link')}
                </option>
              </select>
            </label>
          )}
          {needsMeetingUrl && (
            <label className="mis-field live-wide">
              {tx(vi, 'Link Zoom riêng', 'Lesson Zoom link')}
              <input
                required
                type="url"
                maxLength={2000}
                value={meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
                placeholder="https://zoom.us/j/…"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="live-help">
                {tx(
                  vi,
                  'Link này chỉ áp dụng cho buổi hiện tại. Hệ thống kiểm tra quyền trước khi mở Zoom.',
                  'This link applies only to this lesson. Access is checked before opening Zoom.',
                )}
              </span>
            </label>
          )}
          {lesson && (
            <label className="live-check live-wide">
              <input
                type="checkbox"
                checked={cancelled}
                disabled={finalized}
                onChange={(event) => setCancelled(event.target.checked)}
              />
              <span>
                {tx(vi, 'Hủy buổi học này', 'Cancel this lesson')}
                <small>
                  {tx(
                    vi,
                    'Các lượt đặt chỗ đang có cũng sẽ bị hủy.',
                    'Existing reservations will also be cancelled.',
                  )}
                </small>
              </span>
            </label>
          )}
        </div>
        <div className="live-actions">
          <button
            className="mis-button mis-primary"
            type="submit"
            disabled={changed || refreshing || finalizedFieldsChanged}
          >
            {busy ? tx(vi, 'Đang lưu…', 'Saving…') : tx(vi, 'Lưu buổi học', 'Save lesson')}
          </button>
          <button type="button" className="mis-button" onClick={close}>
            {tx(vi, 'Đóng', 'Close')}
          </button>
        </div>
      </fieldset>
      {error && (
        <div>
          <p className="live-error" role="alert">
            {error}
          </p>
          <button
            className="mis-button"
            type="button"
            disabled={busy || refreshing}
            onClick={() => void refresh()}
          >
            {refreshing
              ? tx(vi, 'Đang tải…', 'Refreshing…')
              : tx(vi, 'Tải trạng thái mới nhất', 'Refresh current status')}
          </button>
        </div>
      )}
    </form>
  )
}

export function ScheduleView(props: LiveViewProps & { initialKind?: 'all' | 'consultation' }) {
  const { state, locale } = props
  const vi = locale === 'vi'
  const staff = state.user.role === 'admin' || state.user.role === 'teacher'
  const student = state.user.role === 'student'
  const [classId, setClassId] = useState(state.classes.length === 1 ? state.classes[0]!.id : '')
  const [period, setPeriod] = useState('upcoming')
  const [kindFilter, setKindFilter] = useState(props.initialKind ?? 'all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [editor, setEditor] = useState<Lesson | null | undefined>(undefined)
  const [meetingEditor, setMeetingEditor] = useState<
    { kind: 'class'; classId: string } | { kind: 'lesson'; lesson: Lesson } | null
  >(null)
  const [outcomeBookingId, setOutcomeBookingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const pending = useRef(false)
  const lessons = state.lessons
    .filter(
      (lesson) =>
        (!classId || lesson.classId === classId) &&
        (kindFilter === 'all' || lesson.kind === 'consultation') &&
        (!onlyMine ||
          state.bookings.some(
            (booking) =>
              booking.lessonId === lesson.id &&
              booking.studentId === state.user.id &&
              booking.status === 'booked',
          )) &&
        (period === 'all' ||
          (period === 'outcomes' &&
            state.consultationOutcomes.some((outcome) => outcome.lessonId === lesson.id)) ||
          (period === 'past' &&
            !lesson.cancelled &&
            Date.parse(lesson.endsAt) <= Date.parse(state.fetchedAt)) ||
          (period === 'upcoming' &&
            !lesson.cancelled &&
            Date.parse(lesson.endsAt) > Date.parse(state.fetchedAt))),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  async function action(type: string, payload: Record<string, unknown>, lessonId: string) {
    if (pending.current) return
    pending.current = true
    setBusyId(lessonId)
    setError('')
    setSuccess('')
    try {
      const result = await props.run(type, payload)
      if (type === 'lesson.join') {
        const value = result.result?.url
        const url = typeof value === 'string' ? new URL(value) : null
        if (
          !url ||
          url.protocol !== 'https:' ||
          (url.hostname !== 'zoom.us' && !url.hostname.endsWith('.zoom.us')) ||
          url.username ||
          url.password ||
          (url.port && url.port !== '443') ||
          !/^\/(j|my)\//.test(url.pathname)
        )
          throw new Error('Invalid meeting response')
        window.location.assign(url.href)
      } else
        setSuccess(
          type === 'booking.create'
            ? tx(vi, 'Đã đặt lịch review 1:1.', '1:1 review reserved.')
            : tx(vi, 'Đã hủy lịch review 1:1.', '1:1 review cancelled.'),
        )
    } catch (cause) {
      setError(errorMessage(cause, locale))
      void props.refresh().catch(() => undefined)
    } finally {
      pending.current = false
      setBusyId('')
    }
  }
  return (
    <div className="live-admin live-personal">
      <div className="live-heading">
        <div>
          {kindFilter === 'consultation' && (
            <h2>{tx(vi, 'Đặt lịch review 1:1', 'Book a 1:1 review')}</h2>
          )}
          <p>
            {student
              ? tx(
                  vi,
                  'Buổi đầu được miễn review. Từ buổi thứ hai, hoàn thành review 1:1 ôn bài trước và chờ giáo viên xác nhận để vào lớp chính. Bạn có thể đặt chỗ trước khi nộp đủ bài.',
                  'The first lesson is exempt. From the second lesson, complete a linked 1:1 review of the previous lesson and obtain teacher confirmation to join the main class. You may reserve before finishing assignments.',
                )
              : tx(
                  vi,
                  'Theo dõi buổi học, giáo viên phụ trách và các lượt đặt lịch.',
                  'View lessons, assigned teachers and reservations.',
                )}
          </p>
        </div>
        {staff && (
          <button
            type="button"
            className="mis-button mis-primary"
            disabled={
              editor !== undefined ||
              Boolean(meetingEditor) ||
              Boolean(outcomeBookingId) ||
              !state.classes.some((room) => room.active)
            }
            onClick={() => {
              setEditor(null)
              setSuccess('')
            }}
          >
            <Plus size={18} />
            {tx(vi, 'Tạo buổi học', 'Create lesson')}
          </button>
        )}
      </div>
      {editor !== undefined && (
        <LessonEditor
          key={editor?.id ?? 'new'}
          props={props}
          lesson={editor}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined)
            setSuccess(tx(vi, 'Đã lưu buổi học.', 'Lesson saved.'))
          }}
        />
      )}
      {meetingEditor && (
        <MeetingLinkEditor
          key={
            meetingEditor.kind === 'class'
              ? `class-${meetingEditor.classId}`
              : `lesson-${meetingEditor.lesson.id}`
          }
          props={props}
          target={meetingEditor}
          onClose={() => setMeetingEditor(null)}
          onSaved={() => {
            setMeetingEditor(null)
            setSuccess(tx(vi, 'Đã lưu thiết lập link Zoom.', 'Zoom link settings saved.'))
          }}
        />
      )}
      {outcomeBookingId && (
        <ConsultationOutcomeEditor
          key={outcomeBookingId}
          props={props}
          bookingId={outcomeBookingId}
          onClose={() => setOutcomeBookingId(null)}
          onSaved={() => {
            setOutcomeBookingId(null)
            setSuccess('review_saved')
          }}
        />
      )}
      <div className="live-toolbar">
        <label className="mis-field live-filter">
          {tx(vi, 'Loại buổi', 'Session type')}
          <select
            value={kindFilter}
            disabled={Boolean(outcomeBookingId)}
            onChange={(event) => setKindFilter(event.target.value as 'all' | 'consultation')}
          >
            <option value="all">{tx(vi, 'Tất cả buổi học', 'All sessions')}</option>
            <option value="consultation">{tx(vi, 'Review 1:1', '1:1 reviews')}</option>
          </select>
        </label>
        <label className="mis-field live-filter">
          {tx(vi, 'Lớp học', 'Class')}
          <select
            value={classId}
            disabled={Boolean(meetingEditor) || Boolean(outcomeBookingId)}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">{tx(vi, 'Tất cả lớp', 'All classes')}</option>
            {state.classes.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title}
              </option>
            ))}
          </select>
        </label>
        <label className="mis-field live-filter">
          {tx(vi, 'Thời gian', 'Period')}
          <select
            value={period}
            disabled={Boolean(outcomeBookingId)}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="upcoming">{tx(vi, 'Sắp tới', 'Upcoming')}</option>
            <option value="past">{tx(vi, 'Đã diễn ra', 'Past sessions')}</option>
            {state.user.role !== 'assistant' && (
              <option value="outcomes">
                {tx(vi, 'Review đã có kết quả', 'Reviews with outcomes')}
              </option>
            )}
            <option value="all">
              {tx(vi, 'Tất cả, gồm lịch đã hủy', 'All, including cancelled')}
            </option>
          </select>
        </label>
        {!student && (
          <button
            type="button"
            className="mis-button"
            disabled={
              !classId ||
              editor !== undefined ||
              Boolean(meetingEditor) ||
              Boolean(outcomeBookingId) ||
              Boolean(busyId)
            }
            onClick={() => {
              setMeetingEditor({ kind: 'class', classId })
              setSuccess('')
              setError('')
            }}
          >
            <PencilSimple size={17} aria-hidden="true" />
            {tx(vi, 'Link Zoom của lớp', 'Class Zoom link')}
          </button>
        )}
        <p className="live-help">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      </div>
      {student && (
        <label className="live-check">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(event) => setOnlyMine(event.target.checked)}
          />
          {tx(vi, 'Chỉ xem lịch review tôi đã đặt', 'Only show my reserved reviews')}
        </label>
      )}
      {!student && (
        <p className="live-help">
          {classId
            ? tx(
                vi,
                'Nhập link chung một lần cho lớp, hoặc chọn “Sửa link Zoom” ở từng buổi để dùng link riêng.',
                'Add a shared class link once, or choose “Edit Zoom link” on a lesson to use a separate link.',
              )
            : tx(
                vi,
                'Chọn một lớp để thêm hoặc đổi link Zoom dùng chung.',
                'Choose a class to add or change its shared Zoom link.',
              )}
        </p>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="live-success" role="status">
          {success === 'review_saved'
            ? tx(vi, 'Đã lưu kết quả review cho học viên.', 'Review outcome saved for the student.')
            : success}
        </p>
      )}
      <section
        className="mis-panel live-agenda"
        aria-label={tx(vi, 'Danh sách buổi học', 'Lesson list')}
      >
        {!lessons.length && (
          <div className="live-empty">
            <CalendarBlank size={28} />
            <p>
              {onlyMine
                ? tx(
                    vi,
                    'Bạn chưa có lịch review đã đặt trong bộ lọc này.',
                    'You have no reserved reviews in this view.',
                  )
                : tx(
                    vi,
                    'Chưa có buổi học trong danh sách này.',
                    'There are no lessons in this view.',
                  )}
            </p>
            <p>
              {onlyMine
                ? tx(
                    vi,
                    'Bỏ chọn “Chỉ xem lịch review tôi đã đặt” để tìm giờ còn trống.',
                    'Clear “Only show my reserved reviews” to find available times.',
                  )
                : staff
                  ? tx(
                      vi,
                      'Tạo lớp và phân công giáo viên, sau đó thêm buổi học thực tế.',
                      'Create a class and assign a teacher, then add its actual lessons.',
                    )
                  : !state.classes.length
                    ? tx(
                        vi,
                        'Đăng ký lớp và chờ duyệt để xem các giờ review dành cho lớp của bạn.',
                        'Request class enrollment and wait for approval to see its review slots.',
                      )
                    : tx(
                        vi,
                        'Lịch sẽ xuất hiện khi giáo viên hoặc quản trị viên thêm buổi học cho lớp của bạn.',
                        'Lessons appear when your teacher or administrator schedules them for your class.',
                      )}
            </p>
          </div>
        )}
        {lessons.map((lesson) => {
          const room = state.classes.find((value) => value.id === lesson.classId)
          const booking = state.bookings.find(
            (value) =>
              value.lessonId === lesson.id &&
              value.studentId === state.user.id &&
              value.status === 'booked',
          )
          const bookings = state.bookings.filter(
            (value) => value.lessonId === lesson.id && value.status === 'booked',
          )
          const lessonOutcomes = state.consultationOutcomes.filter(
            (value) => value.lessonId === lesson.id,
          )
          const ownOutcome = lessonOutcomes.find((value) => value.studentId === state.user.id)
          const mainPreparation = state.mainReviewPreparation?.find(
            (value) => value.lessonId === lesson.id && value.studentId === state.user.id,
          )
          const reservedReview = state.lessons.find(
            (item) => item.id === mainPreparation?.consultationId,
          )
          const review = consultationReview(state.lessons, lesson)
          const invalidReview =
            lesson.kind === 'consultation' && Boolean(lesson.reviewForLessonId) && !review.valid
          const mainBlocked =
            student && lesson.kind === 'class' && !mainReviewAllowsJoin(mainPreparation)
          const mainPreparations =
            state.mainReviewPreparation?.filter((value) => value.lessonId === lesson.id) ?? []
          const ready = preparation(props, lesson.classId)
          const full = lesson.reservedCount >= lesson.capacity
          const joinBlocked =
            lesson.cancelled ||
            !lesson.hasMeeting ||
            mainBlocked ||
            (student && invalidReview) ||
            (student && lesson.kind === 'consultation' && (!booking || ready.missing.length > 0))
          return (
            <article className="live-agenda-item" key={lesson.id}>
              <div className="live-agenda-date">
                <time dateTime={lesson.startsAt}>{dateLabel(lesson.startsAt, vi)}</time>
                <span>
                  {tx(vi, 'Đến', 'Until')} {dateLabel(lesson.endsAt, vi)}
                </span>
              </div>
              <div className="live-agenda-content">
                <div className="live-agenda-title">
                  <h2>{lesson.title}</h2>
                  <span className="mis-status">
                    {lesson.cancelled
                      ? tx(vi, 'Đã hủy', 'Cancelled')
                      : lesson.kind === 'consultation'
                        ? tx(vi, 'Review 1:1', '1:1 review')
                        : tx(vi, 'Lớp chính', 'Main class')}
                  </span>
                  {booking && (
                    <span className="mis-status live-status-success">
                      {tx(vi, 'Đã đặt chỗ', 'Reserved')}
                    </span>
                  )}
                  {lessonOutcomes.length > 0 && (
                    <span className="mis-status">
                      {ownOutcome
                        ? ownOutcome.status === 'completed'
                          ? tx(vi, 'Đã hoàn thành review', 'Review completed')
                          : tx(vi, 'Không tham dự', 'Did not attend')
                        : tx(vi, 'Đã xác nhận kết quả', 'Outcome confirmed')}
                    </span>
                  )}
                  {student &&
                    lesson.kind === 'consultation' &&
                    !lesson.cancelled &&
                    !booking &&
                    Date.parse(lesson.startsAt) > Date.parse(state.fetchedAt) && (
                      <span
                        className={`mis-status ${full || invalidReview ? '' : 'live-status-success'}`}
                      >
                        {invalidReview
                          ? tx(vi, 'Chờ cập nhật lịch', 'Schedule update needed')
                          : full
                            ? tx(vi, 'Đã đủ chỗ', 'Fully booked')
                            : tx(vi, 'Còn chỗ', 'Available')}
                      </span>
                    )}
                </div>
                <p>
                  {room?.title} ·{' '}
                  {state.users.find((user) => user.id === lesson.hostId)?.name ??
                    tx(vi, 'Giáo viên', 'Teacher')}
                </p>
                <p className="live-help">
                  {lesson.hasMeeting
                    ? lesson.meetingSource === 'class'
                      ? tx(vi, 'Zoom · Dùng link chung của lớp', 'Zoom · Shared class link')
                      : tx(vi, 'Zoom · Link riêng của buổi học', 'Zoom · Lesson-specific link')
                    : tx(
                        vi,
                        'Chưa có link Zoom cho buổi này.',
                        'No Zoom link has been set for this lesson.',
                      )}
                </p>
                {lesson.kind === 'consultation' && (
                  <p className="live-help">
                    {review.target && review.previous
                      ? tx(
                          vi,
                          `Ôn bài “${review.previous.title}” để vào “${review.target.title}”.`,
                          `Review “${review.previous.title}” before “${review.target.title}”.`,
                        )
                      : tx(
                          vi,
                          'Review bổ sung chưa liên kết với buổi chính; buổi này không thay cho review bắt buộc.',
                          'Additional review without a main-lesson link; this session does not fulfill the required review.',
                        )}
                    {invalidReview && (
                      <>
                        {' '}
                        {tx(
                          vi,
                          'Lịch đã thay đổi. Giáo viên hoặc quản trị viên cần sửa liên kết hoặc giờ review trước khi đặt chỗ hay tham gia.',
                          'The schedule changed. Your teacher or administrator must update this review’s link or time before booking or joining.',
                        )}
                      </>
                    )}
                  </p>
                )}
                {student && lesson.kind === 'class' && !lesson.cancelled && (
                  <div className="live-preparation">
                    <p>
                      <strong>{reviewLabel(mainPreparation?.status, vi)}</strong>
                    </p>
                    {mainPreparation?.previousLessonId && (
                      <p className="live-help">
                        {tx(vi, 'Kiến thức cần review', 'Previous lesson to review')}:{' '}
                        {state.lessons.find((item) => item.id === mainPreparation.previousLessonId)
                          ?.title ?? tx(vi, 'Bài học trước', 'Previous lesson')}
                      </p>
                    )}
                    {mainPreparation?.status === 'awaiting_confirmation' && (
                      <p className="live-help">
                        {tx(
                          vi,
                          'Giáo viên phụ trách cần xác nhận bạn đã hoàn thành buổi review. Đặt lịch hoặc vào Zoom chưa đồng nghĩa với hoàn thành.',
                          'The host teacher needs to confirm that your review is complete. A reservation or Zoom visit alone does not confirm completion.',
                        )}
                      </p>
                    )}
                    {mainPreparation?.status === 'booked' && reservedReview && (
                      <p className="live-help">
                        {tx(vi, 'Lịch review đã đặt', 'Your reserved review')}:{' '}
                        {dateLabel(reservedReview.startsAt, vi)}
                      </p>
                    )}
                    {!mainPreparation && (
                      <button
                        type="button"
                        className="mis-button"
                        disabled={Boolean(busyId)}
                        onClick={() =>
                          void props
                            .refresh()
                            .catch((cause: unknown) => setError(errorMessage(cause, locale)))
                        }
                      >
                        {tx(vi, 'Tải lại điều kiện tham gia', 'Refresh joining requirements')}
                      </button>
                    )}
                    {mainBlocked && mainPreparation && (
                      <a className="mis-button" href="#schedule/consultations">
                        <CalendarBlank size={17} aria-hidden="true" />
                        {tx(vi, 'Xem lịch review 1:1', 'View 1:1 review slots')}
                      </a>
                    )}
                  </div>
                )}
                {!student &&
                  lesson.kind === 'class' &&
                  !lesson.cancelled &&
                  mainPreparations.length > 0 && (
                    <details className="live-details">
                      <summary>
                        {tx(
                          vi,
                          'Điều kiện review 1:1 của học viên',
                          'Student 1:1 review requirements',
                        )}
                      </summary>
                      <ul className="live-booking-list">
                        {mainPreparations.map((entry) => (
                          <li key={entry.studentId}>
                            <span>
                              {state.users.find((user) => user.id === entry.studentId)?.name ??
                                tx(vi, 'Học viên', 'Student')}
                            </span>
                            <span>{reviewLabel(entry.status, vi)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                {student && lesson.kind === 'consultation' && !lesson.cancelled && !ownOutcome && (
                  <div className="live-preparation">
                    <p>
                      {ready.missing.length
                        ? tx(
                            vi,
                            `Chuẩn bị: đã nộp ${ready.completed}/${ready.total} bài bắt buộc.`,
                            `Preparation: ${ready.completed}/${ready.total} required assignments submitted.`,
                          )
                        : tx(
                            vi,
                            'Đã hoàn thành điều kiện bài tập để tham gia.',
                            'Assignment requirements for joining are complete.',
                          )}
                    </p>
                    {ready.missing.length > 0 && (
                      <p className="live-help">
                        {tx(vi, 'Còn thiếu', 'Remaining')}:{' '}
                        {ready.missing.map((task) => task.title[locale]).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                {!student && lesson.kind === 'consultation' && (
                  <details className="live-details">
                    <summary>
                      {tx(
                        vi,
                        `${bookings.length}/${lesson.capacity} chỗ đã đặt`,
                        `${bookings.length}/${lesson.capacity} places reserved`,
                      )}
                    </summary>
                    {bookings.length ? (
                      <ul className="live-booking-list">
                        {bookings.map((value) => {
                          const prep = preparation(props, lesson.classId, value.studentId)
                          return (
                            <li key={value.id}>
                              <span>
                                {state.users.find((user) => user.id === value.studentId)?.name ??
                                  value.studentId}
                              </span>
                              <span>
                                {tx(
                                  vi,
                                  `Đã nộp ${prep.completed}/${prep.total} bài`,
                                  `${prep.completed}/${prep.total} submitted`,
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="live-help">
                        {tx(vi, 'Chưa có lượt đặt lịch.', 'No reservations yet.')}
                      </p>
                    )}
                  </details>
                )}
                <div className="live-actions">
                  {student &&
                    lesson.kind === 'consultation' &&
                    !lesson.cancelled &&
                    !ownOutcome &&
                    (booking ? (
                      <button
                        type="button"
                        className="mis-button"
                        disabled={Boolean(busyId)}
                        onClick={() =>
                          void action(
                            'booking.cancel',
                            { id: booking.id, expectedVersion: booking.version },
                            lesson.id,
                          )
                        }
                      >
                        {busyId === lesson.id
                          ? tx(vi, 'Đang xử lý…', 'Working…')
                          : tx(vi, 'Hủy đặt chỗ', 'Cancel reservation')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="mis-button"
                        disabled={
                          Boolean(busyId) ||
                          full ||
                          invalidReview ||
                          Date.parse(lesson.startsAt) <= Date.parse(state.fetchedAt)
                        }
                        onClick={() =>
                          void action(
                            'booking.create',
                            { lessonId: lesson.id, expectedVersion: lesson.version },
                            lesson.id,
                          )
                        }
                      >
                        {busyId === lesson.id
                          ? tx(vi, 'Đang xử lý…', 'Working…')
                          : full
                            ? tx(vi, 'Đã đủ chỗ', 'Fully booked')
                            : tx(vi, 'Đặt lịch review 1:1', 'Book 1:1 review')}
                      </button>
                    ))}
                  {!lesson.cancelled && (
                    <button
                      type="button"
                      className="mis-button"
                      disabled={Boolean(busyId) || Boolean(outcomeBookingId) || joinBlocked}
                      onClick={() => void action('lesson.join', { id: lesson.id }, lesson.id)}
                    >
                      <ArrowSquareOut size={17} />
                      {tx(vi, 'Tham gia Zoom', 'Join Zoom')}
                    </button>
                  )}
                  {staff && (
                    <button
                      type="button"
                      className="mis-button"
                      disabled={
                        editor !== undefined ||
                        Boolean(meetingEditor) ||
                        Boolean(outcomeBookingId) ||
                        Boolean(busyId)
                      }
                      onClick={() => {
                        setEditor(lesson)
                        setSuccess('')
                      }}
                    >
                      <PencilSimple size={17} />
                      {tx(vi, 'Sửa / hủy buổi', 'Edit / cancel lesson')}
                    </button>
                  )}
                  {!student && (
                    <button
                      type="button"
                      className="mis-button"
                      disabled={
                        editor !== undefined ||
                        Boolean(meetingEditor) ||
                        Boolean(outcomeBookingId) ||
                        Boolean(busyId)
                      }
                      onClick={() => {
                        setMeetingEditor({ kind: 'lesson', lesson })
                        setSuccess('')
                        setError('')
                      }}
                    >
                      <PencilSimple size={17} aria-hidden="true" />
                      {tx(vi, 'Sửa link Zoom', 'Edit Zoom link')}
                    </button>
                  )}
                </div>
                <ConsultationOutcomePanel
                  props={props}
                  lesson={lesson}
                  disabled={
                    editor !== undefined ||
                    Boolean(meetingEditor) ||
                    Boolean(outcomeBookingId) ||
                    Boolean(busyId)
                  }
                  onEdit={(bookingId) => {
                    setOutcomeBookingId(bookingId)
                    setSuccess('')
                    setError('')
                  }}
                />
              </div>
            </article>
          )
        })}
      </section>
      <p className="live-help">
        {tx(
          vi,
          'Quản trị viên, giáo viên hoặc trợ giảng của lớp thêm link Zoom. Học viên tham gia qua nút Zoom của từng buổi.',
          'Administrators, assigned teachers or teaching assistants add Zoom links. Students join using each lesson’s Zoom button.',
        )}
      </p>
    </div>
  )
}

function WordEditor({
  props,
  word,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  word: Word | null
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [values, setValues] = useState({
    word: word?.word ?? '',
    meaning: word?.meaning ?? '',
    example: word?.example ?? '',
    topic: word?.topic ?? '',
  })
  const [initialValues] = useState(JSON.stringify(values))
  const [baseline, setBaseline] = useState(word)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const latest = word ? props.state.words.find((value) => value.id === word.id) : null
  const available = props.state.user.active && (!word || Boolean(latest))
  const changed = Boolean(word && latest && latest.version !== baseline?.version)
  const dirty = JSON.stringify(values) !== initialValues
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  useEffect(() => {
    if (!dirty && !busy && !refreshing) return
    const allowLeave = () =>
      !pending.current &&
      !refreshing &&
      window.confirm(
        tx(
          vi,
          'Từ vựng có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?',
          'This word has unsaved changes. Leave and discard them?',
        ),
      )
    const unload = (event: BeforeUnloadEvent) => event.preventDefault()
    const routeLeave = (event: Event) => {
      if (!allowLeave()) event.preventDefault()
    }
    const leave = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href], .mis-signout') : null
      if (!anchor || anchor.getAttribute('href')?.startsWith('#')) return
      if (!anchor.hasAttribute('download') && !allowLeave()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('project-l:before-leave', routeLeave)
    document.addEventListener('click', leave, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('project-l:before-leave', routeLeave)
      document.removeEventListener('click', leave, true)
    }
  }, [dirty, busy, refreshing, vi])
  function close() {
    if (pending.current || refreshing) return
    if (
      !dirty ||
      window.confirm(
        tx(
          vi,
          'Từ vựng có thay đổi chưa lưu. Đóng và bỏ các thay đổi?',
          'This word has unsaved changes. Close and discard them?',
        ),
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
      setError(errorMessage(cause, props.locale))
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
      await props.run('word.save', {
        ...values,
        ...(word ? { id: word.id } : {}),
        expectedVersion: baseline?.version ?? 0,
      })
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause, props.locale))
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status))
        await props.refresh().catch(() => undefined)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form className="mis-panel live-editor" onSubmit={save}>
      <div className="live-heading">
        <h2 ref={heading} tabIndex={-1}>
          {word ? tx(vi, 'Sửa từ vựng', 'Edit word') : tx(vi, 'Thêm từ vựng', 'Add word')}
        </h2>
        <button
          type="button"
          className="mis-button"
          disabled={busy || refreshing}
          onClick={close}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      {!available && (
        <p role="alert" className="live-error">
          {tx(
            vi,
            'Từ vựng này không còn khả dụng. Nội dung bạn nhập được giữ để sao chép; không thể lưu vào từ đã bị xóa.',
            'This word is no longer available. Your input is preserved for copying; a deleted word cannot be updated.',
          )}
        </p>
      )}
      {changed && latest && (
        <div className="mis-stack">
          <p role="alert" className="live-help">
            {tx(
              vi,
              'Từ vựng hoặc lịch ôn đã thay đổi ở nơi khác. Kiểm tra nội dung mới bên dưới trước khi tiếp tục. Nội dung đang nhập vẫn được giữ.',
              'This word or its review schedule changed elsewhere. Check the latest content below before continuing. Your input is preserved.',
            )}
          </p>
          <details className="live-details">
            <summary>{tx(vi, 'Xem nội dung đang lưu', 'View saved content')}</summary>
            <p className="live-prose">
              <strong>{latest.word}</strong>
              {latest.topic ? ` · ${latest.topic}` : ''}
            </p>
            <p className="live-prose">{latest.meaning}</p>
            {latest.example && <p className="live-word-example">{latest.example}</p>}
          </details>
          <div className="live-actions">
            <button
              type="button"
              className="mis-button"
              disabled={busy || refreshing || !available}
              onClick={() => {
                setBaseline(latest)
                setError('')
              }}
            >
              {tx(
                vi,
                'Giữ nội dung nhập và dùng phiên bản mới',
                'Keep my input and use the latest version',
              )}
            </button>
          </div>
        </div>
      )}
      <fieldset className="live-fieldset" disabled={busy || refreshing}>
        <div className="live-form-grid">
          <label className="mis-field">
            {tx(vi, 'Từ / cụm từ', 'Word / phrase')}
            <input
              required
              maxLength={150}
              value={values.word}
              onChange={(event) => setValues({ ...values, word: event.target.value })}
            />
          </label>
          <label className="mis-field">
            {tx(vi, 'Chủ đề', 'Topic')}
            <input
              maxLength={150}
              value={values.topic}
              onChange={(event) => setValues({ ...values, topic: event.target.value })}
            />
          </label>
          <label className="mis-field live-wide">
            {tx(vi, 'Nghĩa', 'Meaning')}
            <textarea
              required
              rows={3}
              maxLength={2000}
              value={values.meaning}
              onChange={(event) => setValues({ ...values, meaning: event.target.value })}
            />
          </label>
          <label className="mis-field live-wide">
            {tx(vi, 'Câu ví dụ', 'Example sentence')}
            <textarea
              rows={3}
              maxLength={3000}
              value={values.example}
              onChange={(event) => setValues({ ...values, example: event.target.value })}
            />
          </label>
        </div>
        {word && (
          <p className="live-help">
            {tx(
              vi,
              'Đổi từ hoặc nghĩa sẽ bắt đầu lịch ôn mới. Chỉ sửa ví dụ hoặc chủ đề sẽ giữ lịch ôn hiện tại.',
              'Changing the word or meaning starts a new review schedule. Editing only the example or topic keeps your current schedule.',
            )}
          </p>
        )}
        <div className="live-actions">
          <button type="submit" className="mis-button mis-primary" disabled={!available || changed}>
            {busy ? tx(vi, 'Đang lưu…', 'Saving…') : tx(vi, 'Lưu từ vựng', 'Save word')}
          </button>
          <button type="button" className="mis-button" onClick={close}>
            {tx(vi, 'Hủy', 'Cancel')}
          </button>
        </div>
      </fieldset>
      {error && (
        <div className="mis-stack">
          <p role="alert" className="live-error">
            {error}
          </p>
          <div className="live-actions">
            <button
              type="button"
              className="mis-button"
              disabled={busy || refreshing}
              onClick={() => void refresh()}
            >
              {refreshing
                ? tx(vi, 'Đang kiểm tra…', 'Checking…')
                : tx(vi, 'Kiểm tra dữ liệu mới', 'Check for updates')}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

export function NotebookView(props: LiveViewProps) {
  const vi = props.locale === 'vi'
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [editor, setEditor] = useState<Word | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Word | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const pending = useRef(false)
  const dueCount = props.state.words.filter(
    (word) =>
      !word.practice.dueAt || Date.parse(word.practice.dueAt) <= Date.parse(props.state.fetchedAt),
  ).length
  const topics = [...new Set(props.state.words.map((word) => word.topic).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, props.locale),
  )
  const words = props.state.words.filter(
    (word) =>
      (!topic || word.topic === topic) &&
      `${word.word} ${word.meaning} ${word.topic}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  )
  async function remove() {
    if (!deleting || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await props.run('word.delete', { id: deleting.id, expectedVersion: deleting.version })
      setDeleting(null)
      setSuccess(tx(vi, 'Đã xóa từ vựng.', 'Word deleted.'))
    } catch (cause) {
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status)) {
        setDeleting(null)
        setError(
          cause.status === 409
            ? tx(
                vi,
                'Từ vựng đã thay đổi. Hãy kiểm tra nội dung mới và chọn Xóa lại nếu vẫn muốn xóa.',
                'This word has changed. Check the latest content, then select Delete again if you still want to remove it.',
              )
            : errorMessage(cause, props.locale),
        )
        await props.refresh().catch(() => undefined)
      } else setError(errorMessage(cause, props.locale))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <div className="live-admin live-personal">
      <div className="live-heading">
        <div>
          <p>
            {tx(
              vi,
              'Lưu từ, nghĩa và ví dụ riêng cho tài khoản của bạn.',
              'Save words, meanings and examples privately in your account.',
            )}
          </p>
          <p className="live-help">
            {props.state.words.length
              ? tx(
                  vi,
                  `${dueCount} từ cần ôn trong sổ từ vựng. Ôn bằng cách nhớ lại nghĩa và tự đánh giá.`,
                  `${dueCount} ${dueCount === 1 ? 'word' : 'words'} due in your notebook. Recall each meaning and rate your recall.`,
                )
              : tx(
                  vi,
                  'Thêm từ đầu tiên để bắt đầu ôn tập và lưu lịch ôn riêng.',
                  'Add your first word to start practising and save your review schedule.',
                )}
          </p>
        </div>
        <div className="live-actions">
          {props.state.words.length ? (
            <a className="mis-button mis-primary" href="#notebook/practice">
              {tx(vi, 'Ôn từ đến hạn', 'Review due words')} ({dueCount})
            </a>
          ) : (
            <button type="button" className="mis-button mis-primary" disabled>
              {tx(vi, 'Ôn từ đến hạn', 'Review due words')}
            </button>
          )}
          <button
            type="button"
            className="mis-button"
            disabled={editor !== undefined || busy}
            onClick={() => {
              setEditor(null)
              setSuccess('')
              setDeleting(null)
            }}
          >
            <Plus size={18} />
            {tx(vi, 'Thêm từ', 'Add word')}
          </button>
        </div>
      </div>
      {editor !== undefined && (
        <WordEditor
          key={editor?.id ?? 'new'}
          props={props}
          word={editor}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined)
            setSuccess(tx(vi, 'Đã lưu từ vựng.', 'Word saved.'))
          }}
        />
      )}
      <div className="mis-toolbar">
        <label className="mis-field live-notebook-search">
          {tx(vi, 'Tìm từ, nghĩa hoặc chủ đề', 'Search word, meaning or topic')}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="mis-field">
          {tx(vi, 'Chủ đề', 'Topic')}
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">{tx(vi, 'Tất cả chủ đề', 'All topics')}</option>
            {topic && !topics.includes(topic) && <option value={topic}>{topic}</option>}
            {topics.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {(query || topic) && (
          <button
            type="button"
            className="mis-button"
            onClick={() => {
              setQuery('')
              setTopic('')
            }}
          >
            {tx(vi, 'Xóa bộ lọc', 'Clear filters')}
          </button>
        )}
      </div>
      {deleting && (
        <div className="mis-panel live-delete-confirm">
          <p>
            {tx(
              vi,
              `Xóa “${deleting.word}” khỏi sổ từ vựng?`,
              `Delete “${deleting.word}” from your notebook?`,
            )}
          </p>
          <div className="live-actions">
            <button
              type="button"
              className="mis-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash size={17} />
              {busy ? tx(vi, 'Đang xóa…', 'Deleting…') : tx(vi, 'Xóa từ', 'Delete word')}
            </button>
            <button
              type="button"
              className="mis-button"
              disabled={busy}
              onClick={() => {
                setDeleting(null)
                setError('')
              }}
            >
              {tx(vi, 'Giữ lại', 'Keep word')}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="live-success" role="status">
          {success}
        </p>
      )}
      <section
        className="mis-panel live-word-list"
        aria-label={tx(vi, 'Từ vựng đã lưu', 'Saved vocabulary')}
      >
        {!words.length && (
          <div className="live-empty">
            <p>
              {query || topic
                ? tx(
                    vi,
                    'Không tìm thấy từ phù hợp. Thử đổi từ khóa hoặc chủ đề.',
                    'No matching words. Try another search or topic.',
                  )
                : tx(
                    vi,
                    'Sổ từ vựng của bạn chưa có từ nào. Thêm từ và một câu ví dụ để bắt đầu.',
                    'Your notebook is empty. Add a word and an example sentence to begin.',
                  )}
            </p>
          </div>
        )}
        {words.map((word) => (
          <article className="live-word-row" key={word.id}>
            <div>
              <div className="live-agenda-title">
                <h2>{word.word}</h2>
                {word.topic && <span className="mis-status">{word.topic}</span>}
              </div>
              <p className="live-prose">{word.meaning}</p>
              {word.example && <p className="live-word-example">{word.example}</p>}
              {word.source && (
                <div className="live-help">
                  <p>
                    {tx(vi, 'Từ bài học', 'From assignment')}:{' '}
                    {props.state.assignments.some(
                      (assignment) => assignment.id === word.source!.assignmentId,
                    ) ? (
                      <a href={`#assignment/${word.source.assignmentId}`}>
                        {word.source.title[props.locale]}
                      </a>
                    ) : (
                      word.source.title[props.locale]
                    )}
                    {' · '}
                    {tx(vi, 'Phiên bản', 'Version')} {word.source.assignmentVersion}
                  </p>
                  {word.source.context && <p className="live-prose">{word.source.context}</p>}
                </div>
              )}
              <p className="live-help">
                {word.practice.lastReviewedAt
                  ? `${tx(vi, 'Ôn gần nhất', 'Last reviewed')}: ${dateLabel(word.practice.lastReviewedAt, vi)}`
                  : tx(vi, 'Chưa ôn lần nào', 'Not reviewed yet')}
                {' · '}
                {!word.practice.dueAt ||
                Date.parse(word.practice.dueAt) <= Date.parse(props.state.fetchedAt)
                  ? tx(vi, 'Đến hạn ôn', 'Due for review')
                  : `${tx(vi, 'Ôn tiếp', 'Next review')}: ${dateLabel(word.practice.dueAt, vi)}`}
              </p>
            </div>
            <div className="live-actions">
              <button
                type="button"
                className="mis-button"
                disabled={editor !== undefined || busy}
                onClick={() => {
                  setEditor(word)
                  setDeleting(null)
                  setSuccess('')
                }}
                aria-label={tx(vi, `Sửa từ ${word.word}`, `Edit ${word.word}`)}
              >
                <PencilSimple size={17} />
                {tx(vi, 'Sửa', 'Edit')}
              </button>
              <button
                type="button"
                className="mis-button"
                disabled={editor !== undefined || busy}
                onClick={() => {
                  setDeleting(word)
                  setError('')
                  setSuccess('')
                }}
                aria-label={tx(vi, `Xóa từ ${word.word}`, `Delete ${word.word}`)}
              >
                <Trash size={17} />
                {tx(vi, 'Xóa', 'Delete')}
              </button>
            </div>
          </article>
        ))}
      </section>
      <p className="live-help">
        {tx(
          vi,
          'Luyện tập từ vựng bằng AI chưa được kết nối.',
          'AI vocabulary practice is not connected.',
        )}
      </p>
    </div>
  )
}

export function AccountView(props: LiveViewProps) {
  const vi = props.locale === 'vi'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const pending = useRef(false)
  const roleName = {
    admin: tx(vi, 'Quản trị viên', 'Administrator'),
    teacher: tx(vi, 'Giáo viên', 'Teacher'),
    assistant: tx(vi, 'Trợ giảng', 'Teaching assistant'),
    student: tx(vi, 'Học viên', 'Student'),
  }[props.state.user.role]
  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError(tx(vi, 'Mật khẩu xác nhận chưa khớp.', 'The password confirmation does not match.'))
      return
    }
    if (new TextEncoder().encode(newPassword).length > 256) {
      setError(
        tx(
          vi,
          'Mật khẩu mới dài quá giới hạn 256 byte.',
          'The new password exceeds the 256-byte limit.',
        ),
      )
      return
    }
    pending.current = true
    setBusy(true)
    try {
      await apiRequest('auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(
        tx(
          vi,
          'Đã đổi mật khẩu. Các phiên đăng nhập khác đã được đăng xuất.',
          'Password changed. Other sign-in sessions have been signed out.',
        ),
      )
    } catch (cause) {
      setError(
        cause instanceof PortalApiError && cause.status === 400
          ? tx(
              vi,
              'Kiểm tra mật khẩu hiện tại và mật khẩu mới (ít nhất 12 ký tự).',
              'Check your current password and the new password (at least 12 characters).',
            )
          : errorMessage(cause, props.locale),
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <div className="live-admin live-personal">
      <div className="live-heading">
        <div>
          <p>
            {tx(
              vi,
              'Thông tin tài khoản và bảo mật đăng nhập của bạn.',
              'Your account information and sign-in security.',
            )}
          </p>
        </div>
      </div>
      <section className="mis-panel">
        <h2>{tx(vi, 'Thông tin cá nhân', 'Profile')}</h2>
        <dl className="live-account-details">
          <div>
            <dt>{tx(vi, 'Họ và tên', 'Full name')}</dt>
            <dd>{props.state.user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{props.state.user.email}</dd>
          </div>
          <div>
            <dt>{tx(vi, 'Vai trò', 'Role')}</dt>
            <dd>{roleName}</dd>
          </div>
          <div>
            <dt>{tx(vi, 'Trạng thái', 'Status')}</dt>
            <dd>
              <span className="mis-status live-status-success">
                {tx(vi, 'Đang hoạt động', 'Active')}
              </span>
            </dd>
          </div>
        </dl>
        <p className="live-help">
          {tx(
            vi,
            'Liên hệ quản trị viên để cập nhật họ tên hoặc email.',
            'Contact your administrator to update your name or email.',
          )}
        </p>
      </section>
      <form className="mis-panel live-password-form" onSubmit={save}>
        <h2>{tx(vi, 'Đổi mật khẩu', 'Change password')}</h2>
        <p className="live-help">
          {tx(
            vi,
            'Dùng ít nhất 12 ký tự. Sau khi đổi, các phiên đăng nhập khác sẽ kết thúc.',
            'Use at least 12 characters. Changing your password ends other sign-in sessions.',
          )}
        </p>
        <fieldset className="live-fieldset" disabled={busy}>
          <div className="live-form-grid">
            <label className="mis-field live-wide">
              {tx(vi, 'Mật khẩu hiện tại', 'Current password')}
              <input
                type="password"
                required
                autoComplete="current-password"
                maxLength={256}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="mis-field">
              {tx(vi, 'Mật khẩu mới', 'New password')}
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="mis-field">
              {tx(vi, 'Nhập lại mật khẩu mới', 'Confirm new password')}
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>
          <div className="live-actions">
            <button type="submit" className="mis-button mis-primary">
              {busy ? tx(vi, 'Đang đổi…', 'Changing…') : tx(vi, 'Đổi mật khẩu', 'Change password')}
            </button>
          </div>
        </fieldset>
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="live-success" role="status">
            <Check size={17} />
            {success}
          </p>
        )}
      </form>
      {props.state.user.role === 'admin' && (
        <>
          <DriveConnectionSettings locale={props.locale} />
          <StarterCurriculumSettings {...props} />
          <EmailDeliveryStatus locale={props.locale} />
        </>
      )}
      <IntegrationStatus locale={props.locale} />
    </div>
  )
}
