import { useEffect, useRef, useState } from 'react'
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
  ArrowClockwise,
} from '@phosphor-icons/react'
import { languageStorageKey } from '@/i18n/messages'
import { usePortalSession } from '@/features/auth/usePortalSession'
import { useLivePortal } from '@/features/live/useLivePortal'
import { AdministrationViews } from '@/features/live/AdministrationViews'
import { EnrollmentReviewPanel, StudentEnrollmentView } from '@/features/live/EnrollmentViews'
import { AcademicContentViews } from '@/features/live/AcademicContentViews'
import { AssignmentWorkspace } from '@/features/live/AssignmentWorkspace'
import { SubmissionViews } from '@/features/live/SubmissionViews'
import { ScheduleView, NotebookView, AccountView } from '@/features/live/PersonalViews'
import { LearningOverview } from '@/features/live/LearningOverview'
import { VocabularyPracticeView } from '@/features/live/VocabularyPracticeView'
import { canViewPath, roleSections, sectionForPath } from '@/features/management/navigation'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import type { Locale } from '../../shared/portal'
import '@/styles/learning-portal.css'
import '@/styles/management-portal.css'
import '@/styles/management-academic.css'
import '@/styles/management-content.css'
import '@/styles/management-dashboard.css'
import '@/styles/live-portal.css'

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
function initialLocale(): Locale {
  try {
    return localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}

function AssignmentRoute(props: LiveViewProps & { id: string }) {
  const current = props.state.assignments.find((item) => item.id === props.id && item.published)
  const [snapshot, setSnapshot] = useState(current)
  if (current && current !== snapshot) setSnapshot(current)
  const task = current ?? snapshot
  return task ? (
    <AssignmentWorkspace {...props} assignment={task} available={Boolean(current)} />
  ) : (
    <p className="mis-empty">
      {props.locale === 'vi'
        ? 'Bài tập không còn khả dụng.'
        : 'This assignment is no longer available.'}
    </p>
  )
}

function Portal({ signOut }: { signOut: () => void }) {
  const live = useLivePortal()
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [path, setPath] = useState(() => window.location.hash.slice(1) || 'overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const menuToggle = useRef<HTMLButtonElement>(null)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  useEffect(() => {
    const change = () => {
      const next = window.location.hash.slice(1) || 'overview'
      if (next === path) return
      if (!window.dispatchEvent(new Event('project-l:before-leave', { cancelable: true }))) {
        window.history.replaceState(null, '', `#${path}`)
        return
      }
      setPath(next)
      setMobileOpen(false)
    }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [path])
  useEffect(() => {
    heading.current?.focus()
  }, [path])
  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileOpen(false)
      menuToggle.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${navigation.find((item) => item.id === sectionForPath(path))?.[locale] ?? (locale === 'vi' ? 'Không gian học tập' : 'Learning workspace')} · Elite Pathway`
    try {
      localStorage.setItem(languageStorageKey, locale)
    } catch {
      /* In-memory language remains usable. */
    }
  }, [locale, path])
  if (!live.state)
    return (
      <main className="mis-portal mis-auth-state">
        <section className="mis-panel mis-stack">
          <h1>
            {live.loading
              ? t('Đang tải không gian học tập…', 'Loading your learning space…')
              : t('Chưa tải được dữ liệu', 'Could not load your data')}
          </h1>
          {live.error != null && (
            <>
              <p role="alert">{errorMessage(live.error, locale)}</p>
              <button
                className="mis-button"
                onClick={() => void live.refresh().catch(() => undefined)}
              >
                {t('Thử lại', 'Retry')}
              </button>
            </>
          )}
        </section>
      </main>
    )
  const state = live.state
  const props: LiveViewProps = { state: live.state, locale, run: live.run, refresh: live.refresh }
  const { role } = live.state.user
  const allowed = canViewPath(role, path)
  const section = sectionForPath(path)
  const menu = navigation.filter(
    (item) =>
      roleSections[role].some((id) => id === item.id) &&
      item[locale].toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
  const task = path.startsWith('assignment/')
    ? live.state.assignments.find((item) => item.id === path.slice(11) && item.published)
    : undefined
  let content
  if (!allowed)
    content = (
      <section className="mis-panel mis-stack">
        <h2>{t('Trang không khả dụng', 'Page unavailable')}</h2>
        <p>
          {t(
            'Tài khoản của bạn không có quyền xem mục này.',
            'Your account does not have access to this section.',
          )}
        </p>
        <a href="#overview">{t('Về tổng quan', 'Back to dashboard')}</a>
      </section>
    )
  else if (path.startsWith('assignment/'))
    content = <AssignmentRoute key={path} {...props} id={path.slice(11)} />
  else if (section === 'overview') content = <LearningOverview {...props} />
  else if (section === 'courses' && state.user.role === 'student')
    content = (
      <StudentEnrollmentView
        key={path}
        {...props}
        initialView={path === 'courses/open' ? 'open' : undefined}
      />
    )
  else if (section === 'users' || section === 'courses' || section === 'students')
    content = (
      <div className="mis-stack">
        <AdministrationViews
          key={section}
          {...props}
          section={section === 'courses' ? 'classes' : section}
        />
        {section === 'courses' && state.user.role === 'admin' && (
          <EnrollmentReviewPanel {...props} />
        )}
      </div>
    )
  else if (
    section === 'assignments' ||
    section === 'materials' ||
    section === 'syllabus' ||
    section === 'attendance' ||
    section === 'notifications'
  )
    content = (
      <AcademicContentViews
        key={section}
        {...props}
        section={section}
        onAssignment={(id) => {
          window.location.hash = `assignment/${id}`
        }}
      />
    )
  else if (section === 'grading' || section === 'reports')
    content = <SubmissionViews key={section} {...props} section={section} />
  else if (section === 'schedule')
    content = (
      <ScheduleView
        key={path}
        {...props}
        initialKind={path === 'schedule/consultations' ? 'consultation' : 'all'}
      />
    )
  else if (path === 'notebook/practice') content = <VocabularyPracticeView {...props} />
  else if (section === 'notebook') content = <NotebookView {...props} />
  else content = <AccountView {...props} />
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
        <a href="/" aria-label="Elite Pathway">
          <img src="/elite-reference/logo.svg" width="44" height="44" alt="" />
          <span>Elite Pathway</span>
        </a>
        <button
          ref={menuToggle}
          className="mis-button"
          aria-controls="mis-sidebar"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <List size={20} aria-hidden="true" />}{' '}
          Menu
        </button>
      </header>
      <aside id="mis-sidebar" className={`mis-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <a className="mis-brand" href="/">
          <img src="/elite-reference/logo.svg" width="56" height="56" alt="" />
          <div>
            <strong>Elite Pathway</strong>
            <span>{t('Quản lý học tập', 'Learning Management')}</span>
          </div>
        </a>
        <div className="mis-identity">
          <span className="mis-avatar" aria-hidden="true">
            {live.state.user.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0])
              .join('')
              .toLocaleUpperCase(locale)}
          </span>
          <div className="mis-identity-copy">
            <strong>{live.state.user.name}</strong>
            <span className="mis-role-badge">{roleNames[role][locale]}</span>
          </div>
        </div>
        <label className="mis-nav-search">
          <MagnifyingGlass size={17} aria-hidden="true" />
          <span className="sr-only">{t('Tìm trong menu', 'Search navigation')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Tìm trong menu…', 'Search navigation…')}
          />
        </label>
        <nav aria-label={t('Điều hướng học tập', 'Learning navigation')}>
          {menu.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => {
                if (path === item.id) setMobileOpen(false)
              }}
              aria-current={allowed && item.id === section ? 'page' : undefined}
            >
              <item.icon size={19} aria-hidden="true" />
              <span>{item[locale]}</span>
              {item.id === 'notifications' &&
                state.notifications.some((notice) => !notice.read) && (
                  <span className="live-unread">
                    {state.notifications.filter((notice) => !notice.read).length}
                  </span>
                )}
            </a>
          ))}
          {!menu.length && (
            <div className="mis-no-nav">
              <p>{t('Không tìm thấy mục phù hợp.', 'No matching sections.')}</p>
              <button className="mis-button" onClick={() => setSearch('')}>
                {t('Xóa tìm kiếm', 'Clear search')}
              </button>
            </div>
          )}
        </nav>
        <button className="mis-signout" onClick={signOut}>
          <SignOut size={20} aria-hidden="true" />
          {t('Đăng xuất', 'Sign out')}
        </button>
      </aside>
      <main id="mis-main" className="mis-main" tabIndex={-1}>
        <header className="mis-page-heading">
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {task?.title[locale] ??
                navigation.find((item) => item.id === section)?.[locale] ??
                t('Trang không khả dụng', 'Page unavailable')}
            </h1>
            <p>
              {roleNames[role][locale]} · {live.state.user.email}
            </p>
          </div>
          <div className="live-actions">
            <button
              className="mis-button live-refresh"
              disabled={refreshing}
              aria-label={t('Cập nhật dữ liệu', 'Refresh data')}
              title={t('Cập nhật dữ liệu', 'Refresh data')}
              onClick={async () => {
                setRefreshing(true)
                try {
                  await live.refresh()
                } catch {
                  /* Error appears below. */
                } finally {
                  setRefreshing(false)
                }
              }}
            >
              <ArrowClockwise size={18} aria-hidden="true" />
            </button>
            <div className="mis-language" role="group" aria-label={t('Ngôn ngữ', 'Language')}>
              <button aria-pressed={locale === 'vi'} onClick={() => setLocale('vi')}>
                VI
              </button>
              <button aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
                EN
              </button>
            </div>
          </div>
        </header>
        {live.error != null && (
          <p className="mis-error live-sync-error" role="alert">
            {t(
              'Chưa cập nhật được dữ liệu mới nhất. Kiểm tra kết nối rồi nhấn cập nhật.',
              'Could not retrieve the latest data. Check your connection and refresh.',
            )}
          </p>
        )}
        {content}
      </main>
    </div>
  )
}

export function LiveLearningPortalPage() {
  const auth = usePortalSession()
  const locale = initialLocale()
  useEffect(() => {
    if (auth.status === 'signed-out') {
      const hash = window.location.hash
      window.location.replace(
        hash === '#courses' || hash === '#courses/open'
          ? '/login?next=courses'
          : hash === '#schedule/consultations'
            ? '/login?next=review'
            : hash === '#notebook/practice'
              ? '/login?next=practice'
              : '/login',
      )
    }
  }, [auth.status])
  if (auth.status === 'ready' && auth.session)
    return <Portal key={auth.session.user.id} signOut={auth.signOut} />
  return (
    <main className="mis-portal mis-auth-state">
      <section className="mis-panel mis-stack">
        <h1>
          {locale === 'vi' ? 'Đăng nhập vào không gian học tập' : 'Sign in to your learning space'}
        </h1>
        {auth.status === 'loading' || auth.status === 'signed-out' ? (
          <p role="status">
            {locale === 'vi' ? 'Đang kiểm tra phiên đăng nhập…' : 'Checking your session…'}
          </p>
        ) : (
          <>
            <p role="alert">
              {locale === 'vi'
                ? 'Chưa xác thực được tài khoản. Kiểm tra kết nối và thử lại.'
                : 'Could not verify your account. Check your connection and retry.'}
            </p>
            <div className="live-actions">
              <button className="mis-button" onClick={auth.retry}>
                {locale === 'vi' ? 'Thử lại' : 'Retry'}
              </button>
              <a href="/login">{locale === 'vi' ? 'Về đăng nhập' : 'Back to login'}</a>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
