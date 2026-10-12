import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { X } from '@phosphor-icons/react'
import type { Lesson, MeetingSource } from '../../../shared/portal'
import { PortalApiError } from '@/features/auth/client'
import { isZoomMeetingUrl, zoomMeetingUrlError } from '@/features/live/meeting'
import { errorMessage, type LiveViewProps } from '@/features/live/types'

export type MeetingLinkTarget =
  { kind: 'class'; classId: string } | { kind: 'lesson'; lesson: Lesson }

export function MeetingLinkEditor({
  props,
  target,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  target: MeetingLinkTarget
  onClose: () => void
  onSaved: () => void
}) {
  const { state, locale } = props
  const vi = locale === 'vi'
  const t = (vietnamese: string, english: string) => (vi ? vietnamese : english)
  const classId = target.kind === 'class' ? target.classId : target.lesson.classId
  const room = state.classes.find((value) => value.id === classId)
  const classMeeting = state.classMeetings.find((value) => value.classId === classId)
  const lesson =
    target.kind === 'lesson'
      ? state.lessons.find((value) => value.id === target.lesson.id)
      : undefined
  const [baseline, setBaseline] = useState(() => ({
    version: target.kind === 'class' ? (classMeeting?.version ?? 0) : target.lesson.version,
    source: target.kind === 'class' ? 'class' : target.lesson.meetingSource,
    hasMeeting:
      target.kind === 'class' ? Boolean(classMeeting?.hasMeeting) : target.lesson.hasMeeting,
  }))
  const [source, setSource] = useState<MeetingSource>(
    target.kind === 'lesson' ? target.lesson.meetingSource : 'class',
  )
  const [classMode, setClassMode] = useState('replace')
  const [replace, setReplace] = useState(false)
  const [meetingUrl, setMeetingUrl] = useState('')
  const [initialDraft] = useState(() => JSON.stringify([source, 'replace', false, '']))
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [serverConflict, setServerConflict] = useState(false)
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const helpId = useId()
  const errorId = useId()
  const currentVersion = target.kind === 'class' ? (classMeeting?.version ?? 0) : lesson?.version
  const available = Boolean(
    state.user.active &&
    room?.active &&
    (target.kind === 'class' || lesson) &&
    (state.user.role === 'admin' ||
      (state.user.role === 'teacher' && room.teacherIds.includes(state.user.id)) ||
      (state.user.role === 'assistant' && room.assistantIds.includes(state.user.id))),
  )
  const changed = currentVersion !== baseline.version
  const conflict = changed || serverConflict
  const dirty = JSON.stringify([source, classMode, replace, meetingUrl]) !== initialDraft
  const canKeep = baseline.source === 'lesson' && baseline.hasMeeting
  const needsUrl =
    target.kind === 'class' ? classMode === 'replace' : source === 'lesson' && (!canKeep || replace)
  const currentSource = lesson?.meetingSource
  const sourceLabel = (value: MeetingSource | undefined) =>
    value === 'class'
      ? t('Dùng liên kết chung của lớp', 'Use the class link')
      : value === 'lesson'
        ? t('Dùng liên kết riêng cho buổi này', 'Use a separate lesson link')
        : t('Chưa dùng liên kết Zoom', 'No Zoom link')

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (!dirty && !busy) return
    const confirmLeave = () =>
      !pending.current &&
      window.confirm(
        locale === 'vi'
          ? 'Thay đổi liên kết Zoom chưa được lưu. Rời trang và bỏ các thay đổi?'
          : 'Your Zoom link changes are not saved. Leave and discard them?',
      )
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    const routeLeave = (event: Event) => {
      if (!confirmLeave()) event.preventDefault()
    }
    const click = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest('.mis-signout') : null
      // Hash changes use before-leave; full-page navigation uses beforeunload.
      // Only sign-out needs a click guard, so each action prompts once.
      if (element && !confirmLeave()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('project-l:before-leave', routeLeave)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('project-l:before-leave', routeLeave)
      document.removeEventListener('click', click, true)
    }
  }, [dirty, busy, locale])

  function close() {
    if (pending.current) return
    if (
      !dirty ||
      window.confirm(
        t(
          'Thay đổi liên kết Zoom chưa được lưu. Đóng và bỏ các thay đổi?',
          'Your Zoom link changes are not saved. Close and discard them?',
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
      setError(errorMessage(cause, locale))
    } finally {
      setRefreshing(false)
    }
  }

  function useLatest() {
    if (!available || currentVersion === undefined || !changed || pending.current) return
    setBaseline({
      version: currentVersion,
      source: target.kind === 'class' ? 'class' : (currentSource ?? 'none'),
      hasMeeting:
        target.kind === 'class' ? Boolean(classMeeting?.hasMeeting) : Boolean(lesson?.hasMeeting),
    })
    setServerConflict(false)
    setError('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current || refreshing || !available || conflict || !dirty) return
    if (needsUrl && !isZoomMeetingUrl(meetingUrl)) {
      setError(zoomMeetingUrlError(locale))
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (target.kind === 'class') {
        await props.run('class.meeting.save', {
          classId,
          expectedVersion: baseline.version,
          meetingUrl: classMode === 'clear' ? '' : meetingUrl.trim(),
        })
      } else {
        await props.run('lesson.meeting.save', {
          id: target.lesson.id,
          expectedVersion: baseline.version,
          meetingSource: source,
          ...(needsUrl ? { meetingUrl: meetingUrl.trim() } : {}),
        })
      }
      onSaved()
    } catch (cause) {
      if (cause instanceof PortalApiError && cause.status === 409) setServerConflict(true)
      setError(
        cause instanceof PortalApiError && (cause.status === 400 || cause.status === 422)
          ? zoomMeetingUrlError(locale)
          : errorMessage(cause, locale),
      )
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status)) {
        await props.refresh().catch(() => undefined)
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <form className="mis-panel live-editor" onSubmit={save} noValidate>
      <div className="live-heading">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {target.kind === 'class'
              ? t('Liên kết Zoom dùng chung', 'Shared class Zoom link')
              : t('Liên kết Zoom của buổi học', 'Lesson Zoom link')}
          </h2>
          <p>{target.kind === 'class' ? room?.title : (lesson?.title ?? target.lesson.title)}</p>
        </div>
        <button
          type="button"
          className="mis-button"
          disabled={busy}
          onClick={close}
          aria-label={t('Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="live-help" id={helpId}>
        {target.kind === 'class'
          ? t(
              'Nhập một lần để các buổi chọn “Dùng liên kết chung của lớp” sử dụng. Đổi hoặc gỡ liên kết sẽ áp dụng cho tất cả các buổi đó.',
              'Add a link once for lessons that use the class link. Replacing or removing it applies to all of those lessons.',
            )
          : t(
              'Dùng liên kết chung của lớp hoặc nhập liên kết riêng cho buổi này. Thay đổi ở đây không đổi lịch học.',
              'Use the shared class link or add a separate link for this lesson. These settings do not change the schedule.',
            )}{' '}
        {t(
          'Liên kết đã lưu được giữ riêng tư và chỉ mở sau khi kiểm tra quyền tham gia.',
          'Saved links stay private and open only after join access is checked.',
        )}
      </p>
      {!available && (
        <p className="live-error" role="alert">
          {t(
            'Lớp hoặc buổi học không còn khả dụng, hoặc bạn không còn quyền cập nhật. Nội dung đang nhập được giữ lại; đóng biểu mẫu để quay lại danh sách.',
            'The class or lesson is no longer available, or your editing access changed. Your input is kept; close this form to return to the list.',
          )}
        </p>
      )}
      {available && conflict && (
        <div className="mis-notice" role="status">
          <p>
            {t(
              'Cài đặt đã thay đổi từ khi bạn mở biểu mẫu. Kiểm tra trạng thái mới bên dưới trước khi xác nhận dùng phiên bản mới nhất. Nội dung đang nhập được giữ nguyên.',
              'The settings changed after you opened this form. Review the current status below before using the latest version. Your input is kept.',
            )}
          </p>
          <div className="live-actions">
            <button
              type="button"
              className="mis-button"
              disabled={busy || refreshing}
              onClick={() => void refresh()}
            >
              {refreshing
                ? t('Đang tải…', 'Refreshing…')
                : t('Tải trạng thái mới nhất', 'Refresh current status')}
            </button>
            <button
              type="button"
              className="mis-button"
              disabled={busy || refreshing || !changed}
              onClick={useLatest}
            >
              {t('Dùng phiên bản mới nhất', 'Use latest version')}
            </button>
          </div>
        </div>
      )}
      <fieldset className="live-fieldset" disabled={busy || !available}>
        <div className="live-form-grid">
          <p className="live-help live-wide">
            {t('Trạng thái đang lưu', 'Currently saved')}:{' '}
            {target.kind === 'class'
              ? classMeeting?.hasMeeting
                ? t('Lớp đã có liên kết chung.', 'The class has a shared link.')
                : t('Lớp chưa có liên kết chung.', 'The class has no shared link.')
              : sourceLabel(currentSource)}
          </p>
          {target.kind === 'class' ? (
            <label className="mis-field live-wide">
              {t('Thao tác với liên kết chung', 'Shared link action')}
              <select value={classMode} onChange={(event) => setClassMode(event.target.value)}>
                <option value="replace">
                  {t('Nhập hoặc thay liên kết', 'Add or replace link')}
                </option>
                <option value="clear">{t('Gỡ liên kết chung', 'Remove shared link')}</option>
              </select>
            </label>
          ) : (
            <label className="mis-field live-wide">
              {t('Liên kết sử dụng', 'Meeting link source')}
              <select
                value={source}
                onChange={(event) => setSource(event.target.value as MeetingSource)}
              >
                <option value="class">{sourceLabel('class')}</option>
                <option value="lesson">{sourceLabel('lesson')}</option>
                <option value="none">{sourceLabel('none')}</option>
              </select>
            </label>
          )}
          {target.kind === 'lesson' && source === 'class' && (
            <p className="live-help live-wide">
              {classMeeting?.hasMeeting
                ? t(
                    'Lớp đã có liên kết chung. Buổi học sẽ dùng liên kết này, kể cả khi liên kết chung được cập nhật sau đó.',
                    'The class has a shared link. This lesson will use it, including future updates to that link.',
                  )
                : t(
                    'Lớp chưa có liên kết chung. Có thể lưu lựa chọn này trước, nhưng học viên chỉ tham gia được sau khi lớp có liên kết.',
                    'The class has no shared link yet. You can save this choice now; learners can join after a class link is added.',
                  )}
            </p>
          )}
          {target.kind === 'lesson' && source === 'lesson' && canKeep && (
            <label className="live-check live-wide">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => setReplace(event.target.checked)}
              />
              <span>
                {t('Thay liên kết riêng đã lưu', 'Replace the saved lesson link')}
                <small>
                  {t(
                    'Bỏ chọn để giữ liên kết hiện tại.',
                    'Leave unchecked to keep the current link.',
                  )}
                </small>
              </span>
            </label>
          )}
          {needsUrl && (
            <label className="mis-field live-wide">
              {t('Liên kết Zoom mới', 'New Zoom link')}
              <input
                type="url"
                required
                maxLength={2000}
                value={meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
                placeholder="https://zoom.us/j/…"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error === zoomMeetingUrlError(locale) || undefined}
                aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
              />
            </label>
          )}
          {((target.kind === 'class' && classMode === 'clear') ||
            (target.kind === 'lesson' && source === 'none')) && (
            <p className="live-help live-wide">
              {target.kind === 'class'
                ? t(
                    'Các buổi dùng liên kết chung sẽ không có nút tham gia cho đến khi lớp được thêm liên kết mới. Liên kết riêng từng buổi được giữ nguyên.',
                    'Lessons using the class link cannot be joined until a new class link is added. Separate lesson links are kept.',
                  )
                : t(
                    'Buổi này sẽ chưa mở Zoom cho học viên, kể cả khi lớp có liên kết chung.',
                    'Zoom will not open for this lesson, even if the class has a shared link.',
                  )}
            </p>
          )}
        </div>
        <div className="live-actions">
          <button
            className="mis-button mis-primary"
            type="submit"
            disabled={!dirty || conflict || refreshing}
          >
            {busy ? t('Đang lưu…', 'Saving…') : t('Lưu cài đặt Zoom', 'Save Zoom settings')}
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="live-error" role="alert" id={errorId}>
          {error}
        </p>
      )}
    </form>
  )
}
