/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Focusable regions make wide result tables keyboard-scrollable. */
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, CheckCircle, Clock, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { PortalLocale } from '@/features/learning/types'
import { visibleCourseIds } from '@/features/management/model'
import { reviewSubmission, visibleSubmissions } from '@/features/management/workflow'
import type {
  ManagementSubmission,
  ManagementTask,
  ManagementViewProps,
  SubmissionRevision,
} from '@/features/management/types'
import '@/styles/submission-review.css'

interface SubmissionReviewProps extends ManagementViewProps {
  onAssignment?: (id: string) => void
  focusTaskId?: string
  sharedPreview?: boolean
}

const tx = (locale: PortalLocale, vi: string, en: string) => (locale === 'vi' ? vi : en)
const dateLabel = (date: string, locale: PortalLocale) =>
  new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))

function Answer({
  answer,
  task,
  locale,
}: {
  answer: string
  task?: ManagementTask
  locale: PortalLocale
}) {
  let reading: { answerOne: string; answerTwo: string } | null = null
  if (task?.id === 'reading-01') {
    try {
      const parsed: unknown = JSON.parse(answer)
      if (
        parsed &&
        typeof parsed === 'object' &&
        'answerOne' in parsed &&
        'answerTwo' in parsed &&
        typeof parsed.answerOne === 'string' &&
        typeof parsed.answerTwo === 'string'
      ) {
        reading = { answerOne: parsed.answerOne, answerTwo: parsed.answerTwo }
      }
    } catch {
      // Older plain-text submissions remain readable.
    }
  }
  return reading ? (
    <dl className="sr-reading-answers">
      <div>
        <dt>
          {tx(
            locale,
            'Mina đã thay đổi thói quen học như thế nào?',
            'How did Mina change her study routine?',
          )}
        </dt>
        <dd>{reading.answerOne}</dd>
      </div>
      <div>
        <dt>
          {tx(
            locale,
            'Vì sao Mina ghi lại những câu hỏi của mình?',
            'Why does Mina write down her questions?',
          )}
        </dt>
        <dd>{reading.answerTwo}</dd>
      </div>
    </dl>
  ) : (
    <p className="sr-answer">{answer}</p>
  )
}

function ReviewForm({
  submission,
  commit,
  role,
  locale,
  onReviewed,
}: Pick<SubmissionReviewProps, 'commit' | 'role' | 'locale'> & {
  submission: ManagementSubmission
  onReviewed: () => void
}) {
  const fieldId = useId()
  const scoreRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLTextAreaElement>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<'invalid' | 'save' | null>(null)
  const t = (vi: string, en: string) => tx(locale, vi, en)
  return (
    <form
      className="sr-review-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const numeric = Number(score)
        if (
          !score.trim() ||
          !Number.isFinite(numeric) ||
          numeric < 0 ||
          numeric > 9 ||
          !feedback.trim()
        ) {
          setError('invalid')
          if (!score.trim() || !Number.isFinite(numeric) || numeric < 0 || numeric > 9)
            scoreRef.current?.focus()
          else feedbackRef.current?.focus()
          return
        }
        const saved = commit((current) => {
          const next = reviewSubmission(current, {
            role,
            submissionId: submission.id,
            expectedRevision: submission.revision,
            score: numeric,
            feedback: feedback.trim(),
            now: new Date().toISOString(),
          })
          if (!next) throw new Error('Submission changed or review is not allowed')
          return next
        })
        setError(saved ? null : 'save')
        if (saved) onReviewed()
      }}
    >
      <h3>{t('Nhận xét và trả bài', 'Review and return')}</h3>
      <p className="sr-muted">
        {t(
          'Điểm và nhận xét áp dụng cho đúng lần nộp đang hiển thị.',
          'Your score and feedback apply to the submission revision shown here.',
        )}
      </p>
      <label className="mis-field sr-score-field" htmlFor={`${fieldId}-score`}>
        {t('Điểm (0–9)', 'Score (0–9)')}
        <input
          id={`${fieldId}-score`}
          ref={scoreRef}
          type="number"
          min="0"
          max="9"
          step="any"
          inputMode="decimal"
          value={score}
          required
          aria-describedby={error ? `${fieldId}-error` : undefined}
          aria-invalid={
            error === 'invalid' && (!score.trim() || Number(score) < 0 || Number(score) > 9)
          }
          onChange={(event) => {
            setScore(event.target.value)
            setError(null)
          }}
        />
      </label>
      <label className="mis-field" htmlFor={`${fieldId}-feedback`}>
        {t('Nhận xét cho học viên', 'Feedback for the student')}
        <textarea
          id={`${fieldId}-feedback`}
          ref={feedbackRef}
          value={feedback}
          required
          maxLength={4000}
          rows={5}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          aria-invalid={error === 'invalid' && !feedback.trim()}
          placeholder={t(
            'Nêu điểm làm tốt và điều cần cải thiện...',
            'Describe what works well and what to improve...',
          )}
          onChange={(event) => {
            setFeedback(event.target.value)
            setError(null)
          }}
        />
      </label>
      {error && (
        <p id={`${fieldId}-error`} className="sr-error" role="alert">
          {error === 'invalid'
            ? t(
                'Nhập điểm từ 0 đến 9 và ít nhất một nhận xét trước khi trả bài.',
                'Enter a score from 0 to 9 and feedback before returning this submission.',
              )
            : t(
                'Chưa lưu được. Bài nộp có thể đã thay đổi hoặc trình duyệt không cho lưu. Kiểm tra lần nộp hiện tại rồi thử lại.',
                'Could not save. The submission may have changed or browser storage is unavailable. Check the current revision and try again.',
              )}
        </p>
      )}
      <div className="sr-actions">
        <button className="mis-button mis-primary" type="submit">
          {t('Lưu và trả bài mẫu', 'Save and return demo work')}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      <p className="sr-muted">
        {t(
          'Phản hồi hiển thị trong kết quả của học viên mẫu. Thao tác này không gửi email.',
          'Feedback appears in the sample student’s results. No email is sent.',
        )}
      </p>
    </form>
  )
}

function ReturnedReview({
  revision,
  locale,
}: {
  revision: SubmissionRevision
  locale: PortalLocale
}) {
  if (!revision.review) return null
  const t = (vi: string, en: string) => tx(locale, vi, en)
  return (
    <section className="sr-returned" aria-label={t('Phản hồi đã trả', 'Returned feedback')}>
      <div className="sr-feedback-heading">
        <h3>{t('Nhận xét của giáo viên', 'Teacher feedback')}</h3>
        <strong>{revision.review.score} / 9</strong>
      </div>
      <p className="sr-feedback-text">{revision.review.feedback}</p>
      <p className="sr-muted">
        {t('Đã trả lúc', 'Returned')} {dateLabel(revision.review.reviewedAt, locale)} · UTC+07
      </p>
    </section>
  )
}

function SubmissionDetails({
  submission,
  task,
  learnerName,
  onClose,
  onReviewed,
  ...props
}: SubmissionReviewProps & {
  submission: ManagementSubmission
  task?: ManagementTask
  learnerName: string
  onClose: () => void
  onReviewed: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const t = (vi: string, en: string) => tx(props.locale, vi, en)
  useEffect(() => {
    headingRef.current?.focus()
  }, [submission.id])
  return (
    <section
      className="mis-panel sr-detail"
      aria-label={t('Chi tiết bài nộp', 'Submission details')}
    >
      <div className="sr-detail-heading">
        <div>
          <h2 tabIndex={-1} ref={headingRef}>
            {task?.title[props.locale] ?? t('Bài nộp', 'Submission')}
          </h2>
          <p>
            {learnerName} · {t('Lần nộp', 'Revision')} {submission.revision} ·{' '}
            {dateLabel(submission.submittedAt, props.locale)} (UTC+07)
          </p>
        </div>
        <button
          className="mis-button sr-close"
          type="button"
          onClick={onClose}
          aria-label={t('Đóng chi tiết bài nộp', 'Close submission details')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="sr-detail-columns">
        <div className="sr-answer-section">
          {task?.instructions && (
            <div className="sr-task-instructions">
              <h3>{t('Yêu cầu bài tập', 'Assignment instructions')}</h3>
              <p>{task.instructions[props.locale]}</p>
            </div>
          )}
          <h3>{t('Nội dung đã nộp', 'Submitted work')}</h3>
          <Answer answer={submission.answer} task={task} locale={props.locale} />
          {submission.history.length > 0 && (
            <details className="sr-history">
              <summary>
                {t('Lịch sử các lần nộp', 'Previous submissions')} ({submission.history.length})
              </summary>
              {[...submission.history].reverse().map((revision) => (
                <article key={revision.revision}>
                  <h3>
                    {t('Lần nộp', 'Revision')} {revision.revision} ·{' '}
                    {dateLabel(revision.submittedAt, props.locale)}
                  </h3>
                  <Answer answer={revision.answer} task={task} locale={props.locale} />
                  {revision.review ? (
                    <ReturnedReview revision={revision} locale={props.locale} />
                  ) : (
                    <p className="sr-muted">
                      {t(
                        'Chưa được nhận xét trước khi nộp lại.',
                        'Not reviewed before resubmission.',
                      )}
                    </p>
                  )}
                </article>
              ))}
            </details>
          )}
        </div>
        <div className="sr-feedback-section">
          {submission.status === 'returned' && submission.review ? (
            <>
              <p className="sr-success" role="status">
                <CheckCircle size={18} aria-hidden="true" />
                {t('Đã trả bài mẫu', 'Demo work returned')}
              </p>
              <ReturnedReview revision={submission} locale={props.locale} />
              {props.role === 'student' && props.onAssignment && task?.published && (
                <button
                  className="mis-button"
                  type="button"
                  onClick={() => props.onAssignment?.(submission.taskId)}
                >
                  {t('Mở bài để cải thiện', 'Open assignment to improve')}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              )}
            </>
          ) : props.role === 'teacher' ? (
            <ReviewForm
              key={`${submission.id}-${submission.revision}`}
              submission={submission}
              commit={props.commit}
              role={props.role}
              locale={props.locale}
              onReviewed={onReviewed}
            />
          ) : (
            <div className="sr-awaiting">
              <Clock size={22} aria-hidden="true" />
              <h3>{t('Đang chờ giáo viên nhận xét', 'Awaiting teacher review')}</h3>
              <p>
                {props.role === 'student'
                  ? t(
                      'Bài đã có trong hàng chờ của giáo viên trong cùng bộ dữ liệu dùng thử.',
                      'Your work is in the teacher’s queue in this demo dataset.',
                    )
                  : t(
                      'Vai trò này được theo dõi bài nộp và phản hồi, không được sửa điểm.',
                      'This role can track submissions and feedback, but cannot edit grades.',
                    )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SubmissionReviewContent(props: SubmissionReviewProps) {
  const { state, role, locale } = props
  const t = (vi: string, en: string) => tx(locale, vi, en)
  const [query, setQuery] = useState('')
  const [courseId, setCourseId] = useState('all')
  const [status, setStatus] = useState('all')
  const [taskId, setTaskId] = useState(props.focusTaskId ?? 'all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewSaved, setReviewSaved] = useState(0)
  const savedRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (reviewSaved) savedRef.current?.focus()
  }, [reviewSaved])
  const actionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const scope = visibleCourseIds(state, role)
  const courses = state.courses.filter((course) => scope.includes(course.id))
  const submissions = visibleSubmissions(state, role)
  const filtered = submissions
    .filter((submission) => {
      const task = state.tasks.find((item) => item.id === submission.taskId)
      const learner = state.learners.find((item) => item.id === submission.learnerId)
      const search = `${task?.title[locale] ?? ''} ${learner?.name ?? ''}`.toLocaleLowerCase()
      return (
        (courseId === 'all' || courseId === task?.courseId) &&
        (taskId === 'all' || taskId === task?.id) &&
        (status === 'all' || status === submission.status) &&
        search.includes(query.trim().toLocaleLowerCase())
      )
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const selected = filtered.find((item) => item.id === selectedId)
  const pending = submissions.filter((item) => item.status === 'submitted').length
  const returned = submissions.filter((item) => item.status === 'returned').length
  const hasFilters = Boolean(
    query.trim() || courseId !== 'all' || status !== 'all' || taskId !== 'all',
  )
  return (
    <div className="submission-review">
      <div className="sr-intro">
        <div>
          <h2>
            {role === 'student'
              ? t('Kết quả bài nộp của bạn', 'Your submission results')
              : t('Bài nộp trong lớp', 'Class submissions')}
          </h2>
          <p>
            {t(
              'Theo dõi bài làm bằng văn bản, điểm và phản hồi theo từng lần nộp.',
              'Track written submissions, scores and feedback for each revision.',
            )}
          </p>
        </div>
        <div className="sr-counts">
          <span>
            <Clock size={16} aria-hidden="true" />
            {pending} {t('chờ nhận xét', 'awaiting review')}
          </span>
          <span>
            <CheckCircle size={16} aria-hidden="true" />
            {returned} {t('đã trả bài', 'returned')}
          </span>
        </div>
      </div>
      {reviewSaved > 0 && (
        <p className="sr-success" role="status" tabIndex={-1} ref={savedRef}>
          <CheckCircle size={18} aria-hidden="true" />
          {t(
            'Đã lưu và trả phản hồi cho học viên mẫu.',
            'Feedback saved and returned to the sample student.',
          )}
        </p>
      )}
      <div className="mis-toolbar sr-filters">
        <label className="mis-field sr-search">
          <span>{t('Tìm bài nộp', 'Search submissions')}</span>
          <span className="sr-search-control">
            <MagnifyingGlass size={17} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Tên bài hoặc học viên', 'Assignment or student name')}
            />
          </span>
        </label>
        <label className="mis-field">
          <span>{t('Lớp học', 'Class')}</span>
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="all">{t('Tất cả lớp phụ trách', 'All visible classes')}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="mis-field">
          <span>{t('Bài tập', 'Assignment')}</span>
          <select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            <option value="all">{t('Tất cả bài tập', 'All assignments')}</option>
            {state.tasks
              .filter(
                (task) =>
                  scope.includes(task.courseId) &&
                  (role !== 'student' ||
                    task.published ||
                    submissions.some((item) => item.taskId === task.id)),
              )
              .map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title[locale]}
                </option>
              ))}
          </select>
        </label>
        <label className="mis-field">
          <span>{t('Trạng thái', 'Status')}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t('Tất cả trạng thái', 'All statuses')}</option>
            <option value="submitted">{t('Chờ nhận xét', 'Awaiting review')}</option>
            <option value="returned">{t('Đã trả bài', 'Returned')}</option>
          </select>
        </label>
        {hasFilters && (
          <button
            className="mis-button"
            type="button"
            onClick={() => {
              setQuery('')
              setCourseId('all')
              setTaskId('all')
              setStatus('all')
            }}
          >
            {t('Xóa bộ lọc', 'Clear filters')}
          </button>
        )}
      </div>
      {filtered.length ? (
        <div
          className="mis-table-wrap"
          role="region"
          tabIndex={0}
          aria-label={t('Danh sách bài nộp; có thể cuộn ngang', 'Submissions; scroll horizontally')}
        >
          <table className="mis-table sr-table">
            <thead>
              <tr>
                {role !== 'student' && <th scope="col">{t('Học viên', 'Student')}</th>}
                <th scope="col">{t('Bài tập', 'Assignment')}</th>
                <th scope="col">{t('Lần nộp', 'Revision')}</th>
                <th scope="col">{t('Trạng thái', 'Status')}</th>
                <th scope="col">{t('Điểm', 'Score')}</th>
                <th scope="col">{t('Chi tiết', 'Details')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((submission) => {
                const task = state.tasks.find((item) => item.id === submission.taskId)
                return (
                  <tr
                    key={submission.id}
                    className={selectedId === submission.id ? 'sr-selected' : undefined}
                  >
                    {role !== 'student' && (
                      <td>
                        {state.learners.find((item) => item.id === submission.learnerId)?.name}
                      </td>
                    )}
                    <td>
                      <strong>{task?.title[locale]}</strong>
                      <span className="sr-cell-sub">
                        {state.courses.find((item) => item.id === task?.courseId)?.title}
                      </span>
                    </td>
                    <td>
                      {submission.revision}
                      <span className="sr-cell-sub">
                        {dateLabel(submission.submittedAt, locale)}
                      </span>
                    </td>
                    <td>
                      <span className={`mis-status sr-status-${submission.status}`}>
                        {submission.status === 'returned'
                          ? t('Đã trả bài', 'Returned')
                          : t('Chờ nhận xét', 'Awaiting review')}
                      </span>
                    </td>
                    <td>{submission.review ? `${submission.review.score} / 9` : '—'}</td>
                    <td>
                      <button
                        ref={(element) => {
                          actionRefs.current[submission.id] = element
                        }}
                        className="mis-button"
                        type="button"
                        aria-expanded={selectedId === submission.id}
                        onClick={() =>
                          setSelectedId(selectedId === submission.id ? null : submission.id)
                        }
                      >
                        {role === 'teacher' && submission.status === 'submitted'
                          ? t('Chấm bài', 'Review work')
                          : t('Xem bài', 'View work')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mis-empty">
          <h3>
            {hasFilters
              ? t('Không có bài nộp phù hợp', 'No matching submissions')
              : t('Chưa có bài nộp trong luồng dùng thử', 'No submissions in this demo yet')}
          </h3>
          <p>
            {hasFilters
              ? t('Thử xóa bộ lọc để xem lại danh sách.', 'Clear the filters to see the full list.')
              : role === 'student'
                ? t(
                    'Mở bài tập, hoàn thành phần trả lời bằng văn bản và nộp thử để theo dõi phản hồi tại đây.',
                    'Open an assignment and submit your written response to follow its feedback here.',
                  )
                : t(
                    'Nộp bài từ giao diện học viên trong cùng bộ dữ liệu dùng thử để bắt đầu.',
                    'Submit work from the student view in the same demo dataset to get started.',
                  )}
          </p>
          {role === 'student' && !hasFilters && (
            <a href="#assignments" className="mis-button mis-primary">
              {t('Mở bài tập', 'Open assignments')}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          )}
          {role !== 'student' && !hasFilters && props.sharedPreview && (
            <a href="/learn?preview=student#assignments" className="mis-button">
              {t('Thử vai trò học viên', 'Try the student view')}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {selected && (
        <SubmissionDetails
          key={selected.id}
          {...props}
          submission={selected}
          task={state.tasks.find((item) => item.id === selected.taskId)}
          learnerName={state.learners.find((item) => item.id === selected.learnerId)?.name ?? ''}
          onClose={() => {
            setSelectedId(null)
            actionRefs.current[selected.id]?.focus()
          }}
          onReviewed={() => setReviewSaved((count) => count + 1)}
        />
      )}
    </div>
  )
}

export function SubmissionReview(props: SubmissionReviewProps) {
  return <SubmissionReviewContent key={props.focusTaskId ?? 'all'} {...props} />
}
