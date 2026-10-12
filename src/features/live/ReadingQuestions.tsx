import { useContext, useState } from 'react'
import { Flag } from '@phosphor-icons/react'
import type { Locale } from '../../../shared/portal'
import type { ReadingDefinition, ReadingResponse } from '../../../shared/reading'
import { readingWordCount } from '../../../shared/reading'
import { ReadingReviewContext } from '@/features/live/reading-review-context'
import {
  enumerateReadingQuestions,
  isReadingAnswerComplete,
  readingProgress,
  nextReadingQuestion,
} from '@/features/live/reading-helpers'

export function ReadingQuestions({
  definition,
  answers,
  locale,
  disabled,
  onChange,
}: {
  definition: ReadingDefinition
  answers: ReadingResponse
  locale: Locale
  disabled: boolean
  onChange: (answers: ReadingResponse) => void
}) {
  const review = useContext(ReadingReviewContext)
  const flagged = review?.flagged ?? []
  const [active, setActive] = useState('')
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const entries = enumerateReadingQuestions(definition)
  const progress = readingProgress(definition, answers)
  const nextIncomplete = nextReadingQuestion(definition, answers, flagged, active, 'incomplete')
  const nextFlagged = nextReadingQuestion(definition, answers, flagged, active, 'flagged')
  const focusQuestion = (id: string) => {
    const element = document.getElementById(`reading-question-${id}`)
    element?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    element?.focus({ preventScroll: true })
    setActive(id)
  }
  return (
    <div className="reading-questions">
      <div className="reading-progress">
        <h2>{t('Câu hỏi', 'Questions')}</h2>
        <span>
          {progress.answeredSlots}/{progress.totalSlots} {t('đã trả lời', 'answered')}
        </span>
      </div>
      <div className="reading-quick-navigation" aria-label={t('Rà soát bài làm', 'Review answers')}>
        <button
          className="mis-button"
          disabled={!nextIncomplete}
          onClick={() => nextIncomplete && focusQuestion(nextIncomplete)}
        >
          {t('Câu chưa hoàn tất', 'Next incomplete')} ·{' '}
          {progress.totalQuestions - progress.completedQuestions}
        </button>
        <button
          className="mis-button"
          disabled={!nextFlagged}
          onClick={() => nextFlagged && focusQuestion(nextFlagged)}
        >
          <Flag size={17} aria-hidden="true" />
          {t('Câu cần xem lại', 'Next flagged')} ·{' '}
          {entries.filter(({ question }) => flagged.includes(question.id)).length}
        </button>
      </div>
      {definition.groups.map((group) => (
        <section
          className="reading-group"
          key={group.id}
          aria-labelledby={`reading-group-${group.id}`}
        >
          <h3 id={`reading-group-${group.id}`}>{group.title[locale]}</h3>
          <p className="live-prose reading-group-instructions">{group.instructions[locale]}</p>
          {entries
            .filter((entry) => entry.group.id === group.id)
            .map(({ question, number, endNumber }) => {
              const value = answers[question.id]
              const selected = Array.isArray(value) ? value : []
              const isFlagged = flagged.includes(question.id)
              const words = typeof value === 'string' ? readingWordCount(value) : 0
              const range = endNumber > number ? `${number}–${endNumber}` : String(number)
              return (
                <div
                  className="reading-question"
                  id={`reading-question-${question.id}`}
                  key={question.id}
                  tabIndex={-1}
                  onFocus={() => setActive(question.id)}
                >
                  <div className="reading-question-heading">
                    <span className="reading-number">{range}</span>
                    <button
                      type="button"
                      className="reading-flag"
                      aria-pressed={isFlagged}
                      aria-label={`${t('Đánh dấu xem lại câu', 'Flag question')} ${range}`}
                      disabled={disabled || !review || review.disabled}
                      onClick={() =>
                        review?.onChange(
                          isFlagged
                            ? flagged.filter((id) => id !== question.id)
                            : [...flagged, question.id],
                        )
                      }
                    >
                      <Flag size={17} weight={isFlagged ? 'fill' : 'regular'} aria-hidden="true" />
                      <span>{t('Xem lại', 'Review')}</span>
                    </button>
                  </div>
                  <fieldset className="live-fieldset" disabled={disabled}>
                    <legend className="reading-question-prompt">{question.prompt[locale]}</legend>
                    {question.kind === 'short' ? (
                      <label className="mis-field">
                        <span className="sr-only">
                          {t('Câu trả lời', 'Answer')} {range}
                        </span>
                        <input
                          maxLength={500}
                          autoComplete="off"
                          value={typeof value === 'string' ? value : ''}
                          aria-invalid={words > question.maxWords}
                          aria-describedby={`reading-help-${question.id}`}
                          onChange={(event) =>
                            onChange({ ...answers, [question.id]: event.target.value })
                          }
                        />
                        <small
                          id={`reading-help-${question.id}`}
                          className={words > question.maxWords ? 'mis-error' : ''}
                        >
                          {t('Tối đa', 'Maximum')} {question.maxWords}{' '}
                          {t('từ', question.maxWords === 1 ? 'word' : 'words')} · {words}/
                          {question.maxWords}
                        </small>
                      </label>
                    ) : (
                      <>
                        {question.kind === 'multiple' && (
                          <p className="live-help">
                            {t('Chọn', 'Choose')} {question.selectCount} · {selected.length}/
                            {question.selectCount}
                          </p>
                        )}
                        <div
                          className={`reading-options ${question.kind === 'single' && question.options.every((option) => option.label[locale].length <= 3) ? 'reading-options-compact' : ''}`}
                        >
                          {question.options.map((option) => (
                            <label className="reading-option" key={option.id}>
                              <input
                                type={question.kind === 'single' ? 'radio' : 'checkbox'}
                                name={`reading-${question.id}`}
                                checked={
                                  question.kind === 'single'
                                    ? value === option.id
                                    : selected.includes(option.id)
                                }
                                disabled={
                                  disabled ||
                                  (question.kind === 'multiple' &&
                                    selected.length >= question.selectCount &&
                                    !selected.includes(option.id))
                                }
                                onChange={(event) =>
                                  onChange({
                                    ...answers,
                                    [question.id]:
                                      question.kind === 'single'
                                        ? option.id
                                        : event.target.checked
                                          ? [...selected, option.id]
                                          : selected.filter((id) => id !== option.id),
                                  })
                                }
                              />
                              <span>{option.label[locale]}</span>
                            </label>
                          ))}
                        </div>
                        {value && (typeof value === 'string' || value.length > 0) && (
                          <button
                            type="button"
                            className="study-text-button"
                            onClick={() => {
                              const next = { ...answers }
                              delete next[question.id]
                              onChange(next)
                            }}
                          >
                            {t('Bỏ lựa chọn', 'Clear selection')}
                          </button>
                        )}
                      </>
                    )}
                  </fieldset>
                </div>
              )
            })}
        </section>
      ))}
      <nav className="reading-navigation" aria-label={t('Chuyển đến câu hỏi', 'Jump to question')}>
        <span className="live-help">{t('Chuyển câu', 'Questions')}</span>
        <div>
          {entries.map(({ question, number, endNumber }) => (
            <button
              type="button"
              key={question.id}
              className={
                isReadingAnswerComplete(question, answers[question.id]) ? 'is-answered' : ''
              }
              aria-current={active === question.id ? 'step' : undefined}
              aria-label={`${t('Câu', 'Question')} ${number}${endNumber > number ? `–${endNumber}` : ''} · ${isReadingAnswerComplete(question, answers[question.id]) ? t('đã trả lời', 'answered') : t('chưa hoàn tất', 'incomplete')}${flagged.includes(question.id) ? ` · ${t('cần xem lại', 'flagged')}` : ''}`}
              onClick={() => focusQuestion(question.id)}
            >
              {number}
              {endNumber > number ? `–${endNumber}` : ''}
              {flagged.includes(question.id) && <Flag size={12} weight="fill" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <small>
          {t(
            'Cờ xem lại được tự lưu cùng ghi chú riêng.',
            'Review flags autosave with your private notes.',
          )}
        </small>
      </nav>
    </div>
  )
}
