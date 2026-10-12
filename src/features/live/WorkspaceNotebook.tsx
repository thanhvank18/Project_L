import { useEffect, useRef, useState } from 'react'
import { BookOpen, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import type { Assignment } from '../../../shared/portal'
import {
  lookupDictionary,
  type DictionaryEntry,
  type DictionaryMeaning,
} from '@/features/live/dictionary'
import { errorMessage, type LiveViewProps } from '@/features/live/types'

export function WorkspaceNotebook({
  state,
  locale,
  run,
  assignment,
  available,
  onDirtyChange,
  selectedText = '',
}: LiveViewProps & {
  assignment: Assignment
  available: boolean
  onDirtyChange: (dirty: boolean) => void
  selectedText?: string
}) {
  const [word, setWord] = useState('')
  const [meaning, setMeaning] = useState('')
  const [example, setExample] = useState('')
  const [topic, setTopic] = useState('')
  const [entry, setEntry] = useState<DictionaryEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<'empty' | 'query' | 'service' | { save: unknown } | null>(null)
  const [saved, setSaved] = useState(false)
  const [pendingMeaning, setPendingMeaning] = useState<DictionaryMeaning | null>(null)
  const [clearing, setClearing] = useState(false)
  const [sourceAssignment, setSourceAssignment] = useState(assignment)
  const request = useRef<AbortController | null>(null)
  const saving = useRef(false)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  // A dictionary query alone is not a notebook draft.
  const dirty = Boolean(meaning || example || topic)
  const sourceChanged =
    sourceAssignment.id !== assignment.id || sourceAssignment.version !== assignment.version
  if (!dirty && sourceChanged) setSourceAssignment(assignment)
  useEffect(() => {
    onDirtyChange(dirty || busy)
  }, [dirty, busy, onDirtyChange])
  useEffect(
    () => () => {
      const pending = request.current
      request.current = null
      pending?.abort()
    },
    [],
  )
  const cancelLookup = () => {
    const pending = request.current
    request.current = null
    pending?.abort()
    setLooking(false)
  }
  const resetNotices = () => {
    setSaved(false)
    setError(null)
    setPendingMeaning(null)
    setClearing(false)
  }
  const applyMeaning = (item: DictionaryMeaning) => {
    setMeaning(item.definition)
    // A dictionary choice must not replace the learner's own example.
    setExample((current) => (current.trim() ? current : item.example))
    resetNotices()
  }
  const clearWord = () => {
    cancelLookup()
    setWord('')
    setMeaning('')
    setExample('')
    setTopic('')
    setEntry(null)
    resetNotices()
  }
  const own = state.words
    .filter(
      (item) =>
        word.trim() && item.word.toLocaleLowerCase().includes(word.trim().toLocaleLowerCase()),
    )
    .slice(0, 4)
  const lookup = async () => {
    if (busy || looking || !word.trim()) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    setLooking(true)
    resetNotices()
    setEntry(null)
    try {
      const result = await lookupDictionary(word, controller.signal)
      if (request.current === controller) setEntry(result)
    } catch (failure) {
      if (request.current === controller)
        setError(
          failure instanceof Error && failure.message === 'dictionary-empty'
            ? 'empty'
            : failure instanceof Error && failure.message === 'dictionary-query'
              ? 'query'
              : 'service',
        )
    } finally {
      window.clearTimeout(timeout)
      if (request.current === controller) {
        request.current = null
        setLooking(false)
      }
    }
  }
  const save = async () => {
    if (saving.current || !available || sourceChanged || !word.trim() || !meaning.trim()) return
    saving.current = true
    cancelLookup()
    setBusy(true)
    resetNotices()
    try {
      await run('word.save', {
        expectedVersion: 0,
        word: word.trim(),
        meaning: meaning.trim(),
        example: example.trim(),
        topic: topic.trim(),
        sourceAssignmentId: sourceAssignment.id,
        sourceAssignmentVersion: sourceAssignment.version,
        sourceContext: '',
      })
      setWord('')
      setMeaning('')
      setExample('')
      setTopic('')
      setEntry(null)
      setSaved(true)
    } catch (failure) {
      setError({ save: failure })
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <aside
      className="mis-panel mis-stack study-notebook"
      aria-label={t('Từ điển và sổ từ', 'Dictionary and notebook')}
    >
      <h2>
        <BookOpen size={20} aria-hidden="true" /> {t('Từ điển & sổ từ', 'Dictionary & notebook')}
      </h2>
      {selectedText.trim() && selectedText.trim().length <= 80 && (
        <div>
          <button
            type="button"
            className="study-text-button"
            disabled={busy || dirty}
            onClick={() => {
              cancelLookup()
              setEntry(null)
              setWord(selectedText.trim())
              resetNotices()
            }}
          >
            {t('Dùng từ đang chọn:', 'Use selected text:')} {selectedText.trim()}
          </button>
          {dirty && (
            <p className="live-help">
              {t(
                'Lưu hoặc xóa từ đang nhập trước khi dùng đoạn chọn khác.',
                'Save or clear the current word before using another selection.',
              )}
            </p>
          )}
        </div>
      )}
      <label className="mis-field">
        {t('Từ cần tra', 'Word to look up')}
        <input
          maxLength={150}
          value={word}
          disabled={busy}
          onChange={(event) => {
            cancelLookup()
            setEntry(null)
            setWord(event.target.value)
            resetNotices()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void lookup()
            }
          }}
        />
      </label>
      <button
        className="mis-button"
        disabled={!word.trim() || busy || looking}
        onClick={() => void lookup()}
      >
        <MagnifyingGlass size={17} aria-hidden="true" />
        {looking ? t('Đang tra…', 'Looking up…') : t('Tra nghĩa tiếng Anh', 'Look up in English')}
      </button>
      {looking && (
        <button type="button" className="study-text-button" onClick={cancelLookup}>
          {t('Hủy tra từ', 'Cancel lookup')}
        </button>
      )}
      <p className="live-help">
        {t(
          'Free Dictionary API chỉ nhận từ bạn bấm tra, không nhận bài làm.',
          'Free Dictionary API receives only the word you look up, never your response.',
        )}
      </p>
      {entry && (
        <div className="study-definitions">
          <p className="live-help" role="status">
            {t('Chọn một nghĩa để thêm vào sổ từ.', 'Choose a meaning to add to your notebook.')}
          </p>
          <strong>
            {entry.word} {entry.phonetic}
          </strong>
          <ol>
            {entry.meanings.map((item, index) => (
              <li key={index}>
                <small>{item.part}</small>
                <p>{item.definition}</p>
                {item.example && <p className="live-help">{item.example}</p>}
                <button
                  className="study-text-button"
                  disabled={busy || !available}
                  aria-pressed={meaning === item.definition}
                  onClick={() => {
                    setClearing(false)
                    if (meaning.trim() && meaning !== item.definition) setPendingMeaning(item)
                    else applyMeaning(item)
                  }}
                >
                  {meaning === item.definition
                    ? t('Đã chọn nghĩa này', 'Meaning selected')
                    : t('Chọn nghĩa này', 'Use this meaning')}
                </button>
                {pendingMeaning === item && (
                  <div className="study-alert">
                    <p>
                      {t(
                        'Thay nghĩa đang nhập bằng nghĩa này? Câu ví dụ và chủ đề của bạn được giữ lại.',
                        'Replace your current meaning with this one? Your example and topic will be kept.',
                      )}
                    </p>
                    <div className="live-actions">
                      <button
                        className="mis-button"
                        disabled={busy || !available}
                        onClick={() => applyMeaning(item)}
                      >
                        {t('Thay nghĩa', 'Replace meaning')}
                      </button>
                      <button className="mis-button" onClick={() => setPendingMeaning(null)}>
                        {t('Giữ nghĩa đang nhập', 'Keep current meaning')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="live-help">
            <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">
              Free Dictionary API
            </a>
            {entry.sources.map((url, index) => (
              <span key={url}>
                {' '}
                ·{' '}
                <a href={url} target="_blank" rel="noreferrer">
                  {t('Nguồn', 'Source')} {index + 1}
                </a>
              </span>
            ))}
            {entry.licenses.map((license) => (
              <span key={license.url}>
                {' '}
                ·{' '}
                <a href={license.url} target="_blank" rel="noreferrer">
                  {license.name}
                </a>
              </span>
            ))}
          </p>
        </div>
      )}
      {own.length > 0 && (
        <details>
          <summary>
            {t('Từ đã có trong sổ', 'Already in your notebook')} ({own.length})
          </summary>
          <ul className="study-saved-words">
            {own.map((item) => (
              <li key={item.id}>
                <strong>{item.word}</strong> — {item.meaning}
              </li>
            ))}
          </ul>
        </details>
      )}
      {sourceChanged && (
        <div className="study-alert">
          <p role="alert">
            {t(
              'Từ đang nhập lấy nguồn từ phiên bản đề cũ. Đọc đề đang mở trước khi đổi nguồn; nội dung từ vẫn được giữ.',
              'This word draft belongs to an older prompt. Read the open prompt before updating its source; your word is kept.',
            )}
          </p>
          <button
            className="mis-button"
            disabled={busy || !available}
            onClick={() => setSourceAssignment(assignment)}
          >
            {t('Đã đọc đề mới, dùng nguồn này', 'I read the new prompt; use this source')}
          </button>
        </div>
      )}
      <fieldset className="live-fieldset mis-stack" disabled={busy || !available}>
        <label className="mis-field">
          {t('Nghĩa muốn ghi nhớ', 'Meaning to remember')}
          <textarea
            rows={3}
            maxLength={2000}
            value={meaning}
            onChange={(event) => {
              setMeaning(event.target.value)
              resetNotices()
            }}
          />
        </label>
        <label className="mis-field">
          {t('Câu ví dụ', 'Example sentence')}
          <textarea
            rows={2}
            maxLength={3000}
            value={example}
            onChange={(event) => {
              setExample(event.target.value)
              resetNotices()
            }}
          />
        </label>
        <label className="mis-field">
          {t('Chủ đề / tuần học', 'Topic / study week')}
          <input
            maxLength={150}
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value)
              resetNotices()
            }}
          />
        </label>
        <button
          className="mis-button"
          disabled={!word.trim() || !meaning.trim() || sourceChanged}
          onClick={() => void save()}
        >
          <Plus size={18} aria-hidden="true" />
          {busy ? t('Đang lưu…', 'Saving…') : t('Lưu vào notebook', 'Save to notebook')}
        </button>
      </fieldset>
      {(word || dirty) && (
        <button
          className="study-text-button"
          disabled={busy}
          onClick={() => {
            if (dirty) {
              setPendingMeaning(null)
              setClearing(true)
            } else clearWord()
          }}
        >
          {t('Xóa nội dung chưa lưu', 'Clear unsaved word')}
        </button>
      )}
      {clearing && (
        <div className="study-alert">
          <p>
            {t(
              'Xóa từ, nghĩa, ví dụ và chủ đề chưa lưu? Bài làm và các từ đã lưu không bị ảnh hưởng.',
              'Clear the unsaved word, meaning, example and topic? Your assignment and saved words stay unchanged.',
            )}
          </p>
          <div className="live-actions">
            <button className="mis-button" disabled={busy} onClick={clearWord}>
              {t('Xóa nội dung này', 'Clear this draft')}
            </button>
            <button className="mis-button" onClick={() => setClearing(false)}>
              {t('Tiếp tục chỉnh sửa', 'Keep editing')}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mis-error" role="alert">
          {typeof error === 'object'
            ? errorMessage(error.save, locale)
            : error === 'empty'
              ? t(
                  'Không tìm thấy từ. Bạn vẫn có thể tự nhập nghĩa để lưu.',
                  'No definition found. You can still enter a meaning to save.',
                )
              : error === 'query'
                ? t(
                    'Nhập một từ hoặc cụm từ tiếng Anh, tối đa 80 ký tự.',
                    'Enter an English word or phrase, up to 80 characters.',
                  )
                : t(
                    'Chưa kết nối được từ điển. Thử lại hoặc tự nhập nghĩa; bài làm được giữ nguyên.',
                    'Dictionary unavailable. Retry or enter a meaning; your work is unchanged.',
                  )}
        </p>
      )}
      {saved && (
        <p className="live-success" role="status">
          {t(
            'Đã lưu từ vào sổ riêng, kèm nguồn bài tập.',
            'Saved to your private notebook with the assignment source.',
          )}
        </p>
      )}
      <a href="#notebook">{t('Mở sổ từ vựng', 'Open vocabulary notebook')}</a>
    </aside>
  )
}
