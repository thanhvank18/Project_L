/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named table regions support keyboard scrolling. */
import { useState } from 'react'
import { CalendarDots } from '@phosphor-icons/react'
import type { Locale, Skill } from '../../../shared/portal'
import { learningInsights } from '@/features/live/learning-insights'
import type { LiveViewProps } from '@/features/live/types'
import '@/styles/learning-insights.css'

const skillNames: Record<Skill, { vi: string; en: string }> = {
  reading: { vi: 'Đọc', en: 'Reading' },
  writing: { vi: 'Viết', en: 'Writing' },
  listening: { vi: 'Nghe', en: 'Listening' },
  speaking: { vi: 'Nói', en: 'Speaking' },
}
function dateTime(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function LearningOverview({ state, locale }: LiveViewProps) {
  const [selectedClass, setSelectedClass] = useState('')
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const { role } = state.user
  const student = role === 'student'
  const assistant = role === 'assistant'
  const activeClasses = state.classes.filter((room) => room.active)
  const classId = activeClasses.some((room) => room.id === selectedClass) ? selectedClass : ''
  const insights = learningInsights(state, classId)
  const classroom = (id: string) => state.classes.find((room) => room.id === id)?.title ?? ''
  const person = (id: string) =>
    state.users.find((user) => user.id === id)?.name ?? t('Học viên', 'Student')
  const counts = [
    {
      label: student ? t('Bài cần nộp', 'Tasks to submit') : t('Bài đã giao', 'Published tasks'),
      value: student ? insights.pending.length : insights.assignments.length,
      href: '#assignments',
    },
    {
      label: assistant
        ? t('Bài đã nộp hiện tại', 'Current submissions')
        : t('Chờ chấm', 'Awaiting review'),
      value: assistant ? insights.submitted : insights.pendingReviews.length,
      href: assistant ? '#assignments' : student ? '#reports' : '#grading',
    },
    {
      label: student
        ? t('Từ cần ôn · toàn bộ sổ', 'Words due · entire notebook')
        : t('Học viên cần chuẩn bị', 'Students to follow up'),
      value: student ? insights.vocabularyDue : insights.followUpStudents,
      href: student ? '#notebook/practice' : '#assignments',
    },
    {
      label: t('Thông báo chưa đọc · toàn bộ', 'Unread notices · all'),
      value: state.notifications.filter((notice) => !notice.read).length,
      href: '#notifications',
    },
  ]
  return (
    <div className="mis-stack learning-overview">
      {!activeClasses.length && (
        <section className="mis-panel live-welcome">
          <h2>
            {student
              ? t('Bắt đầu học cùng lớp', 'Start learning with a class')
              : t('Không gian học tập của bạn', 'Your learning workspace')}
          </h2>
          <p>
            {role === 'admin'
              ? t(
                  'Tạo tài khoản, mở lớp và phân công thành viên để bắt đầu theo dõi việc học.',
                  'Create accounts, open a class and assign members to start tracking learning.',
                )
              : student
                ? t(
                    'Xem các lớp đang mở và gửi yêu cầu đăng ký. Lớp học sẽ xuất hiện sau khi quản trị viên duyệt.',
                    'Browse open classes and request enrollment. Your class will appear after administrator approval.',
                  )
                : t(
                    'Bạn chưa được phân công vào lớp đang hoạt động. Liên hệ quản trị viên để được thêm vào lớp.',
                    'You have no active class assignments. Contact your administrator to be assigned to a class.',
                  )}
          </p>
          {role === 'admin' && (
            <div className="live-actions">
              <a className="mis-button mis-primary" href="#users">
                {t('Tạo tài khoản', 'Create accounts')}
              </a>
              <a className="mis-button" href="#courses">
                {t('Quản lý lớp', 'Manage classes')}
              </a>
            </div>
          )}
        </section>
      )}
      <div className="learning-overview-toolbar">
        <p className="learning-help">
          {student
            ? t(
                'Bài cần làm, lịch đã đặt và tiến độ của bạn.',
                'Your next tasks, booked sessions and learning progress.',
              )
            : t(
                'Theo dõi các bài hiện tại và việc chuẩn bị của lớp.',
                'Track current assignments and class preparation.',
              )}
        </p>
        {activeClasses.length > 1 && (
          <label className="mis-field learning-class-filter">
            {t('Lọc theo lớp', 'Filter by class')}
            <select value={classId} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="">{t('Tất cả lớp đang hoạt động', 'All active classes')}</option>
              {activeClasses.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <dl className="learning-counts">
        {counts.map((item) => (
          <div key={item.label}>
            <dt>
              <a href={item.href}>{item.label}</a>
            </dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {role === 'admin' && insights.enrollmentPending > 0 && (
        <p className="mis-notice learning-enrollment-notice">
          <strong>
            {insights.enrollmentPending}{' '}
            {t('yêu cầu đăng ký đang chờ duyệt.', 'enrollment requests awaiting approval.')}
          </strong>
          <a href="#courses">{t('Duyệt đăng ký lớp', 'Review enrollment requests')}</a>
        </p>
      )}
      {student && (
        <section className="mis-panel live-review-entry">
          <div>
            <h2>{t('Đặt lịch review 1:1', 'Book a 1:1 review')}</h2>
            <p>
              {t(
                'Chọn giờ với giáo viên để review trước buổi học. Bạn có thể giữ chỗ trước, rồi nộp đủ bài bắt buộc trước khi vào Zoom.',
                'Choose a time with your teacher for a pre-class review. Reserve first, then submit required assignments before joining Zoom.',
              )}
            </p>
          </div>
          <div className="live-actions">
            <a className="mis-button mis-primary" href="#schedule/consultations">
              <CalendarDots size={18} aria-hidden="true" />
              {t('Chọn giờ review', 'Choose a review slot')}
            </a>
            <a className="mis-button" href="#courses/open">
              {t('Xem lớp đang mở', 'Browse open classes')}
            </a>
            <a className="mis-button" href="#notebook/practice">
              {t('Ôn từ vựng', 'Practise vocabulary')}
            </a>
          </div>
        </section>
      )}
      <div className="live-overview-columns">
        <section className="mis-panel mis-stack">
          <div className="live-heading">
            <h2>
              {student
                ? t('Việc cần làm tiếp', 'Your next steps')
                : assistant
                  ? t('Chuẩn bị cho lớp', 'Class preparation')
                  : t('Bài cần chấm tiếp', 'Next submissions to review')}
            </h2>
            <a href={student || assistant ? '#assignments' : '#grading'}>
              {student || assistant
                ? t('Xem bài tập', 'View assignments')
                : t('Mở danh sách chấm', 'Open review queue')}
            </a>
          </div>
          {student ? (
            insights.pending.length ? (
              <ol className="live-rows learning-task-list">
                {insights.pending.slice(0, 5).map(({ assignment, urgency, hasDraft, changed }) => (
                  <li key={assignment.id}>
                    <div className="learning-task-heading">
                      <a href={`#assignment/${assignment.id}`}>{assignment.title[locale]}</a>
                      {urgency !== 'later' && (
                        <span className={`mis-status learning-urgency-${urgency}`}>
                          {urgency === 'overdue'
                            ? t('Quá hạn', 'Overdue')
                            : t('Trong 48 giờ', 'Within 48 hours')}
                        </span>
                      )}
                    </div>
                    <span>
                      {classroom(assignment.classId)} · {skillNames[assignment.skill][locale]}
                    </span>
                    <span>
                      {assignment.dueAt ? (
                        <>
                          {t('Hạn nộp', 'Due')}{' '}
                          <time dateTime={assignment.dueAt}>
                            {dateTime(assignment.dueAt, locale)}
                          </time>
                        </>
                      ) : (
                        t('Không có hạn nộp', 'No deadline')
                      )}
                    </span>
                    {(changed || hasDraft) && (
                      <span>
                        {changed
                          ? t(
                              'Đề bài đã cập nhật; cần nộp phiên bản hiện tại.',
                              'The assignment changed; submit the current version.',
                            )
                          : t(
                              'Đã có bản nháp, tiếp tục làm bài.',
                              'A draft is saved; continue your work.',
                            )}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mis-empty">
                {insights.assignments.length
                  ? t(
                      'Bạn đã nộp đủ các bài hiện tại. Xem nhận xét hoặc ôn từ vựng trong lúc chờ buổi học.',
                      'All current assignments are submitted. Read your feedback or practise vocabulary before the next lesson.',
                    )
                  : t(
                      'Chưa có bài tập được giao trong lớp đã chọn. Bài mới sẽ xuất hiện khi giáo viên công bố.',
                      'No assignments are published in the selected classes. New tasks appear when your teacher publishes them.',
                    )}
              </p>
            )
          ) : assistant ? (
            <div className="mis-stack">
              <p className="learning-help">
                {t(
                  'Theo dõi bản nộp đúng phiên bản của bài bắt buộc. Chi tiết câu trả lời và nhận xét riêng chỉ dành cho người có quyền.',
                  'Track current-version submissions for required work. Answers and private feedback are available only to authorized roles.',
                )}
              </p>
              <p>
                {insights.followUpStudents > 0
                  ? t(
                      `${insights.followUpStudents} học viên chưa nộp đủ bài bắt buộc. Xem tình trạng từng lớp bên dưới để hỗ trợ chuẩn bị.`,
                      `${insights.followUpStudents} students still have required work to submit. Use the class preparation summary below to follow up.`,
                    )
                  : t(
                      'Chưa có học viên nào thiếu bài bắt buộc trong các lớp đã chọn.',
                      'No students have missing required work in the selected classes.',
                    )}
              </p>
              <a href="#schedule">
                {t('Xem lịch và kiểm tra link Zoom', 'View timetable and check Zoom links')}
              </a>
            </div>
          ) : insights.pendingReviews.length ? (
            <ul className="live-rows">
              {insights.pendingReviews.slice(0, 5).map((submission) => (
                <li key={submission.id}>
                  <a href="#grading">{submission.title[locale]}</a>
                  <span>
                    {person(submission.studentId)} · {classroom(submission.classId)}
                  </span>
                  <span>
                    {t('Bản nộp', 'Revision')} {submission.revision} ·{' '}
                    <time dateTime={submission.submittedAt}>
                      {dateTime(submission.submittedAt, locale)}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mis-empty">
              {t(
                'Không có bản nộp hiện tại đang chờ chấm. Bài mới nhất của mỗi học viên sẽ xuất hiện ở đây.',
                'No current submissions are awaiting review. Each student’s latest submission will appear here.',
              )}
            </p>
          )}
          {!student && !assistant && (
            <p className="learning-help">
              {role === 'admin'
                ? t(
                    'Chỉ giáo viên được gửi điểm và nhận xét. Danh sách này ưu tiên bản mới nhất của đề bài hiện tại.',
                    'Only teachers can return grades and feedback. This queue prioritizes the latest revision of current assignments.',
                  )
                : t(
                    'Ưu tiên bản mới nhất của đề bài hiện tại; các bản trước vẫn có trong lịch sử bài nộp.',
                    'Latest revisions of current assignments are shown first; earlier revisions remain in submission history.',
                  )}
            </p>
          )}
        </section>
        <section className="mis-panel mis-stack">
          <div className="live-heading">
            <h2>
              {student
                ? t('Lịch học của bạn', 'Your upcoming sessions')
                : t('Buổi học sắp tới', 'Upcoming sessions')}
            </h2>
            <a href="#schedule">{t('Xem lịch', 'View timetable')}</a>
          </div>
          {insights.upcoming.length ? (
            <ul className="live-rows">
              {insights.upcoming.slice(0, 5).map((lesson) => (
                <li key={lesson.id}>
                  <div className="learning-task-heading">
                    <strong>{lesson.title}</strong>
                    <span className="mis-status">
                      {lesson.kind === 'class'
                        ? t('Lớp chính', 'Main class')
                        : student
                          ? t('Review 1:1 · đã đặt', '1:1 review · booked')
                          : t('Review 1:1', '1:1 review')}
                    </span>
                  </div>
                  <span>{classroom(lesson.classId)}</span>
                  <time dateTime={lesson.startsAt}>{dateTime(lesson.startsAt, locale)}</time>
                  <span>
                    {lesson.hasMeeting
                      ? t('Đã có link Zoom', 'Zoom link is configured')
                      : t('Đang chờ link Zoom', 'Awaiting Zoom link')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mis-empty">
              {student
                ? t(
                    'Chưa có buổi học hoặc lịch review đã đặt sắp tới. Chọn giờ review 1:1 bên dưới khi giáo viên mở lịch.',
                    'No upcoming classes or booked reviews. Choose a 1:1 review below when your teacher opens a slot.',
                  )
                : t(
                    'Chưa có buổi học sắp tới trong các lớp đã chọn. Mở thời khóa biểu để kiểm tra hoặc thêm lịch theo quyền của bạn.',
                    'No upcoming sessions in the selected classes. Open the timetable to check or add sessions according to your role.',
                  )}
            </p>
          )}
        </section>
      </div>
      {student ? (
        <section className="mis-panel mis-stack">
          <div className="live-heading">
            <h2>{t('Tiến độ bốn kỹ năng', 'Four-skill progress')}</h2>
            <a href="#reports">{t('Xem điểm và nhận xét', 'View scores and feedback')}</a>
          </div>
          <p className="learning-help">
            {t(
              'Số bài đã nộp theo đề bài hiện tại. Điểm trung bình /9 dùng bản đã chấm mới nhất của mỗi bài trong phiên bản hiện tại; đây là điểm bài tập do giáo viên chấm.',
              'Submission counts use current assignment versions. Average scores /9 use one latest reviewed submission per current assignment; these are teacher-assessed assignment scores.',
            )}
          </p>
          <div
            className="learning-table-scroll"
            role="region"
            tabIndex={0}
            aria-label={t('Tiến độ theo kỹ năng', 'Progress by skill')}
          >
            <table className="mis-table learning-table">
              <thead>
                <tr>
                  <th scope="col">{t('Kỹ năng', 'Skill')}</th>
                  <th scope="col">{t('Đã nộp / được giao', 'Submitted / assigned')}</th>
                  <th scope="col">{t('Bài có điểm', 'Scored tasks')}</th>
                  <th scope="col">{t('Điểm TB / 9', 'Average / 9')}</th>
                </tr>
              </thead>
              <tbody>
                {insights.progress.map((item) => (
                  <tr key={item.skill}>
                    <th scope="row">{skillNames[item.skill][locale]}</th>
                    <td>
                      {item.submitted} / {item.assigned}
                    </td>
                    <td>{item.reviewed}</td>
                    <td>
                      {item.average === null
                        ? t('Chưa có điểm', 'Not scored')
                        : new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                            maximumFractionDigits: 1,
                          }).format(item.average)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mis-panel mis-stack">
          <div className="live-heading">
            <h2>{t('Tình trạng chuẩn bị theo lớp', 'Preparation by class')}</h2>
            <a href="#assignments">{t('Xem bài bắt buộc', 'View required work')}</a>
          </div>
          <p className="learning-help">
            {t(
              'Chỉ tính học viên đang hoạt động và bài bắt buộc đã công bố. “Đủ bài” nghĩa là đã nộp đúng phiên bản đề bài hiện tại, chưa phản ánh kết quả chấm.',
              'Includes active students and published required assignments. “Prepared” means current-version work is submitted; it does not represent a grade.',
            )}
          </p>
          {insights.preparation.length ? (
            <div
              className="learning-table-scroll"
              role="region"
              tabIndex={0}
              aria-label={t('Tình trạng chuẩn bị của lớp', 'Class preparation status')}
            >
              <table className="mis-table learning-table">
                <thead>
                  <tr>
                    <th scope="col">{t('Lớp', 'Class')}</th>
                    <th scope="col">{t('Bài bắt buộc', 'Required tasks')}</th>
                    <th scope="col">{t('Học viên đủ bài', 'Prepared students')}</th>
                    <th scope="col">{t('Lượt bài chưa nộp', 'Missing submissions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.preparation.map((room) => (
                    <tr key={room.classId}>
                      <th scope="row">{room.title}</th>
                      <td>{room.required}</td>
                      <td>
                        {room.required
                          ? `${room.ready} / ${room.students}`
                          : t('Chưa yêu cầu', 'Not required')}
                      </td>
                      <td>{room.missing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mis-empty">
              {t('Chưa có lớp đang hoạt động để tổng hợp.', 'No active classes to summarize.')}
            </p>
          )}
          {insights.followUpStudents > 0 && (
            <div className="learning-followups">
              <h3>{t('Học viên cần chuẩn bị', 'Students to follow up')}</h3>
              {insights.preparation
                .filter((room) => room.followUps.length)
                .map((room) => (
                  <details key={room.classId}>
                    <summary>
                      {room.title} · {room.followUps.length}{' '}
                      {t('học viên thiếu bài', 'students with missing work')}
                    </summary>
                    <ul className="live-rows">
                      {room.followUps.map((learner) => (
                        <li key={learner.studentId}>
                          <strong>{person(learner.studentId)}</strong>
                          <span>
                            {t('Cần nộp', 'To submit')}:{' '}
                            {learner.tasks.map((task) => task.title[locale]).join('; ')}
                          </span>
                          {learner.nextReview ? (
                            <span>
                              {t('Review 1:1 đã đặt', 'Booked 1:1 review')}:{' '}
                              <time dateTime={learner.nextReview.startsAt}>
                                {dateTime(learner.nextReview.startsAt, locale)}
                              </time>
                            </span>
                          ) : (
                            <span>
                              {t(
                                'Chưa có lịch review 1:1 sắp tới.',
                                'No upcoming 1:1 review booked.',
                              )}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
