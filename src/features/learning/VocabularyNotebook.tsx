import { useId, useState } from 'react'
import { BookBookmark, MagnifyingGlass, Trash } from '@phosphor-icons/react'
import type { LearningActions, PortalLocale, PortalState } from '@/features/learning/types'

interface NotebookProps {
  locale: PortalLocale
  state: PortalState
  actions: LearningActions
}

const copy = {
  vi: {
    title: 'Sổ từ vựng',
    introduction: 'Những từ bạn lưu khi làm bài. Ôn lại nghĩa, ngữ cảnh và chủ đề ở một nơi.',
    search: 'Tìm trong sổ từ vựng',
    placeholder: 'Tìm từ, nghĩa hoặc chủ đề...',
    count: 'từ đã lưu',
    empty: 'Bắt đầu từ một từ mới',
    emptyBody:
      'Mở bài tập Đọc hoặc Viết, chọn một từ trong bộ từ mẫu rồi bấm “Lưu từ”. Từ đó sẽ xuất hiện ở đây cùng nghĩa và ví dụ.',
    noResults: 'Không tìm thấy từ phù hợp',
    noResultsBody: 'Thử tìm bằng từ tiếng Anh, nghĩa hoặc tên chủ đề.',
    clear: 'Xóa tìm kiếm',
    remove: 'Xóa từ',
    removed: 'Đã xóa từ khỏi sổ trong trình duyệt này.',
    error: 'Chưa xóa được từ. Vui lòng thử lại.',
    local: 'Sổ từ được lưu trong trình duyệt này và chưa đồng bộ với tài khoản.',
    practice: 'Luyện tập với AI',
    unavailable: 'Chưa kết nối',
    practiceBody:
      'Tạo bài luyện theo chủ đề và nhận phản hồi AI sẽ cần dịch vụ AI. Bản xem trước hiện hỗ trợ lưu, tìm và xóa từ mẫu.',
    reminders: 'Email nhắc ôn tập cũng chưa được gửi trong bản xem trước.',
    topic: 'Chủ đề',
    example: 'Ví dụ',
  },
  en: {
    title: 'Vocabulary notebook',
    introduction:
      'The words you save while studying. Revisit their meanings, examples, and topics in one place.',
    search: 'Search your vocabulary notebook',
    placeholder: 'Search words, meanings, or topics...',
    count: 'saved words',
    empty: 'Start with one new word',
    emptyBody:
      'Open a Reading or Writing assignment, choose a word from the sample dictionary, and select “Save word”. It will appear here with its meaning and an example.',
    noResults: 'No matching words',
    noResultsBody: 'Try an English word, a meaning, or a topic name.',
    clear: 'Clear search',
    remove: 'Remove word',
    removed: 'Word removed from the notebook in this browser.',
    error: 'Could not remove this word. Please try again.',
    local: 'This notebook is saved in this browser and is not synced to an account.',
    practice: 'Practise with AI',
    unavailable: 'Not connected',
    practiceBody:
      'Topic-based exercises and AI feedback will need a connected AI service. This preview supports saving, finding, and removing sample words.',
    reminders: 'Review reminder emails are not sent in this preview either.',
    topic: 'Topic',
    example: 'Example',
  },
}

export function VocabularyNotebook({ locale, state, actions }: NotebookProps) {
  const t = copy[locale]
  const id = useId()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'removed' | 'error'>('idle')
  const normalizedQuery = query.trim().toLocaleLowerCase(locale === 'vi' ? 'vi-VN' : 'en-GB')
  const words = state.words.filter((word) =>
    `${word.word} ${word.meaning.vi} ${word.meaning.en} ${word.topic.vi} ${word.topic.en}`
      .toLocaleLowerCase(locale === 'vi' ? 'vi-VN' : 'en-GB')
      .includes(normalizedQuery),
  )
  return (
    <div className="lw-notebook">
      <header className="lp-section-heading">
        <div>
          <p>{t.introduction}</p>
        </div>
        <span className="lw-notebook-count">
          {state.words.length} {t.count}
        </span>
      </header>
      <div className="lw-notebook-layout">
        <section className="lw-notebook-main" aria-label={t.title}>
          <div className="lw-notebook-toolbar">
            <label className="lw-field-label" htmlFor={id}>
              {t.search}
            </label>
            <div className="lw-search-field">
              <MagnifyingGlass size={19} aria-hidden="true" />
              <input
                id={id}
                type="search"
                className="lp-field"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.placeholder}
              />
            </div>
          </div>
          <p
            className={`lw-notebook-feedback${status === 'error' ? ' lw-error' : ''}`}
            role="status"
          >
            {status !== 'idle' ? t[status] : ''}
          </p>
          {words.length ? (
            <ul className="lw-vocabulary-list">
              {words.map((word) => (
                <li key={word.id}>
                  <div className="lw-vocabulary-content">
                    <div className="lw-vocabulary-title">
                      <h2 lang="en">{word.word}</h2>
                      <span>{word.meaning[locale]}</span>
                    </div>
                    <p className="lw-example" lang="en">
                      {word.example}
                    </p>
                    <p className="lw-word-topic">
                      {t.topic}: {word.topic[locale]}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="lp-button lw-remove-word"
                    aria-label={`${t.remove}: ${word.word}`}
                    title={`${t.remove}: ${word.word}`}
                    onClick={() => setStatus(actions.removeWord(word.id) ? 'removed' : 'error')}
                  >
                    <Trash size={19} aria-hidden="true" />
                    <span>{t.remove}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="lp-empty lw-notebook-empty">
              <BookBookmark size={32} aria-hidden="true" />
              <h2>{state.words.length ? t.noResults : t.empty}</h2>
              <p>{state.words.length ? t.noResultsBody : t.emptyBody}</p>
              {query && (
                <button type="button" className="lp-button" onClick={() => setQuery('')}>
                  {t.clear}
                </button>
              )}
            </div>
          )}
          <p className="lw-local-note">{t.local}</p>
        </section>
        <aside className="lw-notebook-practice">
          <h2>{t.practice}</h2>
          <span className="lp-status">{t.unavailable}</span>
          <p>{t.practiceBody}</p>
          <p className="lw-hint">{t.reminders}</p>
        </aside>
      </div>
    </div>
  )
}
