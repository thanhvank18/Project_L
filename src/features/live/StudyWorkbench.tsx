import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { FloppyDisk, Highlighter, Trash } from '@phosphor-icons/react'
import type { Assignment } from '../../../shared/portal'
import type { StudyAnnotation, StudyWorkspace } from '../../../shared/study'
import { Attachments } from '@/features/live/Attachments'
import { WritingMap } from '@/features/live/WritingMap'
import { WorkspaceNotebook } from '@/features/live/WorkspaceNotebook'
import { ReadingToolbar } from '@/features/live/ReadingToolbar'
import { ReadingReviewContext } from '@/features/live/reading-review-context'
import { promptSegments } from '@/features/live/study-helpers'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import '@/styles/study-workspace.css'
import '@/styles/reading-workspace.css'

const emptyMap: StudyWorkspace['mindMap'] = { nodes: [], strokes: [] }
export function StudyWorkbench(
  props: LiveViewProps & {
    assignment: Assignment
    available: boolean
    onDirtyChange: (dirty: boolean) => void
    onPromptVersionChange: (version: number) => void
    children: ReactNode
  },
) {
  const {
    state,
    locale,
    run,
    refresh,
    assignment,
    available,
    onDirtyChange,
    onPromptVersionChange,
    children,
  } = props
  const [snapshot, setSnapshot] = useState(assignment)
  const original = state.studyWorkspaces.find(
    (item) => item.assignmentId === snapshot.id && item.assignmentVersion === snapshot.version,
  )
  const [annotations, setAnnotations] = useState(original?.annotations ?? [])
  const [mindMap, setMindMap] = useState(original?.mindMap ?? emptyMap)
  const [flagged, setFlagged] = useState(original?.readingReview?.flaggedQuestionIds ?? [])
  const [version, setVersion] = useState(original?.version ?? 0)
  const [saved, setSaved] = useState(
    JSON.stringify([
      original?.annotations ?? [],
      original?.mindMap ?? emptyMap,
      original?.readingReview?.flaggedQuestionIds ?? [],
    ]),
  )
  const [selection, setSelection] = useState<Omit<StudyAnnotation, 'id' | 'note'> | null>(null)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [wordDirty, setWordDirty] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [replace, setReplace] = useState(false)
  const [toolPanel, setToolPanel] = useState<'notes' | 'dictionary' | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const openToolPanel = useCallback((panel: 'notes' | 'dictionary' | null) => {
    setToolPanel(panel)
    setFocusRequest((value) => value + 1)
  }, [])
  const [readingSize, setReadingSize] = useState('medium')
  const [comfortable, setComfortable] = useState(false)
  const [split, setSplit] = useState(50)
  const passage = useRef<HTMLDivElement>(null)
  const notesPanel = useRef<HTMLElement>(null)
  const dictionaryPanel = useRef<HTMLDivElement>(null)
  const divider = useRef<HTMLDivElement>(null)
  const dragPointer = useRef<number | null>(null)
  const [noteToFocus, setNoteToFocus] = useState<string | null>(null)
  const saving = useRef(false)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const text = snapshot.instructions[locale]
  const current = JSON.stringify([annotations, mindMap, flagged])
  const dirty = current !== saved
  const changed = snapshot.version !== assignment.version
  const conflict = (original?.version ?? 0) > version
  const canAnnotate = ['reading', 'listening'].includes(snapshot.skill)
  const readingMode = canAnnotate
  const writingMode = snapshot.skill === 'writing'
  const locked = !available || changed || conflict
  const highlight = useCallback(() => {
    if (locked || busy || !selection || selection.locale !== locale || annotations.length >= 80)
      return
    setAnnotations((items) =>
      items.some(
        (item) =>
          item.locale === locale && item.start === selection.start && item.end === selection.end,
      )
        ? items
        : [...items, { ...selection, id: crypto.randomUUID(), note: '' }],
    )
    setSelection(null)
    setStatus('')
  }, [locked, busy, selection, locale, annotations.length, setAnnotations])
  const addNote = useCallback(() => {
    openToolPanel('notes')
    if (locked || busy || !selection || selection.locale !== locale) return
    const existing = annotations.find(
      (item) =>
        item.locale === locale && item.start === selection.start && item.end === selection.end,
    )
    if (!existing && annotations.length >= 80) return
    const id = existing?.id ?? crypto.randomUUID()
    if (!existing) setAnnotations((items) => [...items, { ...selection, id, note: '' }])
    setNoteToFocus(id)
    setSelection(null)
    setStatus('')
  }, [locked, busy, selection, locale, annotations, openToolPanel, setAnnotations])
  useEffect(() => {
    if (!toolPanel) return
    const panel = toolPanel === 'notes' ? notesPanel.current : dictionaryPanel.current
    const target =
      toolPanel === 'notes' && noteToFocus
        ? panel?.querySelector<HTMLTextAreaElement>(`[data-note-id="${noteToFocus}"]`)
        : panel?.querySelector<HTMLInputElement>('input')
    const input = target ?? panel?.querySelector<HTMLInputElement>('input')
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [toolPanel, noteToFocus, focusRequest])
  useEffect(() => {
    const release = () => {
      const pointer = dragPointer.current
      if (pointer !== null && divider.current?.hasPointerCapture(pointer))
        divider.current.releasePointerCapture(pointer)
      dragPointer.current = null
    }
    window.addEventListener('blur', release)
    return () => window.removeEventListener('blur', release)
  }, [])
  useEffect(() => {
    if (!readingMode) return
    const shortcut = (event: KeyboardEvent) => {
      if (
        !passage.current?.contains(document.activeElement) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest('input, textarea, select, [contenteditable="true"]'))
      )
        return
      if (!selection || selection.locale !== locale) return
      if (event.key.toLowerCase() === 'h') {
        event.preventDefault()
        highlight()
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        addNote()
      }
      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        openToolPanel('dictionary')
      }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [readingMode, selection, locale, highlight, addNote, openToolPanel])
  useEffect(() => {
    onDirtyChange(dirty || wordDirty || drawing || busy)
  }, [dirty, wordDirty, drawing, busy, onDirtyChange])
  const save = useCallback(async () => {
    if (saving.current || locked || drawing) return
    saving.current = true
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const response = await run('study.save', {
        assignmentId: snapshot.id,
        assignmentVersion: snapshot.version,
        expectedVersion: version,
        annotations,
        mindMap,
        ...(snapshot.reading && readingMode
          ? { readingReview: { flaggedQuestionIds: flagged } }
          : {}),
      })
      const stored = response.state.studyWorkspaces.find(
        (item) => item.assignmentId === snapshot.id && item.assignmentVersion === snapshot.version,
      )
      if (!stored) throw new Error('missing-study-workspace')
      setVersion(stored.version)
      setSaved(current)
      setStatus(
        locale === 'vi'
          ? 'Đã lưu ghi chú, ý tưởng và cờ xem lại trên máy chủ.'
          : 'Notes, plans and review flags saved to the server.',
      )
    } catch (failure) {
      setError(errorMessage(failure, locale))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }, [
    run,
    snapshot.id,
    snapshot.version,
    version,
    annotations,
    mindMap,
    flagged,
    readingMode,
    snapshot.reading,
    current,
    locale,
    locked,
    drawing,
    setVersion,
  ])
  useEffect(() => {
    if (!dirty || locked || busy || drawing || error || snapshot.skill === 'speaking') return
    const timer = window.setTimeout(() => void save(), 5000)
    return () => window.clearTimeout(timer)
  }, [dirty, locked, busy, drawing, error, save, snapshot.skill])
  useEffect(() => {
    const captureSelection = () => {
      const selected = window.getSelection()
      const element = passage.current
      if (!selected || !selected.rangeCount || !element) return
      const range = selected.getRangeAt(0)
      if (
        !element.contains(range.startContainer) ||
        !element.contains(range.endContainer) ||
        range.collapsed
      )
        return
      const preceding = range.cloneRange()
      preceding.selectNodeContents(element)
      preceding.setEnd(range.startContainer, range.startOffset)
      const start = preceding.toString().length
      const quote = range.toString()
      if (quote.length > 2000 || !quote.trim()) return
      setSelection({ locale, start, end: start + quote.length, quote })
    }
    document.addEventListener('selectionchange', captureSelection)
    return () => document.removeEventListener('selectionchange', captureSelection)
  }, [locale])
  const load = (nextAssignment: Assignment) => {
    if (saving.current || drawing) return
    const stored = state.studyWorkspaces.find(
      (item) =>
        item.assignmentId === nextAssignment.id &&
        item.assignmentVersion === nextAssignment.version,
    )
    setSnapshot(nextAssignment)
    setAnnotations(stored?.annotations ?? [])
    setMindMap(stored?.mindMap ?? emptyMap)
    setFlagged(stored?.readingReview?.flaggedQuestionIds ?? [])
    setVersion(stored?.version ?? 0)
    setSaved(
      JSON.stringify([
        stored?.annotations ?? [],
        stored?.mindMap ?? emptyMap,
        stored?.readingReview?.flaggedQuestionIds ?? [],
      ]),
    )
    setError('')
    setStatus('')
    setSelection(null)
    setNoteToFocus(null)
    setReplace(false)
    setQuoteSearch('')
    onPromptVersionChange(nextAssignment.version)
  }
  const annotationTools = canAnnotate && (
    <div className="mis-stack study-annotations">
      <p className="live-help">
        {t(
          'Chọn đoạn trong đề để tô sáng, hoặc nhập chính xác đoạn cần đánh dấu bên dưới.',
          'Select prompt text to highlight, or enter the exact passage below.',
        )}
      </p>
      <label className="mis-field">
        {t('Đoạn cần đánh dấu', 'Passage to highlight')}
        <input
          value={quoteSearch}
          maxLength={2000}
          onChange={(event) => setQuoteSearch(event.target.value)}
        />
      </label>
      <button
        className="mis-button"
        disabled={!quoteSearch.trim()}
        onClick={() => {
          const start = text.indexOf(
            quoteSearch,
            selection?.locale === locale && selection.quote === quoteSearch
              ? selection.start + 1
              : 0,
          )
          const found = start >= 0 ? start : text.indexOf(quoteSearch)
          if (found >= 0) {
            setSelection({
              locale,
              start: found,
              end: found + quoteSearch.length,
              quote: quoteSearch,
            })
            setStatus('')
          } else {
            setSelection(null)
            setStatus(
              t(
                'Không thấy đoạn này trong đề đang đọc.',
                'This passage was not found in the current prompt.',
              ),
            )
          }
        }}
      >
        {t('Tìm đoạn / vị trí tiếp theo', 'Find passage / next occurrence')}
      </button>
      {selection?.locale === locale && (
        <blockquote className="study-selection">{selection.quote}</blockquote>
      )}
      <button
        className="mis-button"
        disabled={
          locked || busy || !selection || selection.locale !== locale || annotations.length >= 80
        }
        onClick={highlight}
      >
        <Highlighter size={18} aria-hidden="true" />
        {t('Tô sáng đoạn đã chọn', 'Highlight selection')}
      </button>
      {annotations
        .filter((item) => item.locale === locale)
        .map((item, index) => (
          <div className="study-annotation" key={item.id}>
            <blockquote>{item.quote}</blockquote>
            <label className="mis-field">
              {t('Ghi chú cho đoạn', 'Note for passage')} {index + 1}
              <textarea
                data-note-id={item.id}
                rows={2}
                maxLength={1000}
                disabled={locked}
                value={item.note}
                onChange={(event) => {
                  setAnnotations(
                    annotations.map((mark) =>
                      mark.id === item.id ? { ...mark, note: event.target.value } : mark,
                    ),
                  )
                  setStatus('')
                }}
              />
            </label>
            <button
              className="study-text-button"
              disabled={locked || busy}
              onClick={() => setAnnotations(annotations.filter((mark) => mark.id !== item.id))}
            >
              <Trash size={16} aria-hidden="true" />
              {t('Bỏ đánh dấu', 'Remove highlight')}
            </button>
          </div>
        ))}
    </div>
  )
  return (
    <>
      {readingMode && (
        <ReadingToolbar
          locale={locale}
          panel={toolPanel}
          onPanel={openToolPanel}
          size={readingSize}
          onSize={setReadingSize}
          comfortable={comfortable}
          onComfortable={setComfortable}
        />
      )}
      <div
        className={`study-layout ${readingMode ? 'reading-layout' : ''} ${writingMode ? 'writing-layout' : ''} ${readingMode && toolPanel ? 'reading-tools-open' : ''}`}
        data-reading-size={readingSize}
        data-comfortable={comfortable}
        style={readingMode ? ({ '--reading-split': `${split}%` } as CSSProperties) : undefined}
      >
        <section className="mis-panel mis-stack study-prompt">
          <h2>{snapshot.title[locale]}</h2>
          <p className="live-help">
            {t('Đề bài', 'Prompt')} · v{snapshot.version} ·{' '}
            {snapshot.dueAt
              ? new Date(snapshot.dueAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : t('Không có hạn nộp', 'No deadline')}
          </p>
          {readingMode && (
            <div className="reading-passage-tools">
              <button
                type="button"
                className="mis-button"
                disabled={
                  locked ||
                  busy ||
                  !selection ||
                  selection.locale !== locale ||
                  annotations.length >= 80
                }
                onClick={highlight}
              >
                <Highlighter size={17} aria-hidden="true" />
                {t('Tô sáng', 'Highlight')} <kbd>H</kbd>
              </button>
              <button type="button" className="study-text-button" onClick={addNote}>
                {t('Ghi chú', 'Notes')} <kbd>N</kbd>
              </button>
              <button
                type="button"
                className="study-text-button"
                onClick={() => openToolPanel('dictionary')}
              >
                {t('Tra từ', 'Dictionary')} <kbd>T</kbd>
              </button>
              <span className="live-help">
                {selection?.locale === locale
                  ? t('Đã chọn đoạn văn', 'Text selected')
                  : t(
                      'Chọn chữ trong đề bài để dùng phím tắt.',
                      'Select prompt text to use shortcuts.',
                    )}
              </span>
            </div>
          )}
          {changed && (
            <div className="study-alert">
              <p role="alert">
                {t(
                  'Đề đã đổi. Đang giữ bản cũ để bảo toàn ghi chú. Chuyển sang đề mới sẽ mở bộ ghi chú riêng.',
                  'The prompt changed. This older version preserves your notes. Opening the new prompt starts its own notes.',
                )}
              </p>
              <button
                className="mis-button"
                disabled={busy || drawing}
                onClick={() => {
                  if (dirty && !replace) setReplace(true)
                  else load(assignment)
                }}
              >
                {replace
                  ? t(
                      'Bỏ ghi chú chưa lưu và mở đề mới',
                      'Discard unsaved notes and open new prompt',
                    )
                  : t('Mở đề mới', 'Open updated prompt')}
              </button>
              {replace && (
                <button className="study-text-button" onClick={() => setReplace(false)}>
                  {t('Giữ nội dung đang nhập', 'Keep my input')}
                </button>
              )}
            </div>
          )}
          {/* Keyboard focus lets readers select and navigate the passage without a pointer. */}
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
          <div
            ref={passage}
            className="live-prose study-passage"
            role="region"
            tabIndex={0}
            aria-label={t('Nội dung đề bài', 'Prompt text')}
          >
            {promptSegments(text, annotations, locale).map((part) =>
              part.highlighted ? (
                <mark key={part.start}>{part.text}</mark>
              ) : (
                <span key={part.start}>{part.text}</span>
              ),
            )}
          </div>
          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
          <Attachments
            state={state}
            locale={locale}
            classId={assignment.classId}
            purpose="material"
            value={snapshot.attachmentIds}
            readOnly
            inlinePreview
          />
          {!readingMode && annotationTools}
        </section>
        {/* A focusable separator with aria-valuenow implements a keyboard-operable window splitter. */}
        {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        {readingMode && (
          <div
            ref={divider}
            className="reading-divider"
            role="separator"
            aria-label={t('Điều chỉnh độ rộng đề bài', 'Resize prompt width')}
            aria-orientation="vertical"
            aria-valuenow={split}
            aria-valuemin={35}
            aria-valuemax={65}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                setSplit((value) =>
                  Math.max(35, Math.min(65, value + (event.key === 'ArrowRight' ? 5 : -5))),
                )
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary || dragPointer.current !== null) return
              dragPointer.current = event.pointerId
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (
                dragPointer.current === event.pointerId &&
                event.currentTarget.hasPointerCapture(event.pointerId)
              ) {
                const rect = event.currentTarget.parentElement?.getBoundingClientRect()
                if (rect)
                  setSplit(
                    Math.max(35, Math.min(65, ((event.clientX - rect.left) / rect.width) * 100)),
                  )
              }
            }}
            onPointerUp={(event) => {
              if (dragPointer.current !== event.pointerId) return
              dragPointer.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={(event) => {
              if (dragPointer.current !== event.pointerId) return
              dragPointer.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onLostPointerCapture={(event) => {
              if (dragPointer.current === event.pointerId) dragPointer.current = null
            }}
          >
            <span />
          </div>
        )}
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div className="study-response">
          <ReadingReviewContext.Provider
            value={{
              assignmentVersion: snapshot.version,
              flagged,
              disabled: locked || busy,
              onChange: (value) => {
                setFlagged(value)
                setStatus('')
              },
            }}
          >
            {children}
          </ReadingReviewContext.Provider>
          {writingMode && (
            <WritingMap
              value={mindMap}
              locale={locale}
              disabled={locked || busy}
              onChange={(value) => {
                setMindMap(value)
                setStatus('')
              }}
              onDrawingChange={setDrawing}
            />
          )}
        </div>
        {readingMode && (
          <aside
            ref={notesPanel}
            className="mis-panel mis-stack reading-note-panel"
            hidden={toolPanel !== 'notes'}
            aria-label={t('Ghi chú đề bài', 'Prompt notes')}
          >
            <h2>{t('Ghi chú riêng', 'Private notes')}</h2>
            {annotationTools}
          </aside>
        )}
        <div
          ref={dictionaryPanel}
          className={readingMode ? 'reading-notebook-panel' : 'study-notebook-host'}
          hidden={readingMode && toolPanel !== 'dictionary'}
        >
          <WorkspaceNotebook
            {...props}
            assignment={snapshot}
            available={available && !changed}
            onDirtyChange={setWordDirty}
            selectedText={selection?.locale === locale ? selection.quote : ''}
          />
        </div>
      </div>
      {snapshot.skill !== 'speaking' && (
        <div className="study-savebar mis-stack">
          {conflict && (
            <div className="study-alert">
              <p role="alert">
                {t(
                  'Ghi chú đã được sửa ở nơi khác. Nội dung đang nhập được giữ; sao chép trước khi tải bản trên máy chủ.',
                  'Notes changed elsewhere. Your input is kept; copy it before loading the server version.',
                )}
              </p>
              <button
                className="mis-button"
                disabled={busy || drawing}
                onClick={() => {
                  if (dirty && !replace) setReplace(true)
                  else load(snapshot)
                }}
              >
                {replace
                  ? t('Bỏ thay đổi và tải bản máy chủ', 'Discard edits and load server version')
                  : t('Tải ghi chú trên máy chủ', 'Load server notes')}
              </button>
              {replace && (
                <button className="study-text-button" onClick={() => setReplace(false)}>
                  {t('Giữ nội dung đang nhập', 'Keep my input')}
                </button>
              )}
            </div>
          )}
          <div className="live-actions">
            <button
              className="mis-button"
              disabled={locked || busy || drawing || !dirty}
              onClick={() => void save()}
            >
              <FloppyDisk size={18} aria-hidden="true" />
              {busy
                ? t('Đang lưu…', 'Saving…')
                : readingMode
                  ? t('Lưu ghi chú & cờ xem lại', 'Save notes & review flags')
                  : t('Lưu ghi chú & ý tưởng', 'Save notes & plans')}
            </button>
            <span className="live-help" role="status">
              {busy
                ? t('Đang lưu trên máy chủ…', 'Saving to server…')
                : dirty
                  ? error || locked || drawing
                    ? t(
                        'Tự lưu đã dừng. Thử lưu lại khi sẵn sàng.',
                        'Autosave paused. Retry saving when ready.',
                      )
                    : t(
                        'Chưa lưu · tự lưu sau 5 giây ngừng chỉnh sửa.',
                        'Unsaved · autosaves after 5 seconds of inactivity.',
                      )
                  : readingMode
                    ? t('Ghi chú & cờ xem lại đã đồng bộ.', 'Notes & review flags are up to date.')
                    : t('Ghi chú & ý tưởng đã đồng bộ.', 'Notes & plans are up to date.')}
            </span>
          </div>
          {error && (
            <div>
              <p className="mis-error" role="alert">
                {error}
              </p>
              <button
                className="study-text-button"
                onClick={() =>
                  void refresh().catch((failure) => setError(errorMessage(failure, locale)))
                }
              >
                {t('Kiểm tra dữ liệu mới', 'Check for updates')}
              </button>
            </div>
          )}
          {status && (
            <p role="status" className="live-help">
              {status}
            </p>
          )}
          {state.studyWorkspaces.some(
            (item) =>
              item.assignmentId === assignment.id && item.assignmentVersion !== snapshot.version,
          ) && (
            <details>
              <summary>
                {t('Ghi chú của phiên bản đề khác', 'Notes from other prompt versions')}
              </summary>
              {state.studyWorkspaces
                .filter(
                  (item) =>
                    item.assignmentId === assignment.id &&
                    item.assignmentVersion !== snapshot.version,
                )
                .map((item) => (
                  <div className="study-history" key={item.id}>
                    <h3>
                      {t('Phiên bản đề', 'Prompt version')} {item.assignmentVersion}
                    </h3>
                    {item.annotations.map((note) => (
                      <div key={note.id}>
                        <blockquote>{note.quote}</blockquote>
                        <p className="live-prose">{note.note}</p>
                      </div>
                    ))}
                    {item.mindMap.nodes.length + item.mindMap.strokes.length > 0 && (
                      <WritingMap
                        value={item.mindMap}
                        locale={locale}
                        disabled
                        onChange={() => undefined}
                      />
                    )}
                  </div>
                ))}
            </details>
          )}
        </div>
      )}
    </>
  )
}
