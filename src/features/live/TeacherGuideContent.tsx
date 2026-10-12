import { useId } from 'react'
import type { StarterTeacherGuide } from '../../../shared/curriculum'
import type { Locale, ReadingResponse } from '../../../shared/portal'
import '@/styles/teacher-guide.css'

function AnswerKey({ answers }: { answers: ReadingResponse }) {
  const label = (value: string) => (/^[a-z]$/.test(value) ? value.toUpperCase() : value)
  return (
    <ol className="teacher-guide-answers" lang="en">
      {Object.entries(answers).map(([key, value]) => (
        <li key={key}>{Array.isArray(value) ? value.map(label).join(', ') : label(value)}</li>
      ))}
    </ol>
  )
}

/** Render authorized structured text only; Markdown remains an explicit-download format. */
export function TeacherGuideContent({
  guide,
  locale,
}: {
  guide: StarterTeacherGuide
  locale: Locale
}) {
  const headingId = useId()
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  return (
    <section className="teacher-guide-content" aria-labelledby={headingId} lang={locale}>
      <div>
        <h3 id={headingId}>{guide.title[locale]}</h3>
        <p className="live-prose">{guide.notice[locale]}</p>
      </div>
      {guide.units.map((unit, index) => (
        <details key={unit.title.en} open={index === 0} className="live-details teacher-guide-unit">
          <summary>{unit.title[locale]}</summary>
          <div className="teacher-guide-sections">
            <section>
              <h4>{t('Đáp án Reading', 'Reading answer key')}</h4>
              <AnswerKey answers={unit.readingAnswers} />
              <p className="live-prose">{unit.readingRationale[locale]}</p>
            </section>
            <section>
              <h4>{t('Đáp án Listening', 'Listening answer key')}</h4>
              <AnswerKey answers={unit.listeningAnswers} />
              <p className="live-prose">{unit.listeningRationale[locale]}</p>
            </section>
            <section>
              <h4>{t('Bản chép lời Listening', 'Listening transcript')}</h4>
              <p className="live-prose" lang="en">
                {unit.listeningTranscript}
              </p>
            </section>
            <section>
              <h4>{t('Gợi ý nhận xét Writing', 'Writing review guidance')}</h4>
              <p className="live-prose">{unit.writingReview[locale]}</p>
            </section>
            <section>
              <h4>{t('Gợi ý nhận xét Speaking', 'Speaking review guidance')}</h4>
              <p className="live-prose">{unit.speakingReview[locale]}</p>
            </section>
            <section>
              <h4>{t('Review kiến thức 1:1', '1:1 knowledge review')}</h4>
              <p className="live-prose">{unit.consultationReview[locale]}</p>
            </section>
          </div>
        </details>
      ))}
    </section>
  )
}
