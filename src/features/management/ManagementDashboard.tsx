/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Focusable table regions support keyboard scrolling on narrow screens. */
import {
  ArrowRight,
  BookOpen,
  CalendarDots,
  CheckCircle,
  ClipboardText,
  Clock,
  GraduationCap,
  Notebook,
  UserCheck,
  Users,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { portalDemoData } from '@/features/learning/data'
import type { PortalLocale, PortalRole, PortalState } from '@/features/learning/types'
import { visibleCourseIds, visibleLearners } from '@/features/management/model'
import { visibleSubmissions } from '@/features/management/workflow'
import type { ManagementState } from '@/features/management/types'
import '@/styles/management-dashboard.css'

interface DashboardProps {
  state: ManagementState
  learning: PortalState
  locale: PortalLocale
  role: PortalRole
  sharedPreview?: boolean
}
interface Metric {
  label: string
  value: number | string
  detail: string
  icon: Icon
}
const text = (locale: PortalLocale, vi: string, en: string) => (locale === 'vi' ? vi : en)
const dateLabel = (value: string, locale: PortalLocale, time = false) =>
  new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    ...(time ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(new Date(value))

function Metrics({ items }: { items: Metric[] }) {
  return (
    <div className="md-metrics">
      {items.map(({ icon: IconComponent, ...item }) => (
        <div className="md-metric" key={item.label}>
          <div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
          <span className="md-metric-icon">
            <IconComponent size={23} aria-hidden="true" />
          </span>
        </div>
      ))}
    </div>
  )
}

function PanelHeading({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="md-panel-heading">
      <h2>{title}</h2>
      {href && (
        <a href={href}>
          {link}
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

function Schedule({ locale, courseIds }: { locale: PortalLocale; courseIds: string[] }) {
  const sessions = portalDemoData.sessions.filter((item) => courseIds.includes(item.courseId))
  return (
    <section className="mis-panel md-panel">
      <PanelHeading
        title={text(locale, 'Lịch lớp trong tuần', 'This week’s classes')}
        href="#schedule"
        link={text(locale, 'Xem lịch', 'View schedule')}
      />
      <p className="md-panel-note">
        {text(
          locale,
          'Tuần mẫu 12–18/10/2026 · Giờ Việt Nam (UTC+07)',
          'Sample week: 12–18 Oct 2026 · Vietnam time (UTC+07)',
        )}
      </p>
      {sessions.length ? (
        <ul className="md-schedule">
          {sessions.map((session) => (
            <li key={session.id}>
              <span className="md-date-tile">{dateLabel(session.start, locale)}</span>
              <div>
                <strong>{session.title[locale]}</strong>
                <span>
                  <Clock size={13} aria-hidden="true" />
                  {new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(session.start))}
                  –
                  {new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(session.end))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="md-empty">
          {text(
            locale,
            'Chưa có buổi học mẫu cho lớp này.',
            'No sample sessions are scheduled for this class.',
          )}
        </p>
      )}
      <p className="md-panel-footer">
        {text(
          locale,
          'Zoom chưa kết nối. Lịch này dùng để xem thử.',
          'Zoom is not connected. This timetable is for previewing.',
        )}
      </p>
    </section>
  )
}

export function ManagementDashboard({
  state,
  learning,
  locale,
  role,
  sharedPreview = false,
}: DashboardProps) {
  const t = (vi: string, en: string) => text(locale, vi, en)
  const courseIds = visibleCourseIds(state, role)
  const courses = state.courses.filter((item) => courseIds.includes(item.id))
  const learners = visibleLearners(state, role)
  const learnerIds = new Set(learners.map((item) => item.id))
  const tasks = state.tasks.filter((item) => courseIds.includes(item.courseId))
  const submissions = visibleSubmissions(state, role)
  const pendingSubmissions = submissions.filter((item) => item.status === 'submitted')
  const returnedSubmissions = submissions.filter((item) => item.status === 'returned')
  const attendance = state.attendance.filter(
    (item) => learnerIds.has(item.learnerId) && courseIds.includes(item.courseId),
  )
  const unmarked = attendance.filter((item) => item.status === 'unmarked')
  const published = tasks.filter((item) => item.published)
  const requiredTasks = published.filter((task) =>
    portalDemoData.assignments.some((item) => item.id === task.id && item.required),
  )
  const preparation = learners.map((learner) => {
    const required = requiredTasks.filter((task) => task.courseId === learner.courseId)
    const submitted = required.filter((task) =>
      submissions.some(
        (submission) => submission.learnerId === learner.id && submission.taskId === task.id,
      ),
    ).length
    return { ...learner, submitted, total: required.length }
  })
  const needsSupport = preparation.filter((item) => item.submitted < item.total)
  const metrics: Metric[] =
    role === 'student'
      ? [
          {
            label: t('Bài đã nộp', 'Submitted assignments'),
            value: submissions.length,
            detail: t('Bài nộp thử trên thiết bị', 'Practice submissions on this device'),
            icon: ClipboardText,
          },
          {
            label: t('Từ vựng đã lưu', 'Saved vocabulary'),
            value: learning.words.length,
            detail: t('Trong sổ từ vựng của bạn', 'In your vocabulary notebook'),
            icon: Notebook,
          },
          {
            label: t('Buổi học trong tuần', 'Classes this week'),
            value: portalDemoData.sessions.filter((item) => courseIds.includes(item.courseId))
              .length,
            detail: t('Lịch mẫu 12–18/10', 'Sample schedule, 12–18 Oct'),
            icon: CalendarDots,
          },
          {
            label: t('Buổi đã điểm danh', 'Attendance recorded'),
            value: `${attendance.length - unmarked.length}/${attendance.length}`,
            detail: t('Bản ghi điểm danh mẫu', 'Sample attendance records'),
            icon: UserCheck,
          },
        ]
      : role === 'teacher'
        ? [
            {
              label: t('Lớp phụ trách', 'Assigned classes'),
              value: courses.length,
              detail: t('Trong phạm vi giảng dạy mẫu', 'Within the sample teaching scope'),
              icon: GraduationCap,
            },
            {
              label: t('Học viên', 'Students'),
              value: learners.length,
              detail: t('Danh sách lớp mẫu', 'Sample class roster'),
              icon: Users,
            },
            {
              label: t('Bài chờ đánh giá', 'Awaiting review'),
              value: pendingSubmissions.length,
              detail: t('Bài đã nộp trong luồng dùng thử', 'Work submitted in the demo workflow'),
              icon: ClipboardText,
            },
            {
              label: t('Bài tập đã giao', 'Published assignments'),
              value: published.length,
              detail: t('Đã hiển thị trong lớp', 'Visible in your classes'),
              icon: BookOpen,
            },
          ]
        : role === 'assistant'
          ? [
              {
                label: t('Lớp hỗ trợ', 'Supported classes'),
                value: courses.length,
                detail: t('Phạm vi trợ giảng mẫu', 'Sample assistant scope'),
                icon: GraduationCap,
              },
              {
                label: t('Học viên theo dõi', 'Students to follow'),
                value: learners.length,
                detail: t('Danh sách lớp phụ trách', 'Within your assigned class'),
                icon: Users,
              },
              {
                label: t('Cần bổ sung bài', 'Preparation incomplete'),
                value: needsSupport.length,
                detail: t('Theo bài nộp Reading/Writing', 'Based on Reading/Writing submissions'),
                icon: ClipboardText,
              },
              {
                label: t('Chưa điểm danh', 'Attendance unrecorded'),
                value: unmarked.length,
                detail: t('Bản ghi cần kiểm tra', 'Sample records to check'),
                icon: UserCheck,
              },
            ]
          : [
              {
                label: t('Học viên đang học', 'Active students'),
                value: learners.filter((item) => item.status === 'active').length,
                detail: t('Trong dữ liệu học vụ mẫu', 'Within the sample academic data'),
                icon: Users,
              },
              {
                label: t('Lớp đang hoạt động', 'Active classes'),
                value: courses.filter((item) => item.status === 'active').length,
                detail: t(
                  `${courses.length} lớp trong danh sách`,
                  `${courses.length} classes listed`,
                ),
                icon: GraduationCap,
              },
              {
                label: t('Tài khoản mẫu', 'Sample accounts'),
                value: state.users.filter((item) => item.active).length,
                detail: t('Đang bật trong danh sách mẫu', 'Enabled in the sample list'),
                icon: UserCheck,
              },
              {
                label: t('Bài chờ đánh giá', 'Awaiting review'),
                value: pendingSubmissions.length,
                detail: t('Bài đã nộp trong luồng dùng thử', 'Work submitted in the demo workflow'),
                icon: ClipboardText,
              },
            ]

  return (
    <div className="management-dashboard">
      <div className="md-context">
        <p>
          {role === 'student'
            ? t(
                'Theo dõi bài tập và các buổi học của bạn.',
                'Keep track of your assignments and classes.',
              )
            : role === 'teacher'
              ? t(
                  'Theo dõi lớp phụ trách và những bài cần đánh giá.',
                  'Follow your assigned classes and the work awaiting review.',
                )
              : role === 'assistant'
                ? t(
                    'Kiểm tra mức độ chuẩn bị và hỗ trợ học viên trong lớp.',
                    'Check preparation and support the students in your class.',
                  )
                : t(
                    'Nắm tình hình lớp học, học viên và công việc học vụ.',
                    'Review classes, students and academic operations.',
                  )}
        </p>
        <span>
          <CalendarDots size={16} aria-hidden="true" />
          {t('Tuần mẫu 12–18/10/2026', 'Sample week: 12–18 Oct 2026')}
        </span>
      </div>
      <Metrics items={metrics} />
      <section className="md-next-step" aria-label={t('Tiếp tục công việc', 'Continue your work')}>
        <div>
          <h2>
            {role === 'student'
              ? returnedSubmissions.length
                ? t('Bạn có phản hồi để xem lại', 'Your feedback is ready')
                : submissions.length
                  ? t('Tiếp tục luyện tập', 'Continue your practice')
                  : t('Hoàn thành bài đầu tiên', 'Complete your first assignment')
              : role === 'teacher'
                ? pendingSubmissions.length
                  ? t('Có bài nộp đang chờ bạn', 'Submitted work is ready for review')
                  : t('Sẵn sàng cho buổi học tiếp theo', 'Prepare for your next class')
                : role === 'assistant'
                  ? t('Theo dõi việc chuẩn bị của lớp', 'Follow your class’s preparation')
                  : t('Kiểm tra tiến độ học vụ', 'Review academic progress')}
          </h2>
          <p>
            {role === 'student'
              ? returnedSubmissions.length
                ? t(
                    `${returnedSubmissions.length} bài đã có nhận xét. Mở kết quả để đọc phản hồi và cải thiện bài làm.`,
                    `${returnedSubmissions.length} submissions have feedback. Open your results and plan your improvements.`,
                  )
                : t(
                    'Làm bài Reading hoặc Writing, nộp thử và xem lại phản hồi tại Kết quả học tập.',
                    'Complete Reading or Writing, submit your work and follow feedback in Report cards.',
                  )
              : role === 'teacher'
                ? pendingSubmissions.length
                  ? t(
                      `${pendingSubmissions.length} bài đang chờ nhận xét. Điểm và phản hồi được gắn với đúng lần nộp.`,
                      `${pendingSubmissions.length} submissions await review. Scores and feedback stay attached to their submission revision.`,
                    )
                  : t(
                      'Kiểm tra bài tập đã giao và học liệu. Hàng chờ sẽ cập nhật khi học viên nộp bài trong bộ dữ liệu dùng thử.',
                      'Review published assignments and materials. The queue updates when the sample student submits work in this dataset.',
                    )
                : role === 'assistant'
                  ? t(
                      'Theo dõi số bài đã nộp và những học viên còn thiếu bài chuẩn bị để hỗ trợ kịp thời.',
                      'Track submitted work counts and students with missing preparation so you can follow up.',
                    )
                  : t(
                      'Theo dõi bài nộp, phản hồi và dữ liệu lớp học trong cùng giao diện quản trị.',
                      'Follow submissions, feedback and class data from your administration workspace.',
                    )}
          </p>
          {sharedPreview && (
            <small>
              {t(
                'Bốn vai trò xem chung bộ dữ liệu dùng thử trên trình duyệt này.',
                'All four preview roles share this browser’s demo dataset.',
              )}
            </small>
          )}
        </div>
        <a
          className="mis-button mis-primary"
          href={
            role === 'student'
              ? returnedSubmissions.length
                ? '#reports'
                : '#assignments'
              : role === 'teacher'
                ? pendingSubmissions.length
                  ? '#grading'
                  : '#assignments'
                : role === 'assistant'
                  ? '#assignments'
                  : '#reports'
          }
        >
          {role === 'student'
            ? returnedSubmissions.length
              ? t('Xem phản hồi', 'Read feedback')
              : t('Mở bài tập', 'Open assignments')
            : role === 'teacher'
              ? pendingSubmissions.length
                ? t('Chấm bài', 'Review work')
                : t('Quản lý bài tập', 'Manage assignments')
              : role === 'assistant'
                ? t('Theo dõi bài tập', 'Track assignments')
                : t('Xem kết quả', 'View results')}
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
      {role === 'student' && (
        <div className="md-columns">
          <div className="md-stack">
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Bài tập của bạn', 'Your assignments')}
                href="#assignments"
                link={t('Tất cả bài tập', 'All assignments')}
              />
              {published.length ? (
                <ul className="md-task-list">
                  {published.map((task) => {
                    const submitted = submissions.find(
                      (submission) => submission.taskId === task.id,
                    )
                    const previewOnly = task.skill === 'listening' || task.skill === 'speaking'
                    return (
                      <li key={task.id}>
                        <span className={`md-task-symbol ${submitted ? 'md-done' : ''}`}>
                          {submitted ? (
                            <CheckCircle size={21} aria-hidden="true" />
                          ) : (
                            <ClipboardText size={21} aria-hidden="true" />
                          )}
                        </span>
                        <div>
                          <a href={`#assignment/${task.id}`}>{task.title[locale]}</a>
                          <span>
                            {t('Hạn mẫu', 'Sample due date')}:{' '}
                            {dateLabel(`${task.due}T18:00:00+07:00`, locale)}
                          </span>
                        </div>
                        <span className={`mis-status ${submitted ? 'md-state-done' : ''}`}>
                          {submitted
                            ? submitted.status === 'returned'
                              ? t('Đã có phản hồi', 'Feedback ready')
                              : t('Chờ nhận xét', 'Awaiting review')
                            : previewOnly
                              ? t('Xem trước', 'Preview')
                              : t('Chưa nộp', 'To do')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="md-empty">
                  {t('Chưa có bài tập được giao.', 'No assignments have been published.')}
                </p>
              )}
            </section>
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Chuẩn bị buổi hỗ trợ 1:1', 'Prepare for your 1:1')}
                href="#schedule"
                link={t('Xem lịch 1:1', 'View 1:1 schedule')}
              />
              <p className="md-panel-note">
                {t(
                  'Theo dõi các bài chuẩn bị đang được đăng trong lớp. Bạn có thể đặt lịch trước khi nộp bài.',
                  'Track the preparation tasks currently published in your class. You can reserve a slot before submitting them.',
                )}
              </p>
              <div className="md-preparation">
                {requiredTasks.map((task) => (
                  <span key={task.id}>
                    {learning.submittedIds.includes(task.id) ? (
                      <CheckCircle size={18} weight="fill" aria-hidden="true" />
                    ) : (
                      <Clock size={18} aria-hidden="true" className="md-preparation-pending" />
                    )}
                    {task.skill === 'reading' ? 'Reading' : 'Writing'}
                    <strong>
                      {learning.submittedIds.includes(task.id)
                        ? t('Đã nộp', 'Submitted')
                        : t('Cần hoàn thành', 'To complete')}
                    </strong>
                  </span>
                ))}
                {requiredTasks.length === 0 && (
                  <p>
                    {t(
                      'Chưa có bài chuẩn bị đang được đăng.',
                      'No preparation tasks are currently published.',
                    )}
                  </p>
                )}
              </div>
            </section>
          </div>
          <div className="md-stack">
            <Schedule locale={locale} courseIds={courseIds} />
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Ôn lại từ vựng', 'Review your vocabulary')}
                href="#notebook"
                link={t('Mở sổ từ', 'Open notebook')}
              />
              <p className="md-panel-note">
                {t('Các từ gần đây bạn lưu trên thiết bị.', 'Recent words saved on this device.')}
              </p>
              {learning.words.length ? (
                <div className="md-words">
                  {learning.words
                    .slice(-4)
                    .reverse()
                    .map((word) => (
                      <div key={word.id}>
                        <strong>{word.word}</strong>
                        <span>{word.meaning[locale]}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="md-empty">
                  {t(
                    'Lưu từ trong bài học để bắt đầu ôn tập.',
                    'Save a word from a lesson to start reviewing.',
                  )}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
      {role === 'teacher' && (
        <div className="md-columns">
          <div className="md-stack">
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Danh sách chờ đánh giá', 'Review queue')}
                href="#grading"
                link={t('Mở bảng chấm', 'Open grading')}
              />
              <p className="md-panel-note">
                {t(
                  'Bài đã nộp trong luồng dùng thử của lớp phụ trách. Mở từng bài để đọc nội dung và trả phản hồi.',
                  'Work submitted in your assigned class’s demo workflow. Open a submission to read it and return feedback.',
                )}
              </p>
              {pendingSubmissions.length ? (
                <div
                  className="md-table-scroll"
                  role="region"
                  aria-label={t('Danh sách chờ đánh giá', 'Review queue')}
                  tabIndex={0}
                >
                  <table className="mis-table md-table">
                    <thead>
                      <tr>
                        <th>{t('Học viên', 'Student')}</th>
                        <th>{t('Bài tập', 'Assignment')}</th>
                        <th>{t('Trạng thái', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSubmissions.map((grade) => (
                        <tr key={grade.id}>
                          <td>{learners.find((item) => item.id === grade.learnerId)?.name}</td>
                          <td>
                            <a href="#grading">
                              {tasks.find((item) => item.id === grade.taskId)?.title[locale]}
                            </a>
                          </td>
                          <td>
                            <span className="mis-status">
                              {t('Chờ đánh giá', 'Awaiting review')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="md-empty">
                  {t(
                    'Chưa có bài chờ nhận xét. Bài nộp mới sẽ xuất hiện tại đây.',
                    'No work is awaiting review. New submissions will appear here.',
                  )}
                </p>
              )}
            </section>
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Tiến độ giảng dạy', 'Teaching progress')}
                href="#syllabus"
                link={t('Giáo trình', 'Syllabus')}
              />
              <ul className="md-course-progress">
                {courses.map((course) => {
                  const units = state.units.filter((unit) => unit.courseId === course.id)
                  const complete = units.filter((unit) => unit.done).length
                  return (
                    <li key={course.id}>
                      <div>
                        <strong>{course.title}</strong>
                        <span>
                          {complete}/{units.length} {t('nội dung hoàn thành', 'units complete')}
                        </span>
                      </div>
                      <progress
                        max={units.length || 1}
                        value={complete}
                        aria-label={t(`Tiến độ ${course.title}`, `${course.title} progress`)}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
          <div className="md-stack">
            <Schedule locale={locale} courseIds={courseIds} />
            <section className="mis-panel md-panel">
              <PanelHeading title={t('Công việc của lớp', 'Class actions')} />
              <div className="md-quick-actions">
                <a href="#attendance">
                  <UserCheck size={20} aria-hidden="true" />
                  <span>
                    {t('Kiểm tra điểm danh', 'Review attendance')}
                    <small>
                      {t(
                        `${unmarked.length} bản ghi chưa đánh dấu`,
                        `${unmarked.length} records unmarked`,
                      )}
                    </small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#materials">
                  <BookOpen size={20} aria-hidden="true" />
                  <span>
                    {t('Quản lý học liệu', 'Manage learning content')}
                    <small>
                      {t('Xem và cập nhật nội dung mẫu', 'View and edit sample materials')}
                    </small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </section>
          </div>
        </div>
      )}
      {role === 'assistant' && (
        <div className="md-columns">
          <div className="md-stack">
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Theo dõi chuẩn bị bài', 'Preparation follow-up')}
                href="#students"
                link={t('Xem học viên', 'View students')}
              />
              <p className="md-panel-note">
                {t(
                  'Tiến độ các bài chuẩn bị đang được đăng trong lớp, cập nhật theo bài nộp dùng thử.',
                  'Progress on currently published preparation tasks, updated from demo submissions.',
                )}
              </p>
              <ul className="md-support-list">
                {preparation.map((learner) => (
                  <li key={learner.id}>
                    <div>
                      <strong>{learners.find((item) => item.id === learner.id)?.name}</strong>
                      <span>
                        {t(
                          `${learner.submitted}/${learner.total} bài đã nộp`,
                          `${learner.submitted}/${learner.total} assignments submitted`,
                        )}
                      </span>
                    </div>
                    <span
                      className={`mis-status ${learner.submitted < learner.total ? 'md-state-pending' : 'md-state-done'}`}
                    >
                      {learner.submitted < learner.total
                        ? t('Cần hỗ trợ', 'Needs follow-up')
                        : t('Đủ bài mẫu', 'Sample work complete')}
                    </span>
                  </li>
                ))}
              </ul>
              {preparation.length === 0 && (
                <p className="md-empty">
                  {t('Chưa có dữ liệu theo dõi mẫu.', 'No sample preparation records yet.')}
                </p>
              )}
            </section>
            <section className="mis-panel md-panel">
              <PanelHeading title={t('Kiểm tra lớp học', 'Classroom checklist')} />
              <div className="md-quick-actions">
                <a href="#attendance">
                  <UserCheck size={20} aria-hidden="true" />
                  <span>
                    {t('Rà soát điểm danh', 'Check attendance')}
                    <small>
                      {t(
                        `${unmarked.length} bản ghi chưa được cập nhật`,
                        `${unmarked.length} records have not been updated`,
                      )}
                    </small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#assignments">
                  <ClipboardText size={20} aria-hidden="true" />
                  <span>
                    {t('Xem yêu cầu bài tập', 'Review assignment instructions')}
                    <small>
                      {t(
                        `${published.length} bài đã hiển thị trong lớp`,
                        `${published.length} published class assignments`,
                      )}
                    </small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </section>
          </div>
          <div className="md-stack">
            <Schedule locale={locale} courseIds={courseIds} />
            <section className="mis-panel md-panel">
              <PanelHeading title={t('Phạm vi hỗ trợ', 'Support scope')} />
              <p className="md-panel-note">
                {t(
                  'Bạn đang xem dữ liệu minh họa của lớp IELTS Foundation. Các thao tác mẫu không gửi nhắc nhở hoặc thay đổi quyền tài khoản thật.',
                  'You are viewing sample IELTS Foundation data. Preview actions do not send reminders or change real account permissions.',
                )}
              </p>
            </section>
          </div>
        </div>
      )}
      {role === 'admin' && (
        <div className="md-columns">
          <div className="md-stack">
            <section className="mis-panel md-panel">
              <PanelHeading
                title={t('Tình hình lớp học', 'Class overview')}
                href="#courses"
                link={t('Quản lý lớp', 'Manage classes')}
              />
              {courses.length ? (
                <div
                  className="md-table-scroll"
                  role="region"
                  aria-label={t('Tình hình lớp học', 'Class overview')}
                  tabIndex={0}
                >
                  <table className="mis-table md-table">
                    <thead>
                      <tr>
                        <th>{t('Lớp', 'Class')}</th>
                        <th>{t('Học viên', 'Students')}</th>
                        <th>{t('Trạng thái', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course.id}>
                          <td>
                            <a href="#courses">{course.title}</a>
                            <small>
                              {course.level} · {course.teacher}
                            </small>
                          </td>
                          <td>{learners.filter((item) => item.courseId === course.id).length}</td>
                          <td>
                            <span
                              className={`mis-status ${course.status === 'active' ? 'md-state-done' : ''}`}
                            >
                              {course.status === 'active'
                                ? t('Đang học', 'Active')
                                : t('Bản nháp', 'Draft')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="md-empty">
                  {t('Chưa có lớp trong dữ liệu mẫu.', 'No classes in the sample data.')}
                </p>
              )}
            </section>
            <section className="mis-panel md-panel">
              <PanelHeading title={t('Cần theo dõi', 'Items to follow up')} />
              <div className="md-operation-list">
                <a href="#grading">
                  <span>{t('Bài nộp chờ nhận xét', 'Submissions awaiting review')}</span>
                  <strong>{pendingSubmissions.length}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#attendance">
                  <span>
                    {t('Bản ghi điểm danh chưa cập nhật', 'Unrecorded sample attendance')}
                  </span>
                  <strong>{unmarked.length}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#students">
                  <span>
                    {t('Học viên tạm dừng trong danh sách', 'Paused students in the roster')}
                  </span>
                  <strong>{learners.filter((item) => item.status === 'paused').length}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </section>
          </div>
          <div className="md-stack">
            <section className="mis-panel md-panel">
              <PanelHeading title={t('Truy cập nhanh', 'Quick access')} />
              <div className="md-quick-actions">
                <a href="#students">
                  <Users size={20} aria-hidden="true" />
                  <span>
                    {t('Danh sách học viên', 'Student roster')}
                    <small>{t('Tìm và xem hồ sơ mẫu', 'Search and view sample profiles')}</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#users">
                  <UserCheck size={20} aria-hidden="true" />
                  <span>
                    {t('Tài khoản và vai trò', 'Accounts and roles')}
                    <small>
                      {t('Quản lý danh sách tài khoản mẫu', 'Manage the sample account list')}
                    </small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#reports">
                  <ClipboardText size={20} aria-hidden="true" />
                  <span>
                    {t('Báo cáo học tập', 'Learning reports')}
                    <small>{t('Tổng hợp kết quả minh họa', 'Summaries of sample results')}</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </section>
            <Schedule locale={locale} courseIds={courseIds} />
          </div>
        </div>
      )}
    </div>
  )
}
