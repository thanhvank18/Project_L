import { useEffect, useRef, useState } from 'react'
import { getInitialLanguage, languageStorageKey, messages } from '@/i18n/messages'
import type { CSSProperties, FormEvent } from 'react'
import { ArrowDown, ArrowUpRight, Asterisk, Check, List, X } from '@phosphor-icons/react'

const themes = [
  { name: 'blue', color: '#2249e8', background: '#e8edff' },
  { name: 'orange', color: '#bd431b', background: '#fff0e8' },
  { name: 'green', color: '#21674d', background: '#e5f3eb' },
]

export function StudioDemoPage() {
  const [language, setLanguage] = useState(getInitialLanguage)
  const t = messages[language]
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = t.pageTitle
    formRef.current
      ?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
      .forEach((field) => field.setCustomValidity(''))
    try {
      localStorage.setItem(languageStorageKey, language)
    } catch {
      // Language switching remains usable when browser storage is unavailable.
    }
  }, [language, t.pageTitle])

  const [menuOpen, setMenuOpen] = useState(false)
  const [themeIndex, setThemeIndex] = useState(0)
  const [sent, setSent] = useState(false)
  const theme = themes[themeIndex] ?? themes[0]!

  function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSent(true)
  }

  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header id="top" className="site-header container">
        <a className="brand" href="#top" aria-label={t.home}>
          <span className="brand-mark" aria-hidden="true">
            L.
          </span>
          <span>
            project l<span className="brand-caption">{t.brandCaption}</span>
          </span>
        </a>
        <div className="language-switch" role="group" aria-label="Ngôn ngữ / Language">
          <button
            type="button"
            lang="vi"
            aria-label="Tiếng Việt"
            aria-pressed={language === 'vi'}
            onClick={() => setLanguage('vi')}
          >
            VI
          </button>
          <button
            type="button"
            lang="en"
            aria-label="English"
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>
        <button
          className="menu-toggle"
          aria-label={menuOpen ? t.closeMenu : t.openMenu}
          aria-expanded={menuOpen}
          aria-controls="navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <List size={24} />}
        </button>
        <nav
          id="navigation"
          className={menuOpen ? 'navigation is-open' : 'navigation'}
          aria-label={t.navigation}
        >
          <a href="/courses">{language === 'vi' ? 'Khóa học' : 'Courses'}</a>
          <a href="#approach" onClick={() => setMenuOpen(false)}>
            {t.approach}
          </a>
          <a href="#preview" onClick={() => setMenuOpen(false)}>
            {t.explore}
          </a>
          <a className="nav-contact" href="#contact" onClick={() => setMenuOpen(false)}>
            {t.start} <ArrowUpRight size={18} />
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-heading">
            <h1 id="hero-title">
              {t.heroFirst}
              <br />
              <span>{t.heroSecond}</span>
            </h1>
            <Asterisk className="hero-symbol" size={138} weight="bold" aria-hidden="true" />
          </div>
          <div className="hero-bottom">
            <p>{t.heroBody}</p>
            <a className="button button-primary" href="#contact">
              {t.heroCta} <ArrowUpRight size={22} />
            </a>
            <a className="scroll-link" href="#preview">
              {t.previewCta} <ArrowDown size={18} />
            </a>
          </div>
        </section>

        <section className="showcase container" id="preview" aria-labelledby="preview-title">
          <div className="showcase-top">
            <h2 id="preview-title">{t.previewTitle}</h2>
            <span>{t.interactive}</span>
          </div>
          <div
            className="preview-stage"
            style={
              {
                '--preview-color': theme.color,
                '--preview-background': theme.background,
              } as CSSProperties
            }
          >
            <div className="preview-note">
              <span>
                {t.noteFirst}
                <br />
                {t.noteSecond}
              </span>
              <p>
                {t.chooseColor}
                <br />
                {t.watchColor}
              </p>
            </div>
            <div className="browser-frame" aria-label={`${t.previewLabel} ${t.colors[themeIndex]}`}>
              <div className="browser-toolbar">
                <span className="browser-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>your-next-idea.studio</span>
                <ArrowUpRight size={14} />
              </div>
              <div className="mini-site" lang={language}>
                <div className="mini-nav">
                  <strong>form & feeling</strong>
                  <span>{t.miniTagline}</span>
                </div>
                <div className="mini-content">
                  <div>
                    <h3>
                      {t.miniFirst}
                      <br />
                      {t.miniSecond}
                    </h3>
                    <p>{t.miniBody}</p>
                    <span className="mini-cta">
                      {t.miniCta} <ArrowUpRight size={16} />
                    </span>
                  </div>
                  <div className="sculpture" aria-hidden="true">
                    <div className="sculpture-top" />
                    <div className="sculpture-bottom" />
                    <span className="sculpture-shadow" />
                  </div>
                </div>
                <div className="mini-footer">
                  <span>{t.miniFooterFirst}</span>
                  <span>{t.miniFooterSecond}</span>
                </div>
              </div>
            </div>
            <div className="theme-picker" role="group" aria-label={t.colorGroup}>
              {themes.map((item, index) => (
                <button
                  key={item.name}
                  aria-label={`${t.colorLabel} ${t.colors[index]}`}
                  aria-pressed={themeIndex === index}
                  onClick={() => setThemeIndex(index)}
                  style={{ background: item.color }}
                >
                  {themeIndex === index && <Check size={16} weight="bold" />}
                </button>
              ))}
            </div>
          </div>
          <div className="showcase-caption">
            <span>{t.concept}</span>
            <span>{t.caption}</span>
          </div>
        </section>

        <section className="approach container" id="approach" aria-labelledby="approach-title">
          <div className="approach-intro">
            <h2 id="approach-title">
              {t.approachFirst}
              <br />
              {t.approachSecond}
            </h2>
            <p>{t.approachBody}</p>
          </div>
          <div className="approach-list">
            {t.principles.map((principle, index) => (
              <article key={index}>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="contact-section" id="contact" aria-labelledby="contact-title">
          <div className="contact-layout container">
            <div>
              <h2 id="contact-title">
                {t.contactFirst}
                <br />
                {t.contactSecond}
              </h2>
              <p>{t.contactBody}</p>
              <span className="demo-note">{t.disclaimer}</span>
            </div>
            <form ref={formRef} onSubmit={submitDemo} className="contact-form">
              <label htmlFor="name">{t.name}</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder={t.namePlaceholder}
                required
                onInvalid={(event) =>
                  event.currentTarget.setCustomValidity(
                    event.currentTarget.validity.valueMissing ? t.required : '',
                  )
                }
                onInput={(event) => event.currentTarget.setCustomValidity('')}
                maxLength={100}
                onChange={() => setSent(false)}
              />
              <label htmlFor="idea">{t.idea}</label>
              <textarea
                id="idea"
                name="idea"
                placeholder={t.ideaPlaceholder}
                required
                onInvalid={(event) =>
                  event.currentTarget.setCustomValidity(
                    event.currentTarget.validity.valueMissing ? t.required : '',
                  )
                }
                onInput={(event) => event.currentTarget.setCustomValidity('')}
                maxLength={2000}
                rows={3}
                onChange={() => setSent(false)}
              />
              <button className="button button-light" type="submit">
                {t.submit} <ArrowUpRight size={20} />
              </button>
              <p className="form-status" role="status">
                {sent ? t.success : ''}
              </p>
            </form>
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <a className="footer-brand" href="#top">
          project l.
        </a>
        <span>{t.footer}</span>
        <a href="#main">
          {t.backToTop} <ArrowUpRight size={16} />
        </a>
      </footer>
    </>
  )
}
