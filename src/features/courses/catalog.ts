import type { Language } from '@/i18n/messages'
import { courses, type Course, type CourseLanguage, type CourseLevel } from './data'

export const savedCoursesKey = 'project-l-saved-courses'
export type SortOrder = 'recommended' | 'shortest' | 'alphabetical'

export function readSavedCourses(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(savedCoursesKey) ?? '[]')
    if (!Array.isArray(value)) return []
    return [
      ...new Set(
        value.filter(
          (id): id is string =>
            typeof id === 'string' && courses.some((course) => course.id === id),
        ),
      ),
    ]
  } catch {
    return []
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

export function selectCourses(options: {
  query: string
  language: CourseLanguage | 'all'
  level: CourseLevel | 'all'
  sort: SortOrder
  locale: Language
  savedOnly: boolean
  savedIds: string[]
}): Course[] {
  const terms = normalize(options.query).trim().split(/\s+/).filter(Boolean)
  const results = courses.filter((course) => {
    const text = normalize(
      [
        course.title.vi,
        course.title.en,
        course.description.vi,
        course.description.en,
        course.language,
        course.coverWord,
      ].join(' '),
    )
    return (
      (options.language === 'all' || course.language === options.language) &&
      (options.level === 'all' || course.level === options.level) &&
      (!options.savedOnly || options.savedIds.includes(course.id)) &&
      terms.every((term) => text.includes(term))
    )
  })

  if (options.sort === 'shortest') results.sort((a, b) => a.sessions - b.sessions)
  if (options.sort === 'alphabetical') {
    results.sort((a, b) =>
      a.title[options.locale].localeCompare(b.title[options.locale], options.locale),
    )
  }
  return results
}
