import { useState } from 'react'
import { BookmarkSimple, CaretDown, Check, Clock, Stack, VideoCamera } from '@phosphor-icons/react'
import type { Language } from '@/i18n/messages'
import { courseMessages } from '@/i18n/courses'
import type { Course } from './data'

export function CourseCard({
  course,
  locale,
  saved,
  onSave,
}: {
  course: Course
  locale: Language
  saved: boolean
  onSave: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const t = courseMessages[locale]
  const title = course.title[locale]
  const contentId = `content-${course.id}`

  return (
    <article className="course-card" aria-labelledby={`title-${course.id}`}>
      <div className={`course-cover cover-${course.language} cover-${course.id}`}>
        <span className="cover-label">{t[course.language]}</span>
        <span className="cover-word" aria-hidden="true">
          {course.coverWord}
        </span>
        <span className="cover-bottom">
          <span>{course.coverNote[locale]}</span>
        </span>
      </div>
      <div className="course-card-body">
        <div className="course-card-meta">
          <span className="course-level">{t[course.level]}</span>
          <button
            className="course-bookmark"
            type="button"
            aria-pressed={saved}
            aria-label={`${saved ? t.unsave : t.save}: ${title}`}
            onClick={onSave}
          >
            <BookmarkSimple size={21} weight={saved ? 'fill' : 'regular'} aria-hidden="true" />
          </button>
        </div>
        <h2 id={`title-${course.id}`}>{title}</h2>
        <p className="course-description">{course.description[locale]}</p>
        <div className="course-facts">
          <span>
            <Stack size={17} aria-hidden="true" />
            {course.sessions} {t.sessions}
          </span>
          <span>
            <Clock size={17} aria-hidden="true" />
            {course.minutes} {t.minutes} {t.perSession}
          </span>
        </div>
        <button
          type="button"
          className="course-details-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
        >
          <span>
            {expanded ? t.hideDetails : t.details}
            <span className="sr-only">: {title}</span>
          </span>
          <CaretDown size={18} aria-hidden="true" />
        </button>
        <div className="course-details" id={contentId} hidden={!expanded}>
          <h3>{t.outcomes}</h3>
          <ul>
            {course.outcomes[locale].map((outcome) => (
              <li key={outcome}>
                <Check size={16} aria-hidden="true" />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
          <div className="course-format">
            <VideoCamera size={19} aria-hidden="true" />
            <span>{t.liveFormat}</span>
          </div>
          <p>{t.teamsLater}</p>
        </div>
      </div>
    </article>
  )
}
