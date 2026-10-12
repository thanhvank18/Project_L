import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  BookOpen,
  CalendarDots,
  ChartBar,
  CheckSquare,
  ClipboardText,
  Gear,
  GraduationCap,
  House,
  List,
  MagnifyingGlass,
  Notebook,
  PencilLine,
  SignOut,
  Users,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import { languageStorageKey } from '@/i18n/messages'
import { usePortalSession } from '@/features/auth/usePortalSession'
import type { PortalSession } from '@/features/auth/types'
import { portalDemoData } from '@/features/learning/data'
import { useLearningDemo } from '@/features/learning/useLearningDemo'
import { LearningWorkspace } from '@/features/learning/LearningWorkspace'
import { VocabularyNotebook } from '@/features/learning/VocabularyNotebook'
import { LearningSchedule } from '@/features/learning/LearningSchedule'
import type { PortalData, PortalLocale, PortalRole } from '@/features/learning/types'
import { submissionAnswer } from '@/features/learning/submission'
import { useManagementDemo } from '@/features/management/useManagementDemo'
import { AcademicViews } from '@/features/management/AcademicViews'
import { ContentViews } from '@/features/management/ContentViews'
import { ManagementDashboard } from '@/features/management/ManagementDashboard'
import { SubmissionReview } from '@/features/management/SubmissionReview'
import { submitTask, DEMO_LEARNER_ID } from '@/features/management/workflow'
import { canViewPath, roleSections, sectionForPath } from '@/features/management/navigation'
import '@/styles/learning-portal.css'
import '@/styles/learning-workspace.css'
import '@/styles/learning-schedule.css'
import '@/styles/management-portal.css'
import '@/styles/management-academic.css'
import '@/styles/management-content.css'
import '@/styles/management-dashboard.css'

const roleNames = {
  student: { vi: 'Học viên', en: 'Student' },
  teacher: { vi: 'Giáo viên', en: 'Teacher' },
  assistant: { vi: 'Trợ giảng', en: 'Teaching assistant' },
  admin: { vi: 'Quản trị viên', en: 'Administrator' },
}
const navigation = [
  { id: 'overview', vi: 'Tổng quan', en: 'Dashboard', icon: House },
  { id: 'students', vi: 'Học viên', en: 'Students', icon: Users },
  { id: 'courses', vi: 'Lớp học', en: 'Classes', icon: GraduationCap },
  { id: 'attendance', vi: 'Điểm danh', en: 'Attendance', icon: CheckSquare },
  { id: 'syllabus', vi: 'Chương trình học', en: 'Syllabus', icon: BookOpen },
  { id: 'schedule', vi: 'Thời khóa biểu', en: 'Timetable', icon: CalendarDots },
  { id: 'materials', vi: 'Học liệu', en: 'LMS content', icon: BookOpen },
  { id: 'assignments', vi: 'Bài tập', en: 'Assignments', icon: ClipboardText },
  { id: 'grading', vi: 'Chấm bài', en: 'Grading', icon: PencilLine },
  { id: 'reports', vi: 'Kết quả học tập', en: 'Report cards', icon: ChartBar },
  { id: 'notebook', vi: 'Sổ từ vựng', en: 'Vocabulary', icon: Notebook },
  { id: 'notifications', vi: 'Thông báo', en: 'Notifications', icon: Bell },
  { id: 'users', vi: 'Tài khoản', en: 'Users', icon: UsersThree },
  { id: 'settings', vi: 'Cài đặt', en: 'Settings', icon: Gear },
] as const
const go = (path: string) => {
  window.location.hash = path
}
const readPath = () => window.location.hash.slice(1) || 'overview'
function initialLocale(): PortalLocale {
  try {
    return localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}
function StaffSchedule({ locale }: { locale: PortalLocale }) {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const format = (value: string) =>
    new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  return (
    <div className="mis-stack">
      <p className="mis-notice">
        {t(
          'Tuần mẫu 12–18/10/2026 · UTC+07. Zoom và email chưa kết nối.',
          'Sample week October 12–18, 2026 · UTC+07. Zoom and email are not connected.',
        )}
      </p>
      <section className="mis-panel mis-agenda">
        <h2>{t('Lịch lớp IELTS Foundation', 'IELTS Foundation timetable')}</h2>
        {portalDemoData.sessions.map((session) => (
          <article key={session.id}>
            <CalendarDots size={24} aria-hidden="true" />
            <div>
              <h3>{session.title[locale]}</h3>
              <time dateTime={session.start}>{format(session.start)}</time>
            </div>
            <span className="mis-status">Zoom · {t('Chưa kết nối', 'Not connected')}</span>
          </article>
        ))}
      </section>
      <section className="mis-panel mis-agenda">
        <h2>{t('Khung hỗ trợ 1:1 mẫu', 'Sample 1:1 support slots')}</h2>
        <p>
          {t(
            'Danh sách khung giờ minh họa, chưa phải lịch đặt chung giữa các tài khoản.',
            'Illustrative availability, not shared reservations across accounts.',
          )}
        </p>
        {portalDemoData.slots.map((slot) => (
          <article key={slot.id}>
            <CalendarDots size={22} aria-hidden="true" />
            <div>
              <h3>{format(slot.start)}</h3>
              <p>{slot.host[locale]}</p>
            </div>
            <span className="mis-status">{t('30 phút', '30 min')}</span>
          </article>
        ))}
      </section>
    </div>
  )
}
function PortalWorkspace({ session, signOut }: { session: PortalSession; signOut: () => void }) {
  const { role } = session
  const [locale, setLocale] = useState<PortalLocale>(initialLocale)
  const [path, setPath] = useState(readPath)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [resetRevision, setResetRevision] = useState(0)
  const [resetTarget, setResetTarget] = useState<'learning' | 'management' | null>(null)
  const [status, setStatus] = useState('')
  const [reviewTaskId, setReviewTaskId] = useState<string>()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const scope = `${session.mode}:${session.user.id}:${role}`
  const sharedPreview = session.mode === 'preview'
  const management = useManagementDemo(sharedPreview ? 'preview:shared-classroom' : scope)
  const learningData = useMemo<PortalData>(
    () => ({
      ...portalDemoData,
      assignments: management.state.tasks.map((task) => {
        const original = portalDemoData.assignments.find((item) => item.id === task.id)
        return {
          id: task.id,
          courseId: task.courseId,
          skill: task.skill,
          title: task.title,
          description: task.instructions ?? original?.description ?? task.title,
          due: `${task.due}T23:59:00+07:00`,
          minutes: original?.minutes ?? 20,
          required: original?.required ?? false,
          responseMode: 'text',
        }
      }),
    }),
    [management.state.tasks],
  )
  const learning = useLearningDemo(scope, learningData)
  const student = management.state.learners.find((item) => item.id === DEMO_LEARNER_ID)
  const studentTasks = management.state.tasks.filter(
    (task) => task.published && task.courseId === student?.courseId,
  )
  const studentSubmissions = management.state.submissions.filter(
    (item) => item.learnerId === DEMO_LEARNER_ID,
  )
  const learningState = {
    ...learning.state,
    submittedIds: studentSubmissions.map((item) => item.taskId),
  }
  const draftIds = Object.entries(learning.state.drafts)
    .filter(([id, draft]) => {
      const submitted = studentSubmissions.find((item) => item.taskId === id)
      return (
        Boolean(draft.trim()) && (!submitted || submissionAnswer(id, draft) !== submitted.answer)
      )
    })
    .map(([id]) => id)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const allowed = canViewPath(role, path)
  const section = sectionForPath(path)
  const assignmentTitle =
    path.startsWith('assignment/') && allowed
      ? management.state.tasks.find((task) => task.id === path.slice('assignment/'.length))?.title[
          locale
        ]
      : undefined
  const title =
    assignmentTitle ??
    navigation.find((item) => item.id === section)?.[locale] ??
    t('Không tìm thấy trang', 'Page not found')
  const menu = navigation.filter((item) => roleSections[role].some((id) => item.id === id))
  const filteredMenu = menu.filter((item) =>
    item[locale].toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const props = { state: management.state, commit: management.commit, locale, role }
  const onAssignment = (id: string) => go(`assignment/${id}`)
  useEffect(() => {
    const onHash = () => {
      setPath(readPath())
      setMobileOpen(false)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${title} · Elite Learning`
  }, [locale, title])
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [path])
  const changeLocale = (next: PortalLocale) => {
    setLocale(next)
    try {
      localStorage.setItem(languageStorageKey, next)
    } catch {
      /* Language remains usable for this visit. */
    }
  }
  const reset = () => {
    const success = resetTarget === 'learning' ? learning.actions.reset() : management.reset()
    if (success) {
      setResetRevision((value) => value + 1)
      setResetTarget(null)
    }
    setStatus(
      success
        ? t('Đã khôi phục dữ liệu mẫu đã chọn.', 'Selected sample data restored.')
        : t(
            'Chưa lưu được. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.',
            'Could not save. Check browser storage permissions and try again.',
          ),
    )
  }
  let content
  if (!allowed)
    content = (
      <section className="mis-empty">
        <h2>
          {t('Trang này không thuộc vai trò hiện tại', 'This page is unavailable for your role')}
        </h2>
        <p>
          {t(
            'Chọn một mục trong menu hoặc quay lại tổng quan.',
            'Choose a menu item or return to your dashboard.',
          )}
        </p>
        <a href="#overview" className="mis-button mis-primary">
          {t('Về tổng quan', 'Back to dashboard')}
        </a>
      </section>
    )
  else if (path.startsWith('assignment/')) {
    const id = path.slice('assignment/'.length)
    const assignment = learningData.assignments.find((item) => item.id === id)
    const task = studentTasks.find((item) => item.id === id)
    const submission = studentSubmissions.find((item) => item.taskId === id)
    content =
      assignment &&
      task &&
      student?.status === 'active' &&
      management.state.courses.some(
        (course) => course.id === task.courseId && course.status === 'active',
      ) ? (
        <LearningWorkspace
          key={`${assignment.id}-${resetRevision}`}
          assignment={assignment}
          locale={locale}
          state={learningState}
          actions={learning.actions}
          submission={submission}
          sharedPreview={sharedPreview}
          onSubmit={(answer) =>
            management.commit((current) => {
              const next = submitTask(current, {
                role,
                taskId: id,
                answer,
                expectedRevision: submission?.revision ?? 0,
                now: new Date().toISOString(),
              })
              if (!next) throw new Error('Assignment changed or submission is not allowed')
              return next
            })
          }
          onBack={() => go('assignments')}
        />
      ) : (
        <div className="mis-empty">
          <h2>{t('Bài tập chưa khả dụng', 'Assignment unavailable')}</h2>
          <a className="mis-button" href="#assignments">
            {t('Về bài tập', 'Back to assignments')}
          </a>
        </div>
      )
  } else if (path === 'overview')
    content = (
      <ManagementDashboard
        state={management.state}
        learning={learningState}
        locale={locale}
        role={role}
        sharedPreview={sharedPreview}
      />
    )
  else if (path === 'students' || path === 'courses' || path === 'attendance')
    content = <AcademicViews key={path} {...props} section={path} />
  else if (path === 'grading' || path === 'reports')
    content = (
      <SubmissionReview
        key={`${path}-${reviewTaskId ?? ''}`}
        {...props}
        sharedPreview={sharedPreview}
        focusTaskId={path === 'grading' ? reviewTaskId : undefined}
        onAssignment={onAssignment}
      />
    )
  else if (
    path === 'syllabus' ||
    path === 'materials' ||
    path === 'assignments' ||
    path === 'notifications' ||
    path === 'users'
  )
    content = (
      <ContentViews
        key={path}
        {...props}
        section={path}
        onAssignment={onAssignment}
        assignmentDraftIds={draftIds}
        sharedPreview={sharedPreview}
        onReviewAssignment={(id) => {
          setReviewTaskId(id)
          go('grading')
        }}
      />
    )
  else if (path === 'notebook')
    content = (
      <VocabularyNotebook locale={locale} state={learning.state} actions={learning.actions} />
    )
  else if (path === 'schedule')
    content =
      role === 'student' ? (
        <div className="mis-stack">
          <p className="mis-notice">
            {t(
              'Tuần mẫu 12–18/10/2026 · Giờ Việt Nam (UTC+07).',
              'Sample week October 12–18, 2026 · Vietnam time (UTC+07).',
            )}
          </p>
          <LearningSchedule
            locale={locale}
            data={{
              ...learningData,
              assignments: learningData.assignments.filter((item) =>
                studentTasks.some((task) => task.id === item.id),
              ),
            }}
            state={learningState}
            actions={learning.actions}
            onAssignment={onAssignment}
          />
        </div>
      ) : (
        <StaffSchedule locale={locale} />
      )
  else
    content = (
      <div className="mis-stack">
        <section className="mis-panel mis-settings">
          <h2>{t('Tài khoản hiện tại', 'Current account')}</h2>
          <dl>
            <div>
              <dt>{t('Họ tên', 'Name')}</dt>
              <dd>{session.user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{session.user.email}</dd>
            </div>
            <div>
              <dt>{t('Vai trò', 'Role')}</dt>
              <dd>{roleNames[role][locale]}</dd>
            </div>
            <div>
              <dt>{t('Phiên truy cập', 'Session')}</dt>
              <dd>
                {session.mode === 'authenticated'
                  ? t('Đã xác thực qua API cục bộ', 'Verified by the local API')
                  : t('Xem giao diện mẫu', 'Public interface preview')}
              </dd>
            </div>
          </dl>
          <p>
            {t(
              'Quyền tài khoản thật do hệ thống máy chủ xác định.',
              'Real account permissions are determined by the server.',
            )}
          </p>
        </section>
        <section className="mis-panel mis-settings">
          <h2>{t('Dữ liệu thử trên trình duyệt', 'Browser sample data')}</h2>
          <p>
            {sharedPreview
              ? t(
                  'Danh sách và bài nộp dùng chung giữa bốn vai trò xem thử trên trình duyệt này. Khôi phục danh sách sẽ đặt lại lớp mẫu cho cả bốn vai trò. Bản nháp, sổ từ vựng và lịch đặt của học viên được lưu riêng.',
                  'Lists and submissions are shared by all four previews in this browser. Resetting lists resets the sample class for every preview role. Student drafts, vocabulary and reservations are stored separately.',
                )
              : t(
                  'Khôi phục chỉ tác động tới dữ liệu mẫu của tài khoản này trên trình duyệt hiện tại.',
                  'Reset affects only this account’s sample data in this browser.',
                )}
          </p>
          <div className="mis-toolbar">
            <button
              className="mis-button"
              onClick={() => {
                setResetTarget('management')
                setStatus('')
              }}
            >
              {t('Khôi phục danh sách mẫu', 'Reset sample lists')}
            </button>
            {role === 'student' && (
              <button
                className="mis-button"
                onClick={() => {
                  setResetTarget('learning')
                  setStatus('')
                }}
              >
                {t(
                  'Đặt lại bản nháp, từ vựng và lịch đặt',
                  'Reset drafts, vocabulary and reservations',
                )}
              </button>
            )}
          </div>
          {resetTarget && (
            <div className="mis-confirm">
              <p>
                {resetTarget === 'management' && sharedPreview
                  ? t(
                      'Đặt lại lớp mẫu sẽ xóa bài nộp và nhận xét của cả bốn vai trò xem thử trên trình duyệt này. Thao tác này không thể hoàn tác.',
                      'Resetting the sample class removes submissions and feedback for all four previews in this browser. This cannot be undone.',
                    )
                  : t(
                      'Dữ liệu mẫu đã chọn sẽ được khôi phục. Thao tác này không thể hoàn tác.',
                      'The selected sample data will be reset. This cannot be undone.',
                    )}
              </p>
              <div className="mis-toolbar">
                <button className="mis-button mis-primary" onClick={reset}>
                  {t('Xác nhận khôi phục', 'Confirm reset')}
                </button>
                <button className="mis-button" onClick={() => setResetTarget(null)}>
                  {t('Giữ dữ liệu', 'Keep data')}
                </button>
              </div>
            </div>
          )}
          {status && <p role="status">{status}</p>}
        </section>
      </div>
    )
  return (
    <div className="learning-portal mis-portal">
      <a
        className="mis-skip"
        href="#mis-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('mis-main')?.focus()
        }}
      >
        {t('Bỏ qua menu', 'Skip navigation')}
      </a>
      <header className="mis-mobile-header">
        <a href="/">Elite Learning</a>
        <button
          className="mis-button"
          aria-expanded={mobileOpen}
          aria-controls="mis-sidebar"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <List size={20} />} Menu
        </button>
      </header>
      <aside id="mis-sidebar" className={`mis-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <a className="mis-brand" href="/">
          <strong>Elite Learning</strong>
          <span>{t('Quản lý học tập', 'Learning Management')}</span>
        </a>
        <div className="mis-identity">
          <strong>{session.user.name}</strong>
          <span className="mis-role-badge">{roleNames[role][locale]}</span>
        </div>
        {session.mode === 'preview' && (
          <label className="mis-preview-picker">
            {t('Xem giao diện mẫu', 'Preview a role')}
            <select
              value={role}
              onChange={(event) => {
                window.location.href = `/learn?preview=${event.target.value}#overview`
              }}
            >
              {(Object.keys(roleNames) as PortalRole[]).map((id) => (
                <option key={id} value={id}>
                  {roleNames[id][locale]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="mis-nav-search">
          <MagnifyingGlass size={17} aria-hidden="true" />
          <span className="sr-only">{t('Tìm mục trong menu', 'Search navigation')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Tìm trong menu…', 'Search navigation…')}
          />
        </label>
        <nav aria-label={t('Điều hướng học tập', 'Learning navigation')}>
          {filteredMenu.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={section === item.id && allowed ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={19} aria-hidden="true" />
              <span>{item[locale]}</span>
            </a>
          ))}
          {!filteredMenu.length && (
            <div className="mis-no-nav">
              <p>{t('Không có mục phù hợp.', 'No matching sections.')}</p>
              <button className="mis-button" onClick={() => setSearch('')}>
                {t('Xóa tìm kiếm', 'Clear search')}
              </button>
            </div>
          )}
        </nav>
        <button className="mis-signout" onClick={signOut}>
          <SignOut size={20} aria-hidden="true" />
          {session.mode === 'preview'
            ? t('Về đăng nhập', 'Back to login')
            : t('Đăng xuất', 'Sign out')}
        </button>
      </aside>
      <main id="mis-main" className="mis-main" tabIndex={-1}>
        <header className="mis-page-heading">
          <div>
            <h1 ref={titleRef} tabIndex={-1}>
              {title}
            </h1>
            <p>
              {roleNames[role][locale]} ·{' '}
              {t('Năm học mẫu 2026–2027', 'Sample academic year 2026–2027')}
            </p>
          </div>
          <div className="mis-language" role="group" aria-label={t('Ngôn ngữ', 'Language')}>
            <button aria-pressed={locale === 'vi'} onClick={() => changeLocale('vi')}>
              VI
            </button>
            <button aria-pressed={locale === 'en'} onClick={() => changeLocale('en')}>
              EN
            </button>
          </div>
        </header>
        <div className="mis-demo-notice">
          <span className="mis-status">{t('Dữ liệu mẫu', 'Sample data')}</span>
          <p>
            {sharedPreview
              ? t(
                  'Bốn vai trò mẫu dùng chung lớp học trên trình duyệt này. Đổi vai trò để thử luồng giao bài → nộp bài → nhận xét.',
                  'All four previews share a class in this browser. Switch roles to try assigning, submitting and reviewing work.',
                )
              : t(
                  'Các thay đổi học vụ lưu riêng cho tài khoản này trên trình duyệt, chưa đồng bộ giữa các tài khoản.',
                  'Academic changes are saved for this account in this browser and are not shared between accounts.',
                )}
            {!sharedPreview && (
              <>
                {' '}
                <a href="/learn?preview=student#overview">
                  {t('Thử luồng nhiều vai trò', 'Try the multi-role demo')}
                </a>
              </>
            )}
          </p>
        </div>
        {(learning.storageError || management.storageError) && (
          <p className="mis-error" role="alert">
            {t(
              'Chưa đọc hoặc lưu được một phần dữ liệu cục bộ. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.',
              'Some local data could not be read or saved. Check browser storage permissions and try again.',
            )}
          </p>
        )}
        {content}
      </main>
    </div>
  )
}
export function LearningPortalPage() {
  const auth = usePortalSession()
  const locale = initialLocale()
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  useEffect(() => {
    if (auth.status === 'signed-out') window.location.replace('/login')
  }, [auth.status])
  if (auth.status === 'ready' && auth.session)
    return (
      <PortalWorkspace
        key={`${auth.session.mode}:${auth.session.user.id}:${auth.session.role}`}
        session={auth.session}
        signOut={auth.signOut}
      />
    )
  return (
    <main className="mis-portal mis-auth-state">
      <div className="mis-panel">
        <h1>
          {auth.status === 'loading' || auth.status === 'signed-out'
            ? t('Đang kiểm tra phiên đăng nhập…', 'Checking your session…')
            : auth.status === 'unsupported'
              ? t('Vai trò chưa được hỗ trợ', 'Role not yet supported')
              : t('Chưa kết nối được tài khoản', 'Unable to verify your account')}
        </h1>
        {(auth.status === 'error' || auth.status === 'unsupported') && (
          <>
            <p>
              {auth.status === 'unsupported'
                ? t(
                    'Tài khoản này chưa có giao diện phù hợp. Hãy dùng tài khoản học viên, giáo viên hoặc quản trị viên.',
                    'This account has no supported interface yet. Use a student, teacher or administrator account.',
                  )
                : t(
                    'Kiểm tra API cục bộ đang chạy rồi thử lại. Bạn cũng có thể xem giao diện mẫu từ trang đăng nhập.',
                    'Check that the local API is running, then retry. Interface previews are also available from the login page.',
                  )}
            </p>
            <div className="mis-toolbar">
              <button className="mis-button mis-primary" onClick={auth.retry}>
                {t('Thử lại', 'Retry')}
              </button>
              <a className="mis-button" href="/login">
                {t('Về đăng nhập', 'Back to login')}
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
