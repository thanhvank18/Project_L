import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Certificate,
  CheckCircle,
  ChatCircleDots,
  Clock,
  EnvelopeSimple,
  FacebookLogo,
  Globe,
  GraduationCap,
  List,
  PaperPlaneTilt,
  Phone,
  Quotes,
  SignIn,
  Sparkle,
  Star,
  X,
} from '@phosphor-icons/react'
import { eliteMessages, type EliteCourseKey } from '@/i18n/elite'
import { getInitialLanguage, languageStorageKey } from '@/i18n/messages'
import type { Language } from '@/i18n/messages'
import { getPortalLoginUrl } from '@/config/portal'
import '@/styles/elite.css'

const paths: Array<{ key: EliteCourseKey; band: string }> = [
  { key: 'Foundation', band: '0 - 4.0' },
  { key: 'Transition', band: '4.0 - 5.0' },
  { key: 'CoreDevelopment', band: '5.0 - 6.5' },
  { key: 'Mastery', band: '6.5+' },
  { key: 'Intensive', band: '7.0 - 9.0' },
]
const photos = [
  {
    file: 'classroom-teaching.jpg',
    vi: 'Liz giảng dạy trong lớp học',
    en: 'Liz teaching in the classroom',
  },
  { file: 'classroom-interaction.jpg', vi: 'Tương tác trong lớp học', en: 'Classroom interaction' },
  { file: 'online-lecture.jpg', vi: 'Bài giảng trực tuyến', en: 'An online lecture' },
  { file: 'academic-workshop.jpeg', vi: 'Buổi học chuyên đề', en: 'An academic workshop' },
  { file: 'academic-success.jpeg', vi: 'Hành trình học thuật', en: 'Academic achievement' },
  { file: 'student-progress.jpeg', vi: 'Tiến bộ của học viên', en: 'Student progress' },
  { file: 'student-guidance.jpeg', vi: 'Đồng hành cùng học viên', en: 'Student guidance' },
]
const facebook = 'https://www.facebook.com/profile.php?id=100015290293334'
const messenger = 'https://m.me/100015290293334'
const email = 'liz@elitepathwayeducation.com'

function initialLocale(): Language {
  const path = window.location.pathname.replace(/\/$/, '')
  return path === '/en' ? 'en' : path === '/vi' ? 'vi' : getInitialLanguage()
}

export function EliteLandingPage() {
  const [locale, setLocale] = useState(initialLocale)
  const [menuOpen, setMenuOpen] = useState(false)
  const [course, setCourse] = useState<EliteCourseKey>('CoreDevelopment')
  const [draft, setDraft] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const gallery = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const t = eliteMessages[locale]
  const isVi = locale === 'vi'
  const detail = t.Courses.Details[course]
  const login = getPortalLoginUrl()
  const nav = [
    ['home', t.Navbar.Home],
    ['about', t.Navbar.About],
    ['courses', t.Navbar.Courses],
    ['testimonials', t.Navbar.Testimonials],
    ['contact', t.Navbar.Contact],
  ]

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = isVi
      ? 'Elite Pathway Education | Luyện thi IELTS & tiếng Anh học thuật'
      : 'Elite Pathway Education | IELTS & Academic English'
    try {
      localStorage.setItem(languageStorageKey, locale)
    } catch {
      /* In-memory locale still works. */
    }
    const path = window.location.pathname.replace(/\/$/, '')
    if (path === '/vi' || path === '/en')
      window.history.replaceState(null, '', `/${locale}${window.location.hash}`)
    form.current
      ?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
      .forEach((field) => field.setCustomValidity(''))
  }, [locale, isVi])

  useEffect(() => {
    if (!menuOpen) return
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  useEffect(() => {
    const selected = tabs.current[paths.findIndex((path) => path.key === course)]
    const strip = selected?.parentElement
    if (!selected || !strip) return

    function revealSelectedTab() {
      if (!selected || !strip || strip.scrollWidth <= strip.clientWidth) return
      const tabRect = selected.getBoundingClientRect()
      const stripRect = strip.getBoundingClientRect()
      if (tabRect.left >= stripRect.left && tabRect.right <= stripRect.right) return
      strip.scrollTo({
        left:
          strip.scrollLeft +
          tabRect.left -
          stripRect.left -
          (strip.clientWidth - tabRect.width) / 2,
        behavior: 'instant',
      })
    }

    revealSelectedTab()
    const observer = new ResizeObserver(revealSelectedTab)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [course])

  function onCourseKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % paths.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + paths.length) % paths.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = paths.length - 1
    else return
    event.preventDefault()
    setCourse(paths[next]!.key)
    tabs.current[next]?.focus()
  }

  function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const selected = String(values.get('course')) as keyof typeof t.Contact.Form.CourseOptions
    const body = [
      `${t.Contact.Email.Name}: ${String(values.get('name')).trim()}`,
      `${t.Contact.Form.EmailAddress}: ${String(values.get('email')).trim()}`,
      `${t.Contact.Email.InterestedCourse}: ${t.Contact.Form.CourseOptions[selected] ?? t.Contact.Email.NotSpecified}`,
      '',
      `${t.Contact.Email.Message}:`,
      String(values.get('message')).trim(),
    ].join('\n')
    setDraft(
      `mailto:${email}?subject=${encodeURIComponent(isVi ? 'Tư vấn khóa học Elite Pathway' : 'Elite Pathway course enquiry')}&body=${encodeURIComponent(body)}`,
    )
  }

  function scrollGallery(direction: number) {
    gallery.current?.scrollBy({
      left: direction * 380,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }

  return (
    <div className="elite-page">
      <a className="elite-skip" href="#main">
        {isVi ? 'Đến nội dung chính' : 'Skip to content'}
      </a>
      <header className="elite-header">
        <div className="elite-container elite-header-inner">
          <a
            className="elite-logo"
            href="#home"
            aria-label="Elite Pathway Education home"
            onClick={() => setMenuOpen(false)}
          >
            <img
              src="/elite-reference/logo.svg"
              alt="Elite Pathway Education"
              width="84"
              height="84"
            />
          </a>
          <nav
            id="elite-navigation"
            className={`elite-navigation${menuOpen ? ' is-open' : ''}`}
            aria-label={isVi ? 'Điều hướng chính' : 'Main navigation'}
          >
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="elite-header-actions">
            <button
              className="elite-locale"
              type="button"
              onClick={() => {
                setLocale(isVi ? 'en' : 'vi')
                setDraft('')
              }}
              aria-label={isVi ? 'Switch to English' : 'Chuyển sang tiếng Việt'}
            >
              <Globe size={16} aria-hidden="true" />
              <span className="elite-locale-long">{isVi ? 'English' : 'Tiếng Việt'}</span>
              <span className="elite-locale-short">{isVi ? 'EN' : 'VI'}</span>
            </button>
            <a className="elite-login" href={login}>
              <SignIn size={18} aria-hidden="true" />
              <span>{isVi ? 'Đăng nhập' : 'Log in'}</span>
            </a>
            <a className="elite-button elite-header-cta" href="#contact">
              {t.Navbar.BookTest}
            </a>
            <button
              ref={menuButton}
              className="elite-menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="elite-navigation"
              aria-label={
                menuOpen ? (isVi ? 'Đóng menu' : 'Close menu') : isVi ? 'Mở menu' : 'Open menu'
              }
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={23} /> : <List size={23} />}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        <section
          className="elite-hero elite-container"
          id="home"
          aria-labelledby="elite-hero-title"
        >
          <div className="elite-hero-copy">
            <span className="elite-hero-label">
              <Sparkle size={16} aria-hidden="true" />
              {t.Hero.Eyebrow}
            </span>
            <h1 id="elite-hero-title">
              {t.Hero.Headline.replace('Elite Pathway Education.', '').trim()}{' '}
              <em>Elite Pathway Education.</em>
            </h1>
            <p className="elite-hero-description">{t.Hero.Subheadline}</p>
            <div className="elite-hero-actions">
              <a href="#contact" className="elite-button">
                {t.Hero.CTAs.BookMockTest}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="#courses" className="elite-button elite-button-outline">
                {t.Hero.CTAs.ViewCourses}
                <BookOpen size={19} aria-hidden="true" />
              </a>
            </div>
            <a href={facebook} className="elite-facebook" target="_blank" rel="noreferrer">
              <FacebookLogo size={19} aria-hidden="true" />
              {t.Hero.CTAs.FollowFacebook}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <ul className="elite-credentials">
              {Object.values(t.Hero.Badges).map((badge, index) => (
                <li key={badge}>
                  {index === 0 ? (
                    <Star size={17} aria-hidden="true" />
                  ) : index === 1 ? (
                    <GraduationCap size={17} aria-hidden="true" />
                  ) : (
                    <Certificate size={17} aria-hidden="true" />
                  )}
                  <span>{badge}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="elite-portrait-wrap">
            <div className="elite-portrait">
              <img
                src="/elite-reference/liz-portrait.jpeg"
                alt={
                  isVi
                    ? 'Liz, nhà sáng lập Elite Pathway Education'
                    : 'Liz, founder of Elite Pathway Education'
                }
                width="800"
                height="800"
                fetchPriority="high"
              />
            </div>
            <div className="elite-photo-note">
              <Sparkle size={28} aria-hidden="true" />
              <span>{t.Hero.ImageBadge}</span>
            </div>
          </div>
        </section>

        <section
          id="about"
          className="elite-section elite-about"
          aria-labelledby="elite-about-title"
        >
          <div className="elite-container elite-about-grid">
            <div className="elite-teaching-wrap">
              <img
                className="elite-teaching-photo"
                src="/elite-reference/classroom-teaching.jpg"
                width="1200"
                height="900"
                loading="lazy"
                alt={photos[0]![locale]}
              />
              <blockquote>
                <Quotes size={26} aria-hidden="true" />
                <p>{t.About.Quote}</p>
              </blockquote>
              <span className="elite-method-label">{t.About.MethodologyLabel}</span>
            </div>
            <div className="elite-about-copy">
              <p className="elite-section-label">{t.About.SectionTitle}</p>
              <h2 id="elite-about-title">
                {t.About.Headline.split('. ')[0]}.{' '}
                <em>{t.About.Headline.split('. ').slice(1).join('. ')}</em>
              </h2>
              <p className="elite-body">{t.About.Body}</p>
              <ul className="elite-about-credentials">
                {Object.values(t.About.Credentials).map((item) => (
                  <li key={item}>
                    <CheckCircle size={21} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <dl className="elite-stats">
                {[
                  [t.About.StatsValues.TeachingExperience, t.About.StatsLabels.TeachingExperience],
                  [t.About.StatsValues.IELTSScore, t.About.StatsLabels.IELTSScore],
                  ['500+', t.About.StatsLabels.StudentsGuided],
                  ['98%', t.About.StatsLabels.SuccessRate],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="courses" className="elite-section" aria-labelledby="elite-courses-title">
          <div className="elite-container">
            <div className="elite-section-heading">
              <p className="elite-section-label">{t.Courses.SectionTitle}</p>
              <h2 id="elite-courses-title">
                {isVi ? (
                  <>
                    Lộ trình <em>IELTS học thuật</em>
                  </>
                ) : (
                  <>
                    Academic <em>IELTS pathways</em>
                  </>
                )}
              </h2>
            </div>
            <div className="elite-course-tabs" role="tablist" aria-label={t.Courses.Headline}>
              {paths.map(({ key, band }, index) => (
                <button
                  ref={(element) => {
                    tabs.current[index] = element
                  }}
                  id={`course-tab-${key}`}
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={course === key}
                  aria-controls="elite-course-panel"
                  tabIndex={course === key ? 0 : -1}
                  onClick={() => setCourse(key)}
                  onKeyDown={(event) => onCourseKey(event, index)}
                >
                  <span>Band {band}</span>
                  <strong>{t.Courses.CourseNames[key]}</strong>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div
              id="elite-course-panel"
              className="elite-course-panel"
              role="tabpanel"
              aria-labelledby={`course-tab-${course}`}
              tabIndex={0}
            >
              <div className="elite-course-summary">
                <div>
                  <h3>{t.Courses.CourseNames[course]}</h3>
                  <p>{detail.Slogan}</p>
                </div>
                <div className="elite-duration">
                  <Clock size={23} aria-hidden="true" />
                  <div>
                    <span>{t.Courses.DurationLabel}</span>
                    <strong>{detail.Duration}</strong>
                  </div>
                </div>
              </div>
              <ol className="elite-phases">
                {detail.Phases.map((phase, index) => (
                  <li key={phase}>
                    <span className="elite-phase-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <h4>{Object.values(t.Courses.PhaseLabels)[index]}</h4>
                    <p>{phase}</p>
                  </li>
                ))}
              </ol>
              <div className="elite-ai">
                <Sparkle size={25} aria-hidden="true" />
                <div>
                  <h4>{t.Courses.AISection}</h4>
                  <p>{detail.AI}</p>
                </div>
              </div>
            </div>
            <div className="elite-catalog-link">
              <a href="/courses">
                {isVi ? 'Khám phá danh mục khóa học' : 'Explore the course catalog'}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          id="gallery"
          className="elite-section elite-gallery"
          aria-labelledby="elite-gallery-title"
        >
          <div className="elite-container">
            <div className="elite-gallery-header">
              <div>
                <p className="elite-section-label">{t.Gallery.SectionTitle}</p>
                <h2 id="elite-gallery-title">
                  {t.Gallery.Headline} <em>{t.Gallery.HeadlineAccent}</em>
                </h2>
              </div>
              <div className="elite-gallery-controls">
                <button
                  type="button"
                  onClick={() => scrollGallery(-1)}
                  aria-label={isVi ? 'Ảnh trước' : 'Previous photos'}
                >
                  <ArrowLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollGallery(1)}
                  aria-label={isVi ? 'Ảnh tiếp theo' : 'Next photos'}
                >
                  <ArrowRight size={22} />
                </button>
              </div>
            </div>
            <div
              className="elite-gallery-strip"
              ref={gallery}
              role="region"
              aria-label={t.Gallery.SectionTitle}
            >
              {photos.map((photo) => (
                <figure key={photo.file}>
                  <img
                    src={`/elite-reference/${photo.file}`}
                    alt={photo[locale]}
                    width="750"
                    height="550"
                    loading="lazy"
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section
          id="testimonials"
          className="elite-section elite-testimonials"
          aria-labelledby="elite-testimonials-title"
        >
          <div className="elite-container">
            <div className="elite-section-heading">
              <p className="elite-section-label">{t.Testimonials.SectionTitle}</p>
              <h2 id="elite-testimonials-title">
                {isVi ? (
                  <>
                    Học viên <em>chia sẻ</em>
                  </>
                ) : (
                  <>
                    What our <em>students say</em>
                  </>
                )}
              </h2>
            </div>
            <div className="elite-student-quotes">
              {t.StudentFeedback.map((item) => (
                <figure key={item.author}>
                  <div
                    className="elite-stars"
                    aria-label={isVi ? '5 sao, theo trang mẫu' : '5 stars, from the reference'}
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} size={18} weight="fill" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote>
                    <p>“{item.content}”</p>
                  </blockquote>
                  <figcaption>
                    <strong>{item.author}</strong>
                    <span>{item.result}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="elite-manager-quotes">
              {t.ManagerFeedback.map((item) => (
                <figure key={item.organization}>
                  <Quotes size={32} aria-hidden="true" />
                  <blockquote>
                    <p>“{item.content}”</p>
                  </blockquote>
                  <figcaption>
                    <strong>{item.author}</strong>
                    <span>{item.organization}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="elite-testimonial-summary">“{t.Testimonials.Summary}”</p>
          </div>
        </section>

        <section
          id="contact"
          className="elite-section elite-contact"
          aria-labelledby="elite-contact-title"
        >
          <div className="elite-container elite-contact-panel">
            <div className="elite-contact-info">
              <h2 id="elite-contact-title">
                {isVi ? (
                  <>
                    Bắt đầu lộ trình <em>IELTS của bạn</em>
                  </>
                ) : (
                  <>
                    Start your <em>IELTS journey</em>
                  </>
                )}
              </h2>
              <p>{t.Contact.Intro}</p>
              <ul>
                <li>
                  <EnvelopeSimple size={23} aria-hidden="true" />
                  <div>
                    <span>{t.Contact.Info.EmailMe}</span>
                    <a href={`mailto:${email}`}>{email}</a>
                  </div>
                </li>
                <li>
                  <Phone size={23} aria-hidden="true" />
                  <div>
                    <span>{t.Contact.Info.CallMessenger}</span>
                    <a href="tel:+447543159881">+44 7543159881</a>
                  </div>
                </li>
                <li>
                  <Clock size={23} aria-hidden="true" />
                  <div>
                    <span>{t.Contact.Info.TeachingHours}</span>
                    <strong>09:00 - 15:00 &amp; 19:00 - 22:00</strong>
                  </div>
                </li>
              </ul>
              <div className="elite-contact-social">
                <a href={facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                  <FacebookLogo size={22} />
                </a>
                <a
                  href={messenger}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t.Contact.Info.Messenger}
                >
                  <ChatCircleDots size={22} />
                </a>
              </div>
            </div>
            <form
              ref={form}
              className="elite-contact-form"
              onSubmit={createDraft}
              onInput={() => setDraft('')}
            >
              <div className="elite-form-row">
                <label>
                  {t.Contact.Form.YourName}
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder={t.Contact.Form.Placeholders.Name}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  {t.Contact.Form.EmailAddress}
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t.Contact.Form.Placeholders.Email}
                    required
                    maxLength={254}
                  />
                </label>
              </div>
              <label>
                {t.Contact.Form.InterestedCourse}
                <select name="course" defaultValue="">
                  <option value="" disabled>
                    {t.Contact.Form.CourseOptions.Select}
                  </option>
                  {Object.entries(t.Contact.Form.CourseOptions)
                    .filter(([key]) => key !== 'Select')
                    .map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t.Contact.Form.YourMessage}
                <textarea
                  name="message"
                  placeholder={t.Contact.Form.Placeholders.Message}
                  rows={4}
                  required
                  maxLength={2000}
                />
              </label>
              <button className="elite-button elite-submit" type="submit">
                {isVi ? 'Soạn tin nhắn' : 'Compose message'}
                <PaperPlaneTilt size={21} aria-hidden="true" />
              </button>
              <p className="elite-form-note">
                {isVi
                  ? 'Biểu mẫu tạo bản nháp email. Bạn kiểm tra và tự gửi trong ứng dụng email của mình.'
                  : 'This form prepares an email draft. Review and send it from your email app.'}
              </p>
              <div className="elite-form-result" role="status">
                {draft && (
                  <>
                    <p>{t.Contact.Status.Ready}</p>
                    <a href={draft}>
                      {isVi ? 'Mở bản nháp email' : 'Open email draft'}
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
            </form>
          </div>
        </section>
      </main>
      <footer className="elite-footer elite-container">
        <a href="#home" className="elite-footer-brand">
          Elite Pathway<span>{t.Page.FooterBrandSuffix}</span>
        </a>
        <div>
          <p>
            © {new Date().getFullYear()} Elite Pathway Education. {t.Page.FooterRights}
          </p>
          <p>{t.Page.FooterTagline}</p>
        </div>
        <a className="elite-footer-login" href={login}>
          {isVi ? 'Đăng nhập học viên' : 'Student login'}
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </footer>
      <a
        className="elite-messenger"
        href={messenger}
        target="_blank"
        rel="noreferrer"
        aria-label={t.Page.MessengerLabel}
      >
        <ChatCircleDots size={30} weight="fill" />
      </a>
    </div>
  )
}
