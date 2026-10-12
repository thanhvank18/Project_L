/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named table regions allow keyboard scrolling. */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowClockwise, ArrowRight, CheckCircle, DownloadSimple, X } from '@phosphor-icons/react'
import type { Locale, Submission } from '../../../shared/portal'
import { Attachments } from '@/features/live/Attachments'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { ReadingResponseSummary } from '@/features/live/ReadingResponseSummary'
import '@/styles/live-submissions.css'

const tx = (locale: Locale, vi: string, en: string) => (locale === 'vi' ? vi : en)
const userName = (props: LiveViewProps, id: string) =>
  props.state.users.find((user) => user.id === id)?.name ??
  tx(props.locale, 'Tài khoản không còn trong lớp', 'Account no longer in this class')
const className = (props: LiveViewProps, id: string) =>
  props.state.classes.find((room) => room.id === id)?.title ??
  tx(props.locale, 'Lớp không còn khả dụng', 'Class unavailable')
const submittedTime = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
const skillName = (skill: Submission['skill'], locale: Locale) =>
  ({
    reading: tx(locale, 'Đọc', 'Reading'),
    writing: tx(locale, 'Viết', 'Writing'),
    listening: tx(locale, 'Nghe', 'Listening'),
    speaking: tx(locale, 'Nói', 'Speaking'),
  })[skill]

function ReviewForm({ props, submission }: { props: LiveViewProps; submission: Submission }) {
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [expectedVersion] = useState(submission.version)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const t = (vi: string, en: string) => tx(props.locale, vi, en)
  const dirty = !saved && (score !== '' || feedback !== '')
  useEffect(() => {
    if (!dirty && !busy) return
    const allow = () =>
      !pending.current &&
      window.confirm(
        props.locale === 'vi'
          ? 'Rời bài nộp và bỏ điểm, nhận xét chưa gửi?'
          : 'Leave and discard the score and feedback you have not returned?',
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
  }, [dirty, busy, props.locale])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current || submission.review) return
    if (
      !score.trim() ||
      !Number.isFinite(Number(score)) ||
      Number(score) < 0 ||
      Number(score) > 9 ||
      !feedback.trim()
    ) {
      setError(
        t(
          'Nhập điểm từ 0 đến 9 và nhận xét trước khi gửi.',
          'Enter a score from 0 to 9 and written feedback before returning the review.',
        ),
      )
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await props.run('submission.review', {
        id: submission.id,
        expectedVersion,
        score: Number(score),
        feedback,
      })
      setSaved(true)
    } catch (cause) {
      setError(errorMessage(cause, props.locale))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  if (saved)
    return (
      <p className="live-review-success" role="status">
        <CheckCircle size={20} aria-hidden="true" />
        {t('Đã gửi điểm và nhận xét cho học viên.', 'Score and feedback returned to the student.')}
      </p>
    )
  return (
    <form className="live-review-form" onSubmit={(event) => void save(event)}>
      <h3>{t('Chấm bản nộp này', 'Review this submission revision')}</h3>
      <p className="live-review-help">
        {t(
          'Nhận xét gắn với đúng bản nộp này và được lưu vĩnh viễn sau khi gửi.',
          'Your review belongs to this exact submission revision and becomes permanent when returned.',
        )}
      </p>
      {submission.review && (
        <p className="live-review-error" role="alert">
          {t(
            'Bản này đã được chấm ở phiên khác. Nội dung bạn nhập bên dưới vẫn được giữ nhưng chưa được gửi.',
            'This revision was reviewed elsewhere. Your input below has been kept and has not been sent.',
          )}
        </p>
      )}
      <fieldset disabled={busy || Boolean(submission.review)}>
        <label className="mis-field live-review-score">
          {t('Điểm (0–9)', 'Score (0–9)')}
          <input
            type="number"
            min="0"
            max="9"
            step="any"
            required
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </label>
        <label className="mis-field">
          {t('Nhận xét cho học viên', 'Feedback for the student')}
          <textarea
            required
            rows={6}
            maxLength={20000}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
        <button type="submit" className="mis-button mis-primary">
          {busy
            ? t('Đang gửi…', 'Returning review…')
            : t('Gửi điểm và nhận xét', 'Return score and feedback')}
        </button>
      </fieldset>
      {error && (
        <p className="live-review-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function SubmissionDetail({
  props,
  submission,
  onClose,
  onSelect,
}: {
  props: LiveViewProps
  submission: Submission
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const t = (vi: string, en: string) => tx(props.locale, vi, en)
  const [reviewStarted] = useState(props.state.user.role === 'teacher' && !submission.review)
  const history = props.state.submissions
    .filter(
      (item) =>
        item.studentId === submission.studentId && item.assignmentId === submission.assignmentId,
    )
    .sort((a, b) => b.revision - a.revision)
  const review = submission.review
  return (
    <section className="mis-panel live-submission-detail" aria-labelledby="submission-detail-title">
      <div className="live-submission-heading">
        <div>
          <h2 id="submission-detail-title">{submission.title[props.locale]}</h2>
          <p>
            {userName(props, submission.studentId)} · {t('Bản nộp', 'Revision')}{' '}
            {submission.revision} · {submittedTime(submission.submittedAt, props.locale)}
          </p>
        </div>
        <button
          className="mis-button"
          type="button"
          onClick={onClose}
          aria-label={t('Đóng chi tiết bài nộp', 'Close submission details')}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <dl className="live-submission-meta">
        <div>
          <dt>{t('Lớp', 'Class')}</dt>
          <dd>{className(props, submission.classId)}</dd>
        </div>
        <div>
          <dt>{t('Kỹ năng', 'Skill')}</dt>
          <dd>{skillName(submission.skill, props.locale)}</dd>
        </div>
        <div>
          <dt>{t('Phiên bản đề bài', 'Assignment version')}</dt>
          <dd>{submission.assignmentVersion}</dd>
        </div>
      </dl>
      <details className="live-submission-prompt">
        <summary>
          {t('Xem đề bài tại thời điểm nộp', 'View instructions at submission time')}
        </summary>
        <div className="live-submission-prose">{submission.instructions[props.locale]}</div>
        {submission.promptAttachmentIds?.length ? (
          <Attachments
            state={props.state}
            locale={props.locale}
            classId={submission.classId}
            purpose="material"
            value={submission.promptAttachmentIds}
            readOnly
          />
        ) : null}
      </details>
      <div className="live-submission-answer">
        <h3>{t('Nội dung đã nộp', 'Submitted work')}</h3>
        {submission.reading && (
          <ReadingResponseSummary
            definition={submission.reading}
            answers={submission.readingAnswers ?? {}}
            locale={props.locale}
          />
        )}
        {submission.answer ? (
          <div className="live-submission-prose">{submission.answer}</div>
        ) : (
          !submission.reading && (
            <p className="live-review-help">
              {t(
                'Học viên đã nộp câu trả lời trong tệp đính kèm.',
                'The student submitted their response as an attachment.',
              )}
            </p>
          )
        )}
        <Attachments
          state={props.state}
          locale={props.locale}
          classId={submission.classId}
          purpose="submission"
          value={submission.attachmentIds}
          readOnly
        />
      </div>
      {review && (
        <section
          className="live-submission-feedback"
          aria-label={t('Kết quả chấm bài', 'Review result')}
        >
          <div className="live-submission-heading">
            <h3>{t('Kết quả', 'Result')}</h3>
            <strong className="live-submission-grade">
              {review.score}
              <span> / 9</span>
            </strong>
          </div>
          <div className="live-submission-prose">{review.feedback}</div>
          <p className="live-review-help">
            {userName(props, review.teacherId)} · {submittedTime(review.reviewedAt, props.locale)}
          </p>
        </section>
      )}
      {reviewStarted && <ReviewForm props={props} submission={submission} />}
      {!review && !reviewStarted && (
        <p className="live-review-help">
          {t(
            'Giáo viên chưa trả nhận xét cho bản nộp này.',
            'The teacher has not returned a review for this revision yet.',
          )}
        </p>
      )}
      {history.length > 1 && (
        <nav
          className="live-submission-history"
          aria-label={t('Lịch sử các bản nộp', 'Submission revision history')}
        >
          <h3>{t('Lịch sử bài nộp', 'Submission history')}</h3>
          {history.map((item) => (
            <button
              className={`mis-button ${item.id === submission.id ? 'live-revision-current' : ''}`}
              type="button"
              key={item.id}
              aria-current={item.id === submission.id ? 'true' : undefined}
              onClick={() => onSelect(item.id)}
            >
              {t('Bản', 'Revision')} {item.revision} ·{' '}
              {item.review ? `${item.review.score}/9` : t('Chờ chấm', 'Awaiting review')}
            </button>
          ))}
        </nav>
      )}
    </section>
  )
}

function exportResults(rows: Submission[], props: LiveViewProps) {
  const safeCell = (value: string | number) => {
    const text = String(value)
    return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
  }
  const headers =
    props.locale === 'vi'
      ? ['Lớp', 'Học viên', 'Bài tập', 'Kỹ năng', 'Bản nộp', 'Ngày nộp', 'Điểm / 9', 'Ngày chấm']
      : [
          'Class',
          'Student',
          'Assignment',
          'Skill',
          'Revision',
          'Submitted at',
          'Score / 9',
          'Reviewed at',
        ]
  const csv = [
    headers,
    ...rows.map((row) => [
      className(props, row.classId),
      userName(props, row.studentId),
      row.title[props.locale],
      skillName(row.skill, props.locale),
      row.revision,
      row.submittedAt,
      row.review?.score ?? '',
      row.review?.reviewedAt ?? '',
    ]),
  ]
    .map((row) => row.map(safeCell).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `learning-results-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SubmissionViews({
  section,
  ...props
}: LiveViewProps & { section: 'grading' | 'reports' }) {
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const detailRef = useRef<HTMLDivElement>(null)
  const t = (vi: string, en: string) => tx(props.locale, vi, en)
  if (props.state.user.role === 'assistant')
    return (
      <section className="mis-panel live-submission-empty">
        {t(
          'Trang này chỉ dành cho học viên, giáo viên và quản trị viên được phân quyền.',
          'This page is available to authorized students, teachers and administrators.',
        )}
      </section>
    )
  const latest = new Map<string, number>()
  for (const submission of props.state.submissions) {
    const key = `${submission.studentId}:${submission.assignmentId}`
    latest.set(key, Math.max(latest.get(key) ?? 0, submission.revision))
  }
  const rows = props.state.submissions
    .filter(
      (submission) =>
        (!classId || submission.classId === classId) &&
        (!search.trim() ||
          `${submission.title.vi} ${submission.title.en} ${userName(props, submission.studentId)}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase())) &&
        (status === 'all' ||
          (status === 'reviewed' ? Boolean(submission.review) : !submission.review)) &&
        (showHistory ||
          submission.revision === latest.get(`${submission.studentId}:${submission.assignmentId}`)),
    )
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.revision - a.revision)
  const selected = props.state.submissions.find((submission) => submission.id === selectedId)
  const reviewed = rows.filter((row) => row.review)
  const average = reviewed.length
    ? (reviewed.reduce((sum, row) => sum + row.review!.score, 0) / reviewed.length).toFixed(2)
    : null
  const select = (id: string) => {
    if (
      id !== selectedId &&
      !window.dispatchEvent(new Event('project-l:before-leave', { cancelable: true }))
    )
      return
    setSelectedId(id)
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      detailRef.current?.focus()
    }, 0)
  }
  return (
    <div className="live-submissions">
      <div className="live-submission-heading">
        <div>
          <p>
            {t(
              'Điểm và nhận xét được lưu theo từng bản nộp. Chọn một bài để xem nội dung và lịch sử.',
              'Scores and feedback belong to each submitted revision. Select a submission to read the work and its history.',
            )}
          </p>
        </div>
        <button
          className="mis-button"
          type="button"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true)
            setRefreshError('')
            try {
              await props.refresh()
            } catch (cause) {
              setRefreshError(errorMessage(cause, props.locale))
            } finally {
              setRefreshing(false)
            }
          }}
        >
          <ArrowClockwise size={18} aria-hidden="true" />
          {refreshing ? t('Đang tải…', 'Refreshing…') : t('Tải lại', 'Refresh')}
        </button>
      </div>
      {refreshError && (
        <p className="live-review-error" role="alert">
          {refreshError}
        </p>
      )}
      <div className="mis-panel live-submission-filters">
        <label className="mis-field live-submission-search">
          {t('Tìm bài tập hoặc học viên', 'Find an assignment or student')}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="mis-field">
          {t('Lớp học', 'Class')}
          <select value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">{t('Tất cả lớp', 'All classes')}</option>
            {props.state.classes.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title}
              </option>
            ))}
          </select>
        </label>
        <label className="mis-field">
          {t('Trạng thái', 'Status')}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t('Tất cả bài nộp', 'All submissions')}</option>
            <option value="pending">{t('Chờ chấm', 'Awaiting review')}</option>
            <option value="reviewed">{t('Đã chấm', 'Reviewed')}</option>
          </select>
        </label>
        <label className="live-submission-history-toggle">
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(event) => setShowHistory(event.target.checked)}
          />
          {t('Gồm các bản nộp trước', 'Include earlier revisions')}
        </label>
      </div>
      {section === 'reports' && (
        <section
          className="mis-panel live-result-summary"
          aria-label={t('Tóm tắt kết quả đang hiển thị', 'Summary of displayed results')}
        >
          <p>
            <strong>{rows.length}</strong> {t('bản nộp', 'submissions')} ·{' '}
            <strong>{reviewed.length}</strong> {t('đã chấm', 'reviewed')} ·{' '}
            <strong>{rows.length - reviewed.length}</strong> {t('chờ chấm', 'awaiting review')}
          </p>
          <p>
            {average === null
              ? t(
                  'Chưa có điểm để tính trung bình.',
                  'No scores are available to calculate an average.',
                )
              : `${t('Điểm trung bình các bản đang hiển thị', 'Average across displayed revisions')}: ${average} / 9`}
          </p>
          <button
            className="mis-button"
            type="button"
            disabled={!rows.length}
            onClick={() => exportResults(rows, props)}
          >
            <DownloadSimple size={18} aria-hidden="true" />
            {t('Xuất kết quả CSV', 'Export results CSV')}
          </button>
        </section>
      )}
      {rows.length ? (
        <div
          className="mis-panel mis-table-wrap live-submission-table"
          role="region"
          tabIndex={0}
          aria-label={t('Danh sách bài nộp', 'Submission list')}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th scope="col">{t('Bài tập / Học viên', 'Assignment / Student')}</th>
                <th scope="col">{t('Lớp', 'Class')}</th>
                <th scope="col">{t('Bản nộp', 'Revision')}</th>
                <th scope="col">{t('Kết quả', 'Result')}</th>
                <th scope="col">{t('Thao tác', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    <strong>{submission.title[props.locale]}</strong>
                    <span>
                      {userName(props, submission.studentId)} ·{' '}
                      {skillName(submission.skill, props.locale)}
                    </span>
                  </td>
                  <td>{className(props, submission.classId)}</td>
                  <td>
                    #{submission.revision}
                    <span>{submittedTime(submission.submittedAt, props.locale)}</span>
                  </td>
                  <td>
                    {submission.review ? (
                      <strong>{submission.review.score} / 9</strong>
                    ) : (
                      <span className="mis-status">{t('Chờ chấm', 'Awaiting review')}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="mis-button"
                      type="button"
                      onClick={() => select(submission.id)}
                      aria-label={`${t('Xem bài', 'View')} ${submission.title[props.locale]}, ${userName(props, submission.studentId)}, ${t('bản', 'revision')} ${submission.revision}`}
                    >
                      {props.state.user.role === 'teacher' && !submission.review
                        ? t('Chấm bài', 'Review')
                        : t('Xem', 'View')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mis-panel live-submission-empty">
          <h2>
            {props.state.submissions.length
              ? t('Không có bài nộp phù hợp', 'No matching submissions')
              : t('Chưa có bài nộp', 'No submissions yet')}
          </h2>
          <p>
            {props.state.submissions.length
              ? t(
                  'Thử đổi bộ lọc hoặc tìm kiếm theo tên bài tập, học viên.',
                  'Try changing the filters or searching by assignment or student name.',
                )
              : props.state.user.role === 'student'
                ? t(
                    'Nộp bài từ mục Bài tập. Điểm, nhận xét và các bản nộp trước sẽ xuất hiện ở đây.',
                    'Submit work from Assignments. Your scores, feedback and earlier revisions will appear here.',
                  )
                : t(
                    'Khi học viên nộp bài trong lớp được phân công, bài làm và lịch sử sẽ xuất hiện ở đây.',
                    'When students submit work in your assigned classes, their work and revision history will appear here.',
                  )}
          </p>
        </div>
      )}
      <div ref={detailRef} className="live-submission-detail-anchor" tabIndex={-1}>
        {selected && (
          <SubmissionDetail
            key={selected.id}
            props={props}
            submission={selected}
            onClose={() => {
              if (window.dispatchEvent(new Event('project-l:before-leave', { cancelable: true })))
                setSelectedId(null)
            }}
            onSelect={select}
          />
        )}
        {selectedId && !selected && (
          <p className="live-review-error" role="alert">
            {t(
              'Bài nộp này không còn trong phạm vi truy cập của bạn. Hãy chọn bài khác.',
              'This submission is no longer within your access. Select another submission.',
            )}
          </p>
        )}
      </div>
    </div>
  )
}
