import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BookmarkSimple,
  BookOpen,
  CaretDown,
  MagnifyingGlass,
  Translate,
  X,
} from '@phosphor-icons/react'
import { getInitialLanguage, languageStorageKey } from '@/i18n/messages'
import { courseMessages } from '@/i18n/courses'
import { courses, type CourseLanguage, type CourseLevel } from '@/features/courses/data'
import {
  readSavedCourses,
  savedCoursesKey,
  selectCourses,
  type SortOrder,
} from '@/features/courses/catalog'
import { CourseCard } from '@/features/courses/CourseCard'
import '@/styles/courses.css'

const languages: Array<CourseLanguage | 'all'> = ['all', 'english', 'japanese', 'korean', 'chinese']
const languageSymbols = { all: '', english: 'En', japanese: 'あ', korean: '한', chinese: '中' }

export function CoursesPage() {
  const [locale, setLocale] = useState(getInitialLanguage)
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<CourseLanguage | 'all'>('all')
  const [level, setLevel] = useState<CourseLevel | 'all'>('all')
  const [sort, setSort] = useState<SortOrder>('recommended')
  const [savedOnly, setSavedOnly] = useState(false)
  const [savedIds, setSavedIds] = useState(readSavedCourses)
  const [announcement, setAnnouncement] = useState<{ id: string; saved: boolean } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const t = courseMessages[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t.pageTitle
    try {
      localStorage.setItem(languageStorageKey, locale)
    } catch {
      /* Locale remains available in memory. */
    }
  }, [locale, t.pageTitle])

  useEffect(() => {
    try {
      localStorage.setItem(savedCoursesKey, JSON.stringify(savedIds))
    } catch {
      /* Bookmarks remain available in memory. */
    }
  }, [savedIds])

  const visibleCourses = selectCourses({
    query,
    language,
    level,
    sort,
    locale,
    savedOnly,
    savedIds,
  })
  const hasFilters = query.trim() !== '' || language !== 'all' || level !== 'all'
  const emptySaved = savedOnly && savedIds.length === 0

  function resetFilters() {
    setQuery('')
    setLanguage('all')
    setLevel('all')
  }

  function changeView(onlySaved: boolean) {
    setSavedOnly(onlySaved)
    resetFilters()
  }

  function toggleSave(id: string) {
    const saved = !savedIds.includes(id)
    setSavedIds((previous) =>
      saved ? [...previous, id] : previous.filter((value) => value !== id),
    )
    setAnnouncement({ id, saved })
  }

  return (
    <div className="courses-page" id="top">
      <a className="skip-link" href="#course-main">
        {t.skip}
      </a>
      <header className="catalog-header">
        <div className="catalog-container catalog-header-inner">
          <a className="brand catalog-brand" href="/" aria-label={t.home}>
            <span className="brand-mark" aria-hidden="true">
              L.
            </span>
            <span>
              project l<span className="brand-caption">{t.brandCaption}</span>
            </span>
          </a>
          <div className="catalog-view-switch" role="group" aria-label={t.catalog}>
            <button type="button" aria-pressed={!savedOnly} onClick={() => changeView(false)}>
              <BookOpen size={19} aria-hidden="true" />
              {t.catalog}
            </button>
            <button type="button" aria-pressed={savedOnly} onClick={() => changeView(true)}>
              <BookmarkSimple size={19} aria-hidden="true" />
              {t.saved}
              <span className="saved-count">{savedIds.length}</span>
            </button>
          </div>
          <div
            className="language-switch catalog-locale"
            role="group"
            aria-label="Ngôn ngữ / Language"
          >
            <button
              type="button"
              lang="vi"
              aria-label="Tiếng Việt"
              aria-pressed={locale === 'vi'}
              onClick={() => setLocale('vi')}
            >
              VI
            </button>
            <button
              type="button"
              lang="en"
              aria-label="English"
              aria-pressed={locale === 'en'}
              onClick={() => setLocale('en')}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main className="catalog-container" id="course-main">
        <div className="catalog-intro">
          <div>
            <h1>{savedOnly ? t.savedTitle : t.title}</h1>
            <p>{savedOnly ? t.savedSubtitle : t.subtitle}</p>
          </div>
          <span className="catalog-demo">{t.demo}</span>
        </div>

        <div className="catalog-toolbar">
          <div className="catalog-search">
            <MagnifyingGlass size={21} aria-hidden="true" />
            <label className="sr-only" htmlFor="course-search">
              {t.search}
            </label>
            <input
              ref={searchRef}
              id="course-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
            {query && (
              <button
                type="button"
                aria-label={t.clearSearch}
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="catalog-level-filter">
            <label htmlFor="course-level">{t.level}</label>
            <select
              id="course-level"
              value={level}
              onChange={(event) => setLevel(event.target.value as CourseLevel | 'all')}
            >
              <option value="all">{t.allLevels}</option>
              <option value="beginner">{t.beginner}</option>
              <option value="intermediate">{t.intermediate}</option>
            </select>
            <CaretDown size={15} aria-hidden="true" />
          </div>
        </div>

        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label={t.languages}>
            <h2>{t.languages}</h2>
            <div className="catalog-language-list" role="group" aria-label={t.languages}>
              {languages.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={language === item}
                  onClick={() => setLanguage(item)}
                >
                  <span className="language-symbol" aria-hidden="true">
                    {item === 'all' ? <Translate size={18} /> : languageSymbols[item]}
                  </span>
                  <span>{item === 'all' ? t.allLanguages : t[item]}</span>
                  <span className="language-count">
                    {
                      courses.filter(
                        (course) =>
                          (item === 'all' || course.language === item) &&
                          (!savedOnly || savedIds.includes(course.id)),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="catalog-results" aria-label={savedOnly ? t.saved : t.catalog}>
            <div className="catalog-results-bar">
              <div className="catalog-result-count" role="status">
                <strong>{visibleCourses.length}</strong>{' '}
                {visibleCourses.length === 1 ? t.resultSingular : t.results}
              </div>
              {hasFilters && (
                <button className="catalog-reset" type="button" onClick={resetFilters}>
                  {t.resetFilters}
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              <div className="catalog-sort">
                <label htmlFor="course-sort">{t.sort}</label>
                <select
                  id="course-sort"
                  aria-label={t.sort}
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOrder)}
                >
                  <option value="recommended">{t.recommended}</option>
                  <option value="shortest">{t.shortest}</option>
                  <option value="alphabetical">{t.alphabetical}</option>
                </select>
                <CaretDown size={14} aria-hidden="true" />
              </div>
            </div>
            {visibleCourses.length > 0 ? (
              <div className="course-grid">
                {visibleCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    locale={locale}
                    saved={savedIds.includes(course.id)}
                    onSave={() => toggleSave(course.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="catalog-empty">
                {emptySaved ? (
                  <BookmarkSimple size={36} aria-hidden="true" />
                ) : (
                  <MagnifyingGlass size={36} aria-hidden="true" />
                )}
                <h2>{emptySaved ? t.emptySavedTitle : t.emptyTitle}</h2>
                <p>{emptySaved ? t.emptySavedBody : t.emptyBody}</p>
                <button
                  className="catalog-primary"
                  type="button"
                  onClick={() => (emptySaved ? changeView(false) : resetFilters())}
                >
                  {emptySaved ? t.browseCourses : t.resetFilters}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="catalog-container catalog-footer">
        <span>project l.</span>
        <p>{t.footer}</p>
        <a href="#top">
          {t.backToTop}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </footer>
      <div className="sr-only" role="status">
        {announcement &&
          `${announcement.saved ? t.savedAnnouncement : t.removedAnnouncement}: ${courses.find((course) => course.id === announcement.id)?.title[locale]}`}
      </div>
    </div>
  )
}
