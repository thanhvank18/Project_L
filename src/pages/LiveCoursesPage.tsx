import { useEffect, useState } from 'react'
import { ArrowUpRight, Globe, MagnifyingGlass, SignIn, X } from '@phosphor-icons/react'
import { getInitialLanguage, languageStorageKey } from '@/i18n/messages'
import { eliteMessages } from '@/i18n/elite'
import { getPortalLoginUrl } from '@/config/portal'
import type { PublicCourse } from '../../shared/portal'
import '@/styles/elite.css'
import '@/styles/live-courses.css'

function isCourse(value: unknown): value is PublicCourse {
  if (!value || typeof value !== 'object') return false
  return (
    'enrollmentOpen' in value &&
    typeof value.enrollmentOpen === 'boolean' &&
    ['id', 'title', 'level', 'description'].every(
      (key) => key in value && typeof (value as Record<string, unknown>)[key] === 'string',
    )
  )
}

export default function LiveCoursesPage() {
  const [locale, setLocale] = useState(getInitialLanguage)
  const [courses, setCourses] = useState<PublicCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const vi = locale === 'vi'
  const tx = (vietnamese: string, english: string) => (vi ? vietnamese : english)
  const page = eliteMessages[locale].Page
  const login = getPortalLoginUrl()
  const home = `/${locale}`
  useEffect(() => {
    document.documentElement.lang = locale
    document.title =
      locale === 'vi' ? 'Khóa học | Elite Pathway Education' : 'Courses | Elite Pathway Education'
    try {
      localStorage.setItem(languageStorageKey, locale)
    } catch {
      /* Keep the language in memory when storage is unavailable. */
    }
  }, [locale])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/v1/public/courses', {
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new Error('catalog-unavailable')
        const data: unknown = await response.json()
        if (!Array.isArray(data) || !data.every(isCourse)) throw new Error('catalog-invalid')
        if (!controller.signal.aborted) {
          setCourses(data)
          setError(false)
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])
  const levels = [...new Set(courses.map((course) => course.level).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, locale),
  )
  const search = query.trim().toLocaleLowerCase(locale)
  const visible = courses.filter(
    (course) =>
      (!level || course.level === level) &&
      `${course.title} ${course.level} ${course.description}`
        .toLocaleLowerCase(locale)
        .includes(search),
  )
  return (
    <div className="elite-page live-catalog-page">
      <a className="elite-skip" href="#catalog-main">
        {tx('Đến nội dung chính', 'Skip to content')}
      </a>
      <header className="elite-header">
        <div className="elite-container elite-header-inner">
          <a
            className="elite-logo"
            href={home}
            aria-label={tx('Trang chủ Elite Pathway Education', 'Elite Pathway Education home')}
          >
            <img
              src="/elite-reference/logo.svg"
              alt="Elite Pathway Education"
              width="84"
              height="84"
            />
          </a>
          <nav
            className="live-catalog-navigation"
            aria-label={tx('Điều hướng chính', 'Main navigation')}
          >
            <a href={home}>{tx('Trang chủ', 'Home')}</a>
            <a href="/courses" aria-current="page">
              {tx('Khóa học', 'Courses')}
            </a>
            <a href={`${home}#contact`}>{tx('Liên hệ', 'Contact')}</a>
          </nav>
          <div className="elite-header-actions">
            <button
              className="elite-locale"
              type="button"
              aria-label={tx('Switch to English', 'Chuyển sang tiếng Việt')}
              onClick={() => setLocale(vi ? 'en' : 'vi')}
            >
              <Globe size={16} aria-hidden="true" />
              <span className="elite-locale-long">{tx('English', 'Tiếng Việt')}</span>
              <span className="elite-locale-short">{tx('EN', 'VI')}</span>
            </button>
            <a className="elite-login" href={login}>
              <SignIn size={18} aria-hidden="true" />
              <span>{tx('Đăng nhập', 'Log in')}</span>
            </a>
          </div>
        </div>
      </header>
      <main className="elite-container live-catalog-main" id="catalog-main">
        <div className="live-catalog-intro">
          <div>
            <h1>{tx('Khóa học', 'Courses')}</h1>
            <p>
              {tx(
                'Tìm lớp học theo tên, trình độ hoặc nội dung học.',
                'Find a class by name, level or learning content.',
              )}
            </p>
          </div>
          <a className="elite-button elite-button-outline" href={login}>
            {tx('Vào cổng học tập', 'Open learning portal')}
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="live-catalog-toolbar">
          <label className="live-catalog-search">
            <span className="live-catalog-sr-only">
              {tx('Tìm kiếm khóa học', 'Search courses')}
            </span>
            <MagnifyingGlass size={20} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tx(
                'Tìm tên lớp, trình độ hoặc nội dung…',
                'Search names, levels or content…',
              )}
              disabled={loading || error}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={tx('Xóa tìm kiếm', 'Clear search')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </label>
          <label className="live-catalog-filter">
            {tx('Trình độ', 'Level')}
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              disabled={loading || error}
            >
              <option value="">{tx('Tất cả trình độ', 'All levels')}</option>
              {levels.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <div className="live-catalog-loading" role="status">
            <p>{tx('Đang tải danh sách lớp…', 'Loading classes…')}</p>
            <div aria-hidden="true" className="live-catalog-skeleton" />
            <div aria-hidden="true" className="live-catalog-skeleton" />
          </div>
        ) : error ? (
          <div className="live-catalog-empty" role="alert">
            <h2>{tx('Chưa tải được danh sách khóa học', 'Could not load courses')}</h2>
            <p>
              {tx(
                'Kiểm tra kết nối rồi thử tải lại danh sách.',
                'Check your connection and try loading the list again.',
              )}
            </p>
            <button
              type="button"
              className="elite-button"
              onClick={() => {
                setLoading(true)
                setError(false)
                setAttempt((value) => value + 1)
              }}
            >
              {tx('Thử lại', 'Try again')}
            </button>
          </div>
        ) : (
          <>
            <p className="live-catalog-count" role="status">
              {visible.length} {tx('lớp học', visible.length === 1 ? 'class' : 'classes')}
            </p>
            {visible.length ? (
              <div className="live-catalog-results">
                {visible.map((course) => (
                  <article className="live-catalog-course" key={course.id}>
                    <div>
                      <h2>{course.title}</h2>
                      {course.description && <p>{course.description}</p>}
                    </div>
                    <div className="live-catalog-course-actions">
                      {course.level && <span className="live-catalog-level">{course.level}</span>}
                      {course.enrollmentOpen ? (
                        <a className="elite-button elite-button-outline" href="/learn#courses/open">
                          {tx('Đăng ký lớp', 'Request enrollment')}
                          <ArrowUpRight size={18} aria-hidden="true" />
                        </a>
                      ) : (
                        <span>{tx('Chưa mở đăng ký', 'Enrollment closed')}</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="live-catalog-empty">
                <h2>
                  {query || level
                    ? tx('Không tìm thấy lớp phù hợp', 'No matching classes')
                    : tx('Chưa có lớp học được công bố', 'No published classes yet')}
                </h2>
                <p>
                  {query || level
                    ? tx(
                        'Thử từ khóa khác hoặc bỏ bộ lọc để xem thêm kết quả.',
                        'Try another search or clear the filters to see more results.',
                      )
                    : tx(
                        'Danh sách sẽ xuất hiện khi nhà trường công bố lớp học. Bạn đã ghi danh? Đăng nhập để vào lớp của mình.',
                        'Classes will appear when they are published. Already enrolled? Sign in to access your classes.',
                      )}
                </p>
                {query || level ? (
                  <button
                    type="button"
                    className="elite-button elite-button-outline"
                    onClick={() => {
                      setQuery('')
                      setLevel('')
                    }}
                  >
                    {tx('Xóa bộ lọc', 'Clear filters')}
                  </button>
                ) : (
                  <a href={login} className="elite-button">
                    {tx('Đăng nhập', 'Log in')}
                    <SignIn size={18} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="elite-footer elite-container">
        <a href={home} className="elite-footer-brand">
          Elite Pathway<span>{page.FooterBrandSuffix}</span>
        </a>
        <div>
          <p>
            © {new Date().getFullYear()} Elite Pathway Education. {page.FooterRights}
          </p>
          <p>{page.FooterTagline}</p>
        </div>
        <a className="elite-footer-login" href={login}>
          {tx('Đăng nhập học viên', 'Student login')}
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </footer>
    </div>
  )
}
