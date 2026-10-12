import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye } from '@phosphor-icons/react'
import type { VocabularyRating, Word } from '../../../shared/portal'
import { nextVocabularyReview } from '../../../shared/vocabulary'
import { vocabularyQueue } from '@/features/live/vocabulary-session'
import { PortalApiError } from '@/features/auth/client'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import '@/styles/live-administration.css'
import '@/styles/vocabulary-practice.css'

type PracticeSession = { cards: Word[]; index: number; reviewed: number; skipped: number }

export function VocabularyPracticeView(props: LiveViewProps) {
  const { state, locale } = props
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState<'due' | 'all'>('due')
  const [direction, setDirection] = useState<'meaning' | 'word'>('meaning')
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const topics = [...new Set(state.words.map((word) => word.topic).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, locale),
  )
  const queue = vocabularyQueue(state.words, state.fetchedAt, topic, mode)
  const card = session?.cards[session.index]
  const current = card ? state.words.find((word) => word.id === card.id) : undefined
  const conflict = Boolean(card && current && card.version !== current.version)
  const available = Boolean(card && current && !conflict)
  const finished = Boolean(session && !card)

  useEffect(() => {
    heading.current?.focus()
  }, [session?.index, finished])
  useEffect(() => {
    function leave(event: Event) {
      if (
        busy ||
        (answer.trim() &&
          !window.confirm(
            locale === 'vi'
              ? 'Rời phiên ôn? Câu trả lời đang nhập chưa được lưu; các lượt tự đánh giá đã lưu vẫn được giữ.'
              : 'Leave practice? Your typed answer is not saved; completed reviews are retained.',
          ))
      )
        event.preventDefault()
    }
    function unload(event: BeforeUnloadEvent) {
      if (busy || answer.trim()) event.preventDefault()
    }
    function click(event: MouseEvent) {
      const target =
        event.target instanceof Element ? event.target.closest('a[href], .mis-signout') : null
      if (
        !target ||
        target.getAttribute('href')?.startsWith('#') ||
        target.hasAttribute('download')
      )
        return
      leave(event)
      if (event.defaultPrevented) event.stopPropagation()
    }
    window.addEventListener('project-l:before-leave', leave)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('project-l:before-leave', leave)
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
    }
  }, [answer, busy, locale])

  const date = (value: string) =>
    new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  function begin() {
    if (!queue.length) return
    setSession({ cards: queue, index: 0, reviewed: 0, skipped: 0 })
    setAnswer('')
    setRevealed(false)
    setError('')
    setSaved('')
  }
  function advance(reviewed: boolean) {
    setSession((previous) =>
      previous
        ? {
            ...previous,
            index: previous.index + 1,
            reviewed: previous.reviewed + (reviewed ? 1 : 0),
            skipped: previous.skipped + (reviewed ? 0 : 1),
          }
        : null,
    )
    setAnswer('')
    setRevealed(false)
    setError('')
  }
  async function rate(rating: VocabularyRating) {
    if (!card || !available || !revealed || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await props.run('word.review', {
        id: card.id,
        expectedVersion: card.version,
        rating,
      })
      const due = result.state.words.find((word) => word.id === card.id)?.practice.dueAt
      setSaved(
        due
          ? t(
              `Đã lưu lượt ôn “${card.word}”. Ôn lại: ${date(due)}.`,
              `Saved review for “${card.word}”. Next review: ${date(due)}.`,
            )
          : t('Đã lưu lượt ôn.', 'Review saved.'),
      )
      advance(true)
    } catch (cause) {
      setError(
        cause instanceof PortalApiError
          ? errorMessage(cause, locale)
          : t(
              'Chưa xác nhận được kết quả. Nội dung vẫn được giữ; hãy cập nhật dữ liệu trước khi thử lại.',
              'The result could not be confirmed. Your input is kept; refresh data before retrying.',
            ),
      )
      await props.refresh().catch(() => undefined)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  function stop() {
    if (busy) return
    if (
      answer.trim() &&
      !window.confirm(
        t(
          'Dừng phiên ôn và bỏ câu trả lời đang nhập? Các lượt đã lưu vẫn được giữ.',
          'End this session and discard the typed answer? Completed reviews are retained.',
        ),
      )
    )
      return
    setSession(null)
    setAnswer('')
    setRevealed(false)
    setError('')
  }
  if (state.user.role !== 'student')
    return (
      <p className="mis-empty">
        {t('Phần ôn từ dành cho học viên.', 'Vocabulary practice is available to students.')}
      </p>
    )
  return (
    <div className="live-admin vocab-practice">
      <div className="live-heading">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {finished
              ? t('Đã kết thúc phiên ôn', 'Practice session complete')
              : t('Ôn từ vựng', 'Vocabulary practice')}
          </h2>
          <p>
            {t(
              'Nhớ lại trước, xem đáp án sau. Tự đánh giá để lên lịch ôn tiếp theo.',
              'Recall first, then reveal. Rate your recall to schedule your next review.',
            )}
          </p>
        </div>
        <a className="mis-button" href="#notebook">
          <ArrowLeft size={17} aria-hidden="true" />
          {t('Sổ từ vựng', 'Vocabulary notebook')}
        </a>
      </div>
      {saved && (
        <p className="live-success" role="status">
          <Check size={18} aria-hidden="true" />
          {saved}
        </p>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {!session ? (
        <section className="mis-panel mis-stack">
          <h3>{t('Chọn nội dung ôn', 'Choose your practice')}</h3>
          <div className="live-form-grid">
            <label className="mis-field">
              {t('Chủ đề', 'Topic')}
              <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                <option value="">{t('Tất cả chủ đề', 'All topics')}</option>
                {topic && !topics.includes(topic) && <option value={topic}>{topic}</option>}
                {topics.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="mis-field">
              {t('Danh sách', 'Word selection')}
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as 'due' | 'all')}
              >
                <option value="due">{t('Từ mới và đến hạn ôn', 'New and due words')}</option>
                <option value="all">{t('Ôn thêm tất cả từ', 'Extra practice: all words')}</option>
              </select>
            </label>
            <label className="mis-field">
              {t('Cách ôn', 'Recall direction')}
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as 'meaning' | 'word')}
              >
                <option value="meaning">
                  {t('Nhìn từ, nhớ nghĩa', 'See the word, recall its meaning')}
                </option>
                <option value="word">
                  {t('Nhìn nghĩa, nhớ từ', 'See the meaning, recall the word')}
                </option>
              </select>
            </label>
          </div>
          <p>
            {queue.length
              ? t(
                  `${queue.length} từ trong phiên này, tối đa 20 từ mỗi phiên.`,
                  `${queue.length} words in this session, up to 20 per session.`,
                )
              : state.words.length
                ? t(
                    'Không có từ đến hạn trong bộ lọc này. Bạn có thể đổi chủ đề hoặc chọn ôn thêm.',
                    'No words are due with these filters. Change the topic or choose extra practice.',
                  )
                : t(
                    'Thêm từ, nghĩa và ví dụ vào sổ từ vựng để bắt đầu.',
                    'Add words, meanings and examples to your notebook to begin.',
                  )}
          </p>
          <div className="live-actions">
            <button
              type="button"
              className="mis-button mis-primary"
              disabled={!queue.length}
              onClick={begin}
            >
              {t('Bắt đầu ôn', 'Start practice')}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            {!state.words.length && (
              <a className="mis-button" href="#notebook">
                {t('Thêm từ vựng', 'Add vocabulary')}
              </a>
            )}
          </div>
          <p className="live-help">
            {t(
              'Lịch ôn dựa trên mức tự đánh giá, không phải điểm kiểm tra. Hệ thống lưu lịch ôn; câu trả lời nháp chỉ dùng trong phiên này.',
              'Review timing uses your self-rating, not a test score. Your schedule is saved; typed recall answers stay only in this session.',
            )}
          </p>
        </section>
      ) : finished ? (
        <section className="mis-panel mis-stack">
          <p>
            {t(
              `Đã lưu ${session.reviewed} lượt tự đánh giá; bỏ qua ${session.skipped} từ.`,
              `${session.reviewed} reviews saved; ${session.skipped} words skipped.`,
            )}
          </p>
          <p>
            {t(
              'Các từ đã ôn sẽ trở lại khi đến hạn. Bạn có thể chọn ôn thêm nếu muốn.',
              'Reviewed words return when due. You can choose extra practice at any time.',
            )}
          </p>
          <div className="live-actions">
            <button
              className="mis-button mis-primary"
              type="button"
              onClick={() => setSession(null)}
            >
              {t('Chọn phiên tiếp theo', 'Choose another session')}
            </button>
            <a className="mis-button" href="#overview">
              {t('Về tổng quan', 'Back to dashboard')}
            </a>
          </div>
        </section>
      ) : card && session ? (
        <section className="mis-panel mis-stack vocab-recall" aria-busy={busy}>
          <div className="live-heading">
            <p>
              {t(
                `Từ ${session.index + 1}/${session.cards.length}`,
                `Word ${session.index + 1}/${session.cards.length}`,
              )}
              {card.topic ? ` · ${card.topic}` : ''}
            </p>
            <button className="mis-button" disabled={busy} type="button" onClick={stop}>
              {t('Kết thúc phiên', 'End session')}
            </button>
          </div>
          {!current ? (
            <div className="mis-stack">
              <p role="alert">
                {t(
                  'Từ này đã bị xóa hoặc không còn khả dụng. Câu trả lời của bạn vẫn ở bên dưới.',
                  'This word was removed or is no longer available. Your typed answer is kept below.',
                )}
              </p>
              <button
                className="mis-button"
                type="button"
                disabled={busy}
                onClick={() => advance(false)}
              >
                {t('Bỏ qua từ này', 'Skip this word')}
              </button>
            </div>
          ) : conflict ? (
            <div className="mis-stack">
              <p className="live-error" role="alert">
                {t(
                  'Từ hoặc lịch ôn đã thay đổi ở nơi khác. Dùng phiên bản mới và kiểm tra lại câu trả lời trước khi tự đánh giá.',
                  'This word or review schedule changed elsewhere. Use the latest version and check your answer before rating.',
                )}
              </p>
              <button
                className="mis-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setSession({
                    ...session,
                    cards: session.cards.map((word, index) =>
                      index === session.index ? current : word,
                    ),
                  })
                  setRevealed(false)
                  setError('')
                }}
              >
                {t('Ôn phiên bản mới', 'Review latest version')}
              </button>
            </div>
          ) : null}
          <div className="vocab-question">
            <p className="live-help">
              {direction === 'meaning'
                ? t('Nhớ nghĩa của từ / cụm từ', 'Recall the meaning of this word / phrase')
                : t('Nhớ từ / cụm từ ứng với nghĩa', 'Recall the word / phrase for this meaning')}
            </p>
            <h3>{direction === 'meaning' ? card.word : card.meaning}</h3>
          </div>
          <form
            className="mis-stack"
            onSubmit={(event) => {
              event.preventDefault()
              if (available && !busy) setRevealed(true)
            }}
          >
            <label className="mis-field">
              {t('Câu trả lời của bạn (không bắt buộc)', 'Your recall answer (optional)')}
              <textarea
                rows={3}
                maxLength={3000}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={busy}
                placeholder={t('Thử nhớ trước khi mở đáp án…', 'Try recalling before revealing…')}
              />
            </label>
            {!revealed && (
              <div className="live-actions">
                <button
                  className="mis-button mis-primary"
                  type="submit"
                  disabled={!available || busy}
                >
                  <Eye size={18} aria-hidden="true" />
                  {t('Xem đáp án', 'Reveal answer')}
                </button>
              </div>
            )}
          </form>
          {revealed && (
            <div className="vocab-answer mis-stack">
              <h3>
                {direction === 'meaning'
                  ? t('Nghĩa đã lưu', 'Saved meaning')
                  : t('Từ đã lưu', 'Saved word')}
              </h3>
              <p className="live-prose">{direction === 'meaning' ? card.meaning : card.word}</p>
              {card.example && (
                <div>
                  <h4>{t('Ví dụ của bạn', 'Your example')}</h4>
                  <p className="live-prose">{card.example}</p>
                </div>
              )}
              <p>{t('Bạn nhớ được ở mức nào?', 'How well did you recall it?')}</p>
              <div className="vocab-ratings">
                {(['again', 'hard', 'good', 'easy'] as const).map((rating) => {
                  const preview = nextVocabularyReview(card.practice, rating, state.fetchedAt)
                  const days = Math.round(
                    (Date.parse(preview.dueAt!) - Date.parse(state.fetchedAt)) / 86400000,
                  )
                  const label = {
                    again: t('Chưa nhớ', 'Again'),
                    hard: t('Còn khó', 'Hard'),
                    good: t('Nhớ được', 'Good'),
                    easy: t('Nhớ dễ dàng', 'Easy'),
                  }[rating]
                  return (
                    <button
                      key={rating}
                      className="mis-button"
                      type="button"
                      disabled={!available || busy}
                      onClick={() => void rate(rating)}
                    >
                      <span>{label}</span>
                      <small>
                        {rating === 'again'
                          ? t('10 phút', '10 minutes')
                          : t(`${days} ngày`, `${days} ${days === 1 ? 'day' : 'days'}`)}
                      </small>
                    </button>
                  )
                })}
              </div>
              {busy && <p role="status">{t('Đang lưu lượt ôn…', 'Saving review…')}</p>}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
