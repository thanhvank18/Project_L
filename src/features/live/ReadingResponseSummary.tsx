import type { Locale } from '../../../shared/portal'
import type { ReadingDefinition, ReadingResponse } from '../../../shared/reading'
import { enumerateReadingQuestions } from '@/features/live/reading-helpers'
import '@/styles/reading-authoring.css'

export function ReadingResponseSummary({
  definition,
  answers,
  locale,
}: {
  definition: ReadingDefinition
  answers: ReadingResponse
  locale: Locale
}) {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const numbered = enumerateReadingQuestions(definition)
  return (
    <div className="reading-response-summary">
      {definition.groups.map((group) => (
        <section className="reading-response-group" key={group.id}>
          <h4>{group.title[locale]}</h4>
          {group.instructions[locale] && (
            <p className="live-submission-prose">{group.instructions[locale]}</p>
          )}
          <dl>
            {numbered
              .filter((item) => item.group.id === group.id)
              .map(({ question, number, endNumber }) => {
                const response = answers[question.id]
                const selected = Array.isArray(response) ? response : response ? [response] : []
                const values =
                  question.kind === 'short'
                    ? selected
                    : selected.map(
                        (id) =>
                          question.options.find((option) => option.id === id)?.label[locale] ??
                          t(
                            'Lựa chọn không còn trong bản đề này',
                            'Option unavailable in this prompt snapshot',
                          ),
                      )
                return (
                  <div className="reading-response-row" key={question.id}>
                    <dt>
                      <span className="reading-response-number">
                        <span className="sr-only">{t('Câu', 'Question')} </span>
                        {number === endNumber ? number : `${number}–${endNumber}`}
                      </span>
                      <span className="live-submission-prose">{question.prompt[locale]}</span>
                    </dt>
                    <dd>
                      <p className="live-help">
                        {question.kind === 'short'
                          ? t(
                              `Tối đa ${question.maxWords} từ`,
                              `Maximum ${question.maxWords} words`,
                            )
                          : question.kind === 'multiple'
                            ? t(
                                `Chọn ${question.selectCount} đáp án`,
                                `Choose ${question.selectCount} answers`,
                              )
                            : t('Chọn một đáp án', 'Choose one answer')}
                      </p>
                      {values.length ? (
                        <ul>
                          {values.map((value, index) => (
                            <li key={index}>{value}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="live-help">{t('Chưa có câu trả lời', 'No response')}</span>
                      )}
                      {question.kind !== 'short' && (
                        <details className="reading-saved-options">
                          <summary>
                            {t(
                              'Xem các lựa chọn của bản đề này',
                              'View options from this prompt snapshot',
                            )}
                          </summary>
                          <ul>
                            {question.options.map((option) => (
                              <li key={option.id}>{option.label[locale]}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </dd>
                  </div>
                )
              })}
          </dl>
        </section>
      ))}
    </div>
  )
}
