/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The labeled table region supports keyboard scrolling. */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { EnrollmentRequest, Locale } from '../../../shared/portal'
import { PortalApiError } from '@/features/auth/client'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import '@/styles/live-administration.css'
import '@/styles/live-personal.css'

function requestStatus(status: EnrollmentRequest['status'], locale: Locale) {
  const labels = {
    pending: { vi: 'Chờ duyệt', en: 'Pending approval' },
    approved: { vi: 'Đã duyệt', en: 'Approved' },
    rejected: { vi: 'Chưa được duyệt', en: 'Declined' },
    cancelled: { vi: 'Đã hủy yêu cầu', en: 'Cancelled' },
  }
  return labels[status][locale]
}

function requestDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function StudentEnrollmentView(props: LiveViewProps & { initialView?: 'open' }) {
  const { state, locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const ownClasses = state.classes.filter((room) => room.studentIds.includes(state.user.id))
  const [view, setView] = useState<'own' | 'open' | 'history'>(
    props.initialView ?? (ownClasses.length ? 'own' : 'open'),
  )
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const pending = useRef(false)
  const requests = state.enrollmentRequests
    .filter((request) => request.studentId === state.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const openClasses = state.openClasses.filter((room) => room.enrollmentOpen)
  const levels = [...new Set(openClasses.map((room) => room.level).filter(Boolean))].sort()
  const search = query.trim().toLocaleLowerCase(locale)
  const matches = openClasses.filter(
    (room) =>
      (!level || room.level === level) &&
      `${room.title} ${room.level} ${room.description}`.toLocaleLowerCase(locale).includes(search),
  )

  async function action(
    type: 'enrollment.request' | 'enrollment.cancel',
    id: string,
    version?: number,
  ) {
    if (pending.current) return
    pending.current = true
    setBusyId(id)
    setError('')
    setSuccess('')
    try {
      await props.run(
        type,
        type === 'enrollment.request' ? { classId: id } : { id, expectedVersion: version },
      )
      setSuccess(
        type === 'enrollment.request'
          ? t(
              'Đã gửi yêu cầu. Bạn sẽ được vào lớp sau khi quản trị viên duyệt.',
              'Your request was sent. You can access the class after an administrator approves it.',
            )
          : t('Đã hủy yêu cầu đăng ký.', 'Your enrollment request was cancelled.'),
      )
    } catch (cause) {
      setError(errorMessage(cause, locale))
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status))
        await props.refresh().catch(() => undefined)
    } finally {
      pending.current = false
      setBusyId('')
    }
  }

  if (state.user.role !== 'student') return null
  return (
    <div className="live-admin live-personal">
      <div className="live-heading">
        <p>
          {t(
            'Theo dõi lớp đang học và gửi yêu cầu tham gia lớp mới. Quản trị viên sẽ xét duyệt trước khi bạn được truy cập nội dung lớp.',
            'View your classes and request to join a new one. An administrator reviews each request before class content becomes available.',
          )}
        </p>
      </div>
      <div className="live-actions" role="group" aria-label={t('Xem lớp học', 'Class views')}>
        {(
          [
            ['own', `${t('Lớp của tôi', 'My classes')} (${ownClasses.length})`],
            ['open', t('Lớp mở đăng ký', 'Open for enrollment')],
            ['history', `${t('Yêu cầu của tôi', 'My requests')} (${requests.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`mis-button${view === value ? ' mis-primary' : ''}`}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </div>
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
      {view === 'own' && (
        <section
          className="mis-panel live-content-list"
          aria-label={t('Lớp của tôi', 'My classes')}
        >
          {ownClasses.length ? (
            ownClasses.map((room) => (
              <article className="live-content-item" key={room.id}>
                <div className="live-heading">
                  <div>
                    <h2>{room.title}</h2>
                    <p>{room.level}</p>
                  </div>
                  <span className={`mis-status${room.active ? ' live-status-success' : ''}`}>
                    {room.active ? t('Đã ghi danh', 'Enrolled') : t('Lớp đã đóng', 'Class closed')}
                  </span>
                </div>
                {room.description && <p className="live-prose">{room.description}</p>}
                <p className="live-help">
                  {t('Giáo viên', 'Teachers')}:{' '}
                  {room.teacherIds
                    .map((id) => state.users.find((user) => user.id === id)?.name)
                    .filter(Boolean)
                    .join(', ') || t('Chưa phân công', 'Not assigned yet')}
                </p>
                {room.active && (
                  <div className="live-actions">
                    <a className="mis-button" href="#schedule">
                      {t('Xem lịch học', 'View schedule')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </a>
                    <a className="mis-button" href="#assignments">
                      {t('Xem bài tập', 'View assignments')}
                    </a>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="live-empty">
              <p>
                {t('Bạn chưa được ghi danh vào lớp nào.', 'You are not enrolled in a class yet.')}
              </p>
              <button className="mis-button" type="button" onClick={() => setView('open')}>
                {t('Tìm lớp mở đăng ký', 'Find an open class')}
              </button>
            </div>
          )}
        </section>
      )}
      {view === 'open' && (
        <>
          <div className="live-toolbar">
            <label className="live-search">
              <MagnifyingGlass size={18} aria-hidden="true" />
              <input
                type="search"
                className="mis-field"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t('Tìm lớp mở đăng ký', 'Search open classes')}
                placeholder={t('Tìm tên lớp, trình độ…', 'Search classes, levels…')}
              />
            </label>
            <label className="mis-field live-filter">
              {t('Trình độ', 'Level')}
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="">{t('Tất cả trình độ', 'All levels')}</option>
                {levels.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <span className="live-help">
              {matches.length} {t('lớp', 'classes')}
            </span>
          </div>
          <section
            className="mis-panel live-content-list"
            aria-label={t('Lớp mở đăng ký', 'Open classes')}
          >
            {matches.length ? (
              matches.map((room) => {
                const enrolled = ownClasses.some((value) => value.id === room.id)
                const request = requests.find(
                  (value) => value.classId === room.id && value.status === 'pending',
                )
                return (
                  <article className="live-content-item" key={room.id}>
                    <div className="live-heading">
                      <div>
                        <h2>{room.title}</h2>
                        <p>{room.level}</p>
                      </div>
                      {(enrolled || request) && (
                        <span className={`mis-status${enrolled ? ' live-status-success' : ''}`}>
                          {enrolled
                            ? t('Đã ghi danh', 'Enrolled')
                            : t('Chờ quản trị viên duyệt', 'Awaiting admin approval')}
                        </span>
                      )}
                    </div>
                    {room.description && <p className="live-prose">{room.description}</p>}
                    <div className="live-actions">
                      {enrolled ? (
                        <button type="button" className="mis-button" onClick={() => setView('own')}>
                          {t('Xem lớp của tôi', 'View my classes')}
                        </button>
                      ) : request ? (
                        <button
                          type="button"
                          className="mis-button"
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            void action('enrollment.cancel', request.id, request.version)
                          }
                        >
                          {busyId === request.id
                            ? t('Đang hủy…', 'Cancelling…')
                            : t('Hủy yêu cầu', 'Cancel request')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mis-button mis-primary"
                          disabled={Boolean(busyId)}
                          onClick={() => void action('enrollment.request', room.id)}
                        >
                          {busyId === room.id
                            ? t('Đang gửi…', 'Sending…')
                            : t('Gửi yêu cầu đăng ký', 'Request enrollment')}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="live-empty">
                <p>
                  {query || level
                    ? t('Không có lớp phù hợp với bộ lọc.', 'No classes match these filters.')
                    : t(
                        'Chưa có lớp đang mở đăng ký. Lớp mới sẽ xuất hiện khi quản trị viên mở đăng ký.',
                        'No classes are open for enrollment yet. New classes will appear when an administrator opens enrollment.',
                      )}
                </p>
                {(query || level) && (
                  <button
                    type="button"
                    className="mis-button"
                    onClick={() => {
                      setQuery('')
                      setLevel('')
                    }}
                  >
                    {t('Xóa bộ lọc', 'Clear filters')}
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {view === 'history' && (
        <section
          className="mis-panel live-content-list"
          aria-label={t('Yêu cầu đăng ký của tôi', 'My enrollment requests')}
        >
          {requests.length ? (
            requests.map((request) => (
              <article className="live-content-item" key={request.id}>
                <div className="live-heading">
                  <div>
                    <h2>{request.classTitle}</h2>
                    <p>
                      <time dateTime={request.createdAt}>
                        {requestDate(request.createdAt, locale)}
                      </time>
                    </p>
                  </div>
                  <span
                    className={`mis-status${request.status === 'approved' ? ' live-status-success' : ''}`}
                  >
                    {requestStatus(request.status, locale)}
                  </span>
                </div>
                {request.note && (
                  <p className="live-prose">
                    <strong>{t('Phản hồi của quản trị viên', 'Administrator note')}: </strong>
                    {request.note}
                  </p>
                )}
                {request.status === 'pending' && (
                  <button
                    type="button"
                    className="mis-button"
                    disabled={Boolean(busyId)}
                    onClick={() => void action('enrollment.cancel', request.id, request.version)}
                  >
                    {busyId === request.id
                      ? t('Đang hủy…', 'Cancelling…')
                      : t('Hủy yêu cầu', 'Cancel request')}
                  </button>
                )}
                {request.status === 'approved' &&
                  ownClasses.some((room) => room.id === request.classId) && (
                    <button type="button" className="mis-button" onClick={() => setView('own')}>
                      {t('Xem lớp của tôi', 'View my classes')}
                    </button>
                  )}
              </article>
            ))
          ) : (
            <div className="live-empty">
              <p>
                {t('Bạn chưa gửi yêu cầu đăng ký nào.', 'You have not requested enrollment yet.')}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function EnrollmentReviewEditor({
  props,
  request,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  request: EnrollmentRequest
  onClose: () => void
  onSaved: () => void
}) {
  const { state, locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const [expectedVersion, setExpectedVersion] = useState(request.version)
  const [note, setNote] = useState(request.note)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null)
  const [conflicted, setConflicted] = useState(false)
  const [freshAfterConflict, setFreshAfterConflict] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const latest = state.enrollmentRequests.find((value) => value.id === request.id)
  const student = state.users.find((value) => value.id === request.studentId)
  const room = state.classes.find((value) => value.id === request.classId)
  const dirty = note !== request.note
  const changed = latest?.version !== expectedVersion
  const canReview = state.user.role === 'admin' && state.user.active && latest?.status === 'pending'
  const canApprove = Boolean(
    room?.active &&
    room.listed &&
    room.enrollmentOpen &&
    student?.active &&
    student.role === 'student',
  )
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  useEffect(() => {
    if (!dirty && !busy) return
    const unload = (event: BeforeUnloadEvent) => event.preventDefault()
    const allowLeave = () =>
      !pending.current &&
      window.confirm(
        locale === 'vi'
          ? 'Phản hồi chưa được lưu. Rời trang và bỏ nội dung này?'
          : 'Your review note is not saved. Leave and discard it?',
      )
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
  }, [dirty, busy, locale])
  function close() {
    if (
      !pending.current &&
      (!dirty ||
        window.confirm(
          t(
            'Phản hồi chưa được lưu. Đóng và bỏ nội dung này?',
            'Your review note is not saved. Close and discard it?',
          ),
        ))
    )
      onClose()
  }
  async function refresh() {
    if (refreshing || pending.current) return
    setRefreshing(true)
    try {
      await props.refresh()
      setFreshAfterConflict(true)
    } catch (cause) {
      setError(errorMessage(cause, locale))
    } finally {
      setRefreshing(false)
    }
  }
  async function review(event: FormEvent, decision: 'approved' | 'rejected') {
    event.preventDefault()
    if (
      pending.current ||
      refreshing ||
      !canReview ||
      changed ||
      conflicted ||
      (decision === 'approved' && !canApprove)
    )
      return
    pending.current = true
    setBusy(decision)
    setFreshAfterConflict(false)
    setError('')
    try {
      await props.run('enrollment.review', {
        id: request.id,
        expectedVersion,
        decision,
        note: note.trim(),
      })
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause, locale))
      if (cause instanceof PortalApiError && cause.status === 409) setConflicted(true)
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status))
        await props
          .refresh()
          .then(() => setFreshAfterConflict(true))
          .catch(() => undefined)
    } finally {
      pending.current = false
      setBusy(null)
    }
  }
  return (
    <form className="mis-panel live-editor" onSubmit={(event) => void review(event, 'approved')}>
      <div className="live-heading">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {t('Xét duyệt đăng ký', 'Review enrollment')}
          </h2>
          <p>
            {student?.name ?? request.studentId} · {request.classTitle}
          </p>
          {student?.email && <p>{student.email}</p>}
        </div>
        <button
          type="button"
          className="mis-button"
          disabled={Boolean(busy)}
          onClick={close}
          aria-label={t('Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="live-help">
        {t(
          'Duyệt yêu cầu sẽ ghi danh học viên vào lớp và mở quyền truy cập nội dung theo vai trò học viên. Phản hồi được gửi kèm trong lịch sử đăng ký của học viên.',
          'Approval enrolls the learner in the class and grants student access to its content. Your note appears in the learner’s enrollment history.',
        )}
      </p>
      {!canReview && (
        <p className="live-error" role="alert">
          {latest
            ? `${t('Trạng thái hiện tại', 'Current status')}: ${requestStatus(latest.status, locale)}. ${t('Yêu cầu này không còn có thể xét duyệt. Nội dung bạn nhập được giữ lại.', 'This request can no longer be reviewed. Your note is kept.')}`
            : t(
                'Yêu cầu không còn khả dụng. Nội dung bạn nhập được giữ lại.',
                'This request is no longer available. Your note is kept.',
              )}
        </p>
      )}
      {canReview && !canApprove && (
        <p className="live-error" role="status">
          {t(
            'Chưa thể duyệt: lớp phải hoạt động, được công khai và mở đăng ký; tài khoản phải là học viên đang hoạt động. Bạn vẫn có thể từ chối yêu cầu và ghi rõ lý do.',
            'Approval requires an active, listed class with enrollment open and an active student account. You can still decline the request with a note.',
          )}
        </p>
      )}
      {canReview && (changed || conflicted) && (
        <div className="mis-notice" role="status">
          <p>
            {t(
              'Yêu cầu hoặc điều kiện ghi danh đã thay đổi. Tải lại và kiểm tra trạng thái trước khi dùng phiên bản mới nhất; phản hồi đang nhập vẫn được giữ.',
              'The request or enrollment conditions changed. Refresh and check the status before using the latest version; your note is kept.',
            )}
          </p>
          <div className="live-actions">
            <button
              className="mis-button"
              type="button"
              disabled={Boolean(busy) || refreshing}
              onClick={() => void refresh()}
            >
              {refreshing
                ? t('Đang tải…', 'Refreshing…')
                : t('Tải trạng thái mới nhất', 'Refresh current status')}
            </button>
            <button
              className="mis-button"
              type="button"
              disabled={Boolean(busy) || refreshing || (!changed && !freshAfterConflict)}
              onClick={() => {
                if (latest) {
                  setExpectedVersion(latest.version)
                  setConflicted(false)
                  setFreshAfterConflict(false)
                  setError('')
                }
              }}
            >
              {t('Dùng phiên bản mới nhất', 'Use latest version')}
            </button>
          </div>
        </div>
      )}
      <fieldset className="live-fieldset" disabled={Boolean(busy)}>
        <div className="live-form-grid">
          <label className="mis-field live-wide">
            {t('Phản hồi cho học viên (không bắt buộc)', 'Note to learner (optional)')}
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
        <div className="live-actions">
          <button
            className="mis-button mis-primary"
            type="submit"
            disabled={!canReview || !canApprove || changed || conflicted || refreshing}
          >
            {busy === 'approved'
              ? t('Đang duyệt…', 'Approving…')
              : t('Duyệt và ghi danh', 'Approve and enroll')}
          </button>
          <button
            className="mis-button"
            type="button"
            disabled={!canReview || changed || conflicted || refreshing}
            onClick={(event) => void review(event, 'rejected')}
          >
            {busy === 'rejected'
              ? t('Đang lưu…', 'Saving…')
              : t('Từ chối yêu cầu', 'Decline request')}
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export function EnrollmentReviewPanel(props: LiveViewProps) {
  const { state, locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const [filter, setFilter] = useState<EnrollmentRequest['status'] | 'all'>('pending')
  const [editor, setEditor] = useState<EnrollmentRequest | null>(null)
  const [success, setSuccess] = useState('')
  const rows = state.enrollmentRequests
    .filter((request) => filter === 'all' || request.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (state.user.role !== 'admin') return null
  return (
    <section
      className="live-admin live-personal"
      aria-label={t('Duyệt đăng ký lớp học', 'Enrollment approvals')}
    >
      <div className="live-heading">
        <div>
          <h2>{t('Yêu cầu đăng ký lớp học', 'Class enrollment requests')}</h2>
          <p>
            {t(
              'Chỉ yêu cầu được quản trị viên duyệt mới cấp quyền vào lớp.',
              'Class access is granted only after an administrator approves a request.',
            )}
          </p>
        </div>
      </div>
      {success && (
        <p className="live-success" role="status">
          {success}
        </p>
      )}
      {editor && (
        <EnrollmentReviewEditor
          key={editor.id}
          props={props}
          request={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setSuccess(
              t('Đã lưu kết quả xét duyệt trên máy chủ.', 'The review was saved to the server.'),
            )
          }}
        />
      )}
      <div className="live-toolbar">
        <label className="mis-field live-filter">
          {t('Trạng thái yêu cầu', 'Request status')}
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">{t('Tất cả yêu cầu', 'All requests')}</option>
            {(['pending', 'approved', 'rejected', 'cancelled'] as const).map((status) => (
              <option key={status} value={status}>
                {requestStatus(status, locale)}
              </option>
            ))}
          </select>
        </label>
        <span className="live-help">
          {rows.length} {t('yêu cầu', 'requests')}
        </span>
      </div>
      {rows.length ? (
        <div
          className="mis-panel mis-table-wrap"
          role="region"
          aria-label={t('Danh sách yêu cầu đăng ký', 'Enrollment request list')}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th scope="col">{t('Học viên', 'Learner')}</th>
                <th scope="col">{t('Lớp đăng ký', 'Requested class')}</th>
                <th scope="col">{t('Ngày gửi', 'Requested at')}</th>
                <th scope="col">{t('Trạng thái', 'Status')}</th>
                <th scope="col">{t('Xét duyệt', 'Review')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => {
                const student = state.users.find((value) => value.id === request.studentId)
                return (
                  <tr key={request.id}>
                    <td>
                      <strong>{student?.name ?? request.studentId}</strong>
                      {student?.email && <span className="live-cell-note">{student.email}</span>}
                    </td>
                    <td>
                      <strong>{request.classTitle}</strong>
                    </td>
                    <td>
                      <time dateTime={request.createdAt}>
                        {requestDate(request.createdAt, locale)}
                      </time>
                    </td>
                    <td>
                      <span
                        className={`mis-status${request.status === 'approved' ? ' live-status-success' : ''}`}
                      >
                        {requestStatus(request.status, locale)}
                      </span>
                    </td>
                    <td>
                      {request.status === 'pending' ? (
                        <button
                          className="mis-button"
                          type="button"
                          disabled={Boolean(editor)}
                          onClick={() => {
                            setEditor(request)
                            setSuccess('')
                          }}
                        >
                          {t('Xét duyệt', 'Review')}
                        </button>
                      ) : (
                        <span className="live-prose live-help">
                          {request.note || t('Không có phản hồi', 'No note')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mis-panel live-empty">
          {filter === 'pending'
            ? t('Chưa có yêu cầu đang chờ duyệt.', 'There are no pending requests.')
            : t('Không có yêu cầu ở trạng thái này.', 'There are no requests with this status.')}
        </p>
      )}
    </section>
  )
}
