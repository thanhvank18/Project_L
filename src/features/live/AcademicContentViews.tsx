/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The labeled table regions support keyboard scrolling. */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, MagnifyingGlass, PencilSimple, Plus, X } from '@phosphor-icons/react'
import type { Assignment, Attendance, Material, Skill, Unit } from '../../../shared/portal'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { Attachments } from '@/features/live/Attachments'
import { ReadingEditor } from '@/features/live/ReadingEditor'
import { ReadingResponseSummary } from '@/features/live/ReadingResponseSummary'
import { TeacherGuidePanel } from '@/features/live/TeacherGuidePanel'
import { newReadingDefinition, readingEditorError } from '@/features/live/reading-authoring'
import '@/styles/live-administration.css'

type Section = 'assignments' | 'materials' | 'syllabus' | 'attendance' | 'notifications'
type ContentSection = 'assignments' | 'materials' | 'syllabus'
type ContentRecord = Assignment | Material | Unit
const tx = (vi: boolean, vietnamese: string, english: string) => (vi ? vietnamese : english)
const skillName = (skill: Skill, vi: boolean) =>
  ({
    reading: tx(vi, 'Đọc', 'Reading'),
    writing: tx(vi, 'Viết', 'Writing'),
    listening: tx(vi, 'Nghe', 'Listening'),
    speaking: tx(vi, 'Nói', 'Speaking'),
  })[skill]
const className = (props: LiveViewProps, id: string) =>
  props.state.classes.find((value) => value.id === id)?.title ?? id
function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
function localTime(iso: string) {
  if (!iso) return ''
  const value = new Date(iso)
  return `${localDate(value)}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}
function displayDate(iso: string, locale: 'vi' | 'en') {
  return iso
    ? new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    : tx(locale === 'vi', 'Chưa đặt hạn', 'No deadline')
}

function useMutation(props: LiveViewProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function execute(type: string, payload: Record<string, unknown>, onSaved?: () => void) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await props.run(type, payload)
      onSaved?.()
    } catch (cause) {
      setError(errorMessage(cause, props.locale))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return { busy, error, execute }
}

function ClassSelect({
  props,
  value,
  onChange,
  all = false,
  required = false,
  disabled = false,
}: {
  props: LiveViewProps
  value: string
  onChange: (id: string) => void
  all?: boolean
  required?: boolean
  disabled?: boolean
}) {
  const vi = props.locale === 'vi'
  return (
    <label className="mis-field live-filter">
      {tx(vi, 'Lớp học', 'Class')}
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {all ? tx(vi, 'Tất cả lớp', 'All classes') : tx(vi, 'Chọn lớp', 'Choose a class')}
        </option>
        {props.state.classes.map((value) => (
          <option key={value.id} value={value.id}>
            {value.title}
            {!value.active ? ` · ${tx(vi, 'Đã đóng', 'Closed')}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function EditorFrame({
  title,
  busy,
  error,
  vi,
  onClose,
  onSubmit,
  children,
  submitText,
  disabledSubmit = false,
}: {
  title: string
  busy: boolean
  error: string
  vi: boolean
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  children: ReactNode
  submitText?: string
  disabledSubmit?: boolean
}) {
  return (
    <form className="mis-panel live-editor" onSubmit={onSubmit}>
      <div className="live-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="mis-button"
          disabled={busy}
          onClick={onClose}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <fieldset className="live-fieldset" disabled={busy}>
        {children}
        <div className="live-actions">
          <button type="submit" className="mis-button mis-primary" disabled={disabledSubmit}>
            {busy
              ? tx(vi, 'Đang lưu…', 'Saving…')
              : (submitText ?? tx(vi, 'Lưu thay đổi', 'Save changes'))}
          </button>
          <button type="button" className="mis-button" onClick={onClose}>
            {tx(vi, 'Hủy', 'Cancel')}
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function ContentEditor({
  props,
  section,
  record,
  defaultClass,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  section: ContentSection
  record: ContentRecord | null
  defaultClass: string
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const assignment = record && 'skill' in record ? record : null
  const material = record && 'content' in record ? record : null
  const unit = record && 'completed' in record ? record : null
  const initialTitle = assignment?.title ?? unit?.title ?? { vi: '', en: '' }
  const [classId, setClassId] = useState(record?.classId ?? defaultClass ?? '')
  const [titleVi, setTitleVi] = useState(initialTitle.vi)
  const [titleEn, setTitleEn] = useState(initialTitle.en)
  const [title, setTitle] = useState(material?.title ?? '')
  const [instructionsVi, setInstructionsVi] = useState(assignment?.instructions.vi ?? '')
  const [instructionsEn, setInstructionsEn] = useState(assignment?.instructions.en ?? '')
  const [content, setContent] = useState(material?.content ?? '')
  const [skill, setSkill] = useState<Skill>(assignment?.skill ?? 'reading')
  const [readingEnabled, setReadingEnabled] = useState(Boolean(assignment?.reading))
  const [reading, setReading] = useState(() => assignment?.reading ?? newReadingDefinition())
  const [pasteRestricted, setPasteRestricted] = useState(assignment?.pasteRestricted ?? false)
  const [dueAt, setDueAt] = useState(localTime(assignment?.dueAt ?? ''))
  const [published, setPublished] = useState(assignment?.published ?? material?.published ?? false)
  const [required, setRequired] = useState(assignment?.required ?? false)
  const [completed, setCompleted] = useState(unit?.completed ?? false)
  const [attachmentIds, setAttachmentIds] = useState(
    assignment?.attachmentIds ?? material?.attachmentIds ?? [],
  )
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [baselineVersion, setBaselineVersion] = useState(record?.version ?? 0)
  const [validationError, setValidationError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const mutation = useMutation(props)
  const records =
    section === 'assignments'
      ? props.state.assignments
      : section === 'materials'
        ? props.state.materials
        : props.state.units
  const latest = record ? records.find((item) => item.id === record.id) : undefined
  const room = props.state.classes.find((item) => item.id === classId)
  const available =
    props.state.user.active &&
    (props.state.user.role === 'admin' || props.state.user.role === 'teacher') &&
    (!record || Boolean(latest)) &&
    (!classId ||
      Boolean(
        room?.active &&
        (props.state.user.role === 'admin' || room.teacherIds.includes(props.state.user.id)),
      ))
  const changed = Boolean(record && latest && latest.version !== baselineVersion)
  const currentInput = JSON.stringify([
    classId,
    titleVi,
    titleEn,
    title,
    instructionsVi,
    instructionsEn,
    content,
    skill,
    readingEnabled,
    reading,
    pasteRestricted,
    dueAt,
    published,
    required,
    completed,
    attachmentIds,
  ])
  const [initialInput] = useState(currentInput)
  const dirty = initialInput !== currentInput
  useEffect(() => {
    if (!dirty && !mutation.busy && !attachmentBusy) return
    const allow = () =>
      !mutation.busy &&
      !attachmentBusy &&
      window.confirm(
        tx(vi, 'Rời biểu mẫu và bỏ nội dung chưa lưu?', 'Leave and discard unsaved content?'),
      )
    const leave = (event: Event) => {
      if (!allow()) event.preventDefault()
    }
    const unload = (event: BeforeUnloadEvent) => event.preventDefault()
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest('a[href], .mis-signout') : null
      if (
        !target ||
        target.getAttribute('href')?.startsWith('#') ||
        target.hasAttribute('download')
      )
        return
      if (!allow()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('project-l:before-leave', leave)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('project-l:before-leave', leave)
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
    }
  }, [dirty, mutation.busy, attachmentBusy, vi])
  const close = () => {
    if (mutation.busy || attachmentBusy) return
    if (
      !dirty ||
      window.confirm(tx(vi, 'Đóng và bỏ nội dung chưa lưu?', 'Close and discard unsaved content?'))
    )
      onClose()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (attachmentBusy || mutation.busy || refreshing || !available || changed) return
    const error =
      section === 'assignments' && (skill === 'reading' || skill === 'listening') && readingEnabled
        ? readingEditorError(reading, props.locale)
        : ''
    setValidationError(error)
    if (error) return
    const common = { id: record?.id, expectedVersion: baselineVersion, classId }
    const payload =
      section === 'assignments'
        ? {
            ...common,
            title: { vi: titleVi.trim(), en: titleEn.trim() },
            instructions: { vi: instructionsVi.trim(), en: instructionsEn.trim() },
            skill,
            reading:
              (skill === 'reading' || skill === 'listening') && readingEnabled ? reading : null,
            pasteRestricted: skill === 'writing' && pasteRestricted,
            dueAt: dueAt ? new Date(dueAt).toISOString() : '',
            published,
            required,
            attachmentIds,
          }
        : section === 'materials'
          ? {
              ...common,
              title: title.trim(),
              content: content.trim(),
              published,
              attachmentIds,
            }
          : { ...common, title: { vi: titleVi.trim(), en: titleEn.trim() }, completed }
    await mutation.execute(
      section === 'assignments'
        ? 'assignment.save'
        : section === 'materials'
          ? 'material.save'
          : 'unit.save',
      payload,
      onSaved,
    )
  }
  return (
    <EditorFrame
      title={
        section === 'assignments'
          ? record
            ? tx(vi, 'Chỉnh sửa bài tập', 'Edit assignment')
            : tx(vi, 'Tạo bài tập', 'Create assignment')
          : section === 'materials'
            ? record
              ? tx(vi, 'Chỉnh sửa tài liệu', 'Edit material')
              : tx(vi, 'Thêm tài liệu', 'Add material')
            : record
              ? tx(vi, 'Chỉnh sửa nội dung học', 'Edit syllabus unit')
              : tx(vi, 'Thêm nội dung học', 'Add syllabus unit')
      }
      vi={vi}
      busy={mutation.busy || attachmentBusy}
      error={validationError || mutation.error}
      onClose={close}
      onSubmit={submit}
      disabledSubmit={!available || changed || refreshing}
    >
      {!available && (
        <p className="live-error" role="alert">
          {tx(
            vi,
            'Nội dung hoặc quyền chỉnh sửa không còn khả dụng. Nội dung đang nhập vẫn được giữ để bạn sao chép.',
            'This content or your editing access is no longer available. Your input is kept for copying.',
          )}
        </p>
      )}
      {changed && latest && (
        <div className="mis-notice" role="status">
          <p>
            {tx(
              vi,
              'Nội dung đã thay đổi ở nơi khác. Kiểm tra bản đang lưu trước khi tiếp tục; nội dung bạn nhập vẫn được giữ.',
              'This content changed elsewhere. Check the saved version before continuing; your input is kept.',
            )}
          </p>
          <details>
            <summary>{tx(vi, 'Xem nội dung đang lưu', 'View saved content')}</summary>
            <p>
              {typeof latest.title === 'string' ? latest.title : latest.title[props.locale]} · v
              {latest.version}
            </p>
            {'instructions' in latest && (
              <p className="live-prose">{latest.instructions[props.locale]}</p>
            )}
            {'skill' in latest && latest.skill === 'writing' && (
              <p>
                {latest.pasteRestricted
                  ? tx(vi, 'Hạn chế dán/kéo thả: bật', 'Paste/drop restriction: on')
                  : tx(vi, 'Hạn chế dán/kéo thả: tắt', 'Paste/drop restriction: off')}
              </p>
            )}
            {'reading' in latest && latest.reading && (
              <ReadingResponseSummary
                definition={latest.reading}
                answers={{}}
                locale={props.locale}
              />
            )}
          </details>
          <button
            className="mis-button"
            type="button"
            disabled={mutation.busy || attachmentBusy || !available}
            onClick={() => {
              setBaselineVersion(latest.version)
              setValidationError('')
            }}
          >
            {tx(
              vi,
              'Giữ nội dung nhập và dùng phiên bản mới',
              'Keep my input and use the latest version',
            )}
          </button>
        </div>
      )}
      {(mutation.error || !available || changed) && (
        <button
          className="mis-button"
          type="button"
          disabled={mutation.busy || attachmentBusy || refreshing}
          onClick={async () => {
            setRefreshing(true)
            try {
              await props.refresh()
            } catch (failure) {
              setValidationError(errorMessage(failure, props.locale))
            } finally {
              setRefreshing(false)
            }
          }}
        >
          {refreshing
            ? tx(vi, 'Đang kiểm tra…', 'Checking…')
            : tx(vi, 'Kiểm tra dữ liệu mới', 'Check for updates')}
        </button>
      )}
      <div className="live-form-grid">
        <ClassSelect
          props={props}
          value={classId}
          onChange={setClassId}
          required
          disabled={!!record || attachmentIds.length > 0}
        />
        {section === 'assignments' && (
          <label className="mis-field">
            {tx(vi, 'Kỹ năng', 'Skill')}
            <select value={skill} onChange={(event) => setSkill(event.target.value as Skill)}>
              {(['reading', 'writing', 'listening', 'speaking'] as Skill[]).map((value) => (
                <option key={value} value={value}>
                  {skillName(value, vi)}
                </option>
              ))}
            </select>
          </label>
        )}
        {section === 'materials' ? (
          <>
            <label className="mis-field">
              {tx(vi, 'Tiêu đề', 'Title')}
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="mis-field live-wide">
              {tx(vi, 'Nội dung tài liệu', 'Material content')}
              <textarea
                required={!attachmentIds.length}
                rows={8}
                maxLength={30000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="mis-field">
              {tx(vi, 'Tiêu đề tiếng Việt', 'Vietnamese title')}
              <input
                required
                lang="vi"
                maxLength={200}
                value={titleVi}
                onChange={(event) => setTitleVi(event.target.value)}
              />
            </label>
            <label className="mis-field">
              {tx(vi, 'Tiêu đề tiếng Anh', 'English title')}
              <input
                required
                lang="en"
                maxLength={200}
                value={titleEn}
                onChange={(event) => setTitleEn(event.target.value)}
              />
            </label>
          </>
        )}
        {section === 'assignments' && (
          <>
            <label className="mis-field">
              {skill === 'reading'
                ? tx(vi, 'Bài đọc tiếng Việt', 'Vietnamese passage')
                : tx(vi, 'Hướng dẫn tiếng Việt', 'Vietnamese instructions')}
              <textarea
                required
                lang="vi"
                rows={7}
                maxLength={20000}
                value={instructionsVi}
                onChange={(event) => setInstructionsVi(event.target.value)}
              />
            </label>
            <label className="mis-field">
              {skill === 'reading'
                ? tx(vi, 'Bài đọc tiếng Anh', 'English passage')
                : tx(vi, 'Hướng dẫn tiếng Anh', 'English instructions')}
              <textarea
                required
                lang="en"
                rows={7}
                maxLength={20000}
                value={instructionsEn}
                onChange={(event) => setInstructionsEn(event.target.value)}
              />
            </label>
            {(skill === 'reading' || skill === 'listening') && (
              <div className="live-wide mis-stack">
                <label className="live-check">
                  <input
                    type="checkbox"
                    checked={readingEnabled}
                    onChange={(event) => setReadingEnabled(event.target.checked)}
                  />
                  <span>
                    {tx(vi, 'Dùng nhóm câu hỏi', 'Use structured questions')}
                    <small>
                      {tx(
                        vi,
                        'Chọn một/nối đoạn, chọn nhiều và điền từ. Không tự chấm hoặc tạo đáp án.',
                        'Single/matching, multiple selections and short answers. No automatic grading or answer keys.',
                      )}
                    </small>
                  </span>
                </label>
                {readingEnabled ? (
                  <ReadingEditor value={reading} onChange={setReading} locale={props.locale} />
                ) : (
                  assignment?.reading && (
                    <p className="live-help">
                      {tx(
                        vi,
                        'Lưu khi tắt sẽ bỏ nhóm câu hỏi khỏi phiên bản đề mới. Các bản đã nộp vẫn giữ đề và câu trả lời cũ.',
                        'Saving with this off removes structured questions from the new assignment version. Earlier submissions retain their questions and responses.',
                      )}
                    </p>
                  )
                )}
              </div>
            )}
            {skill !== 'reading' && skill !== 'listening' && readingEnabled && (
              <p className="live-help live-wide">
                {tx(
                  vi,
                  'Nhóm câu hỏi chỉ được lưu cho kỹ năng Đọc hoặc Nghe. Chọn lại một trong hai kỹ năng để tiếp tục sửa nhóm câu hỏi đang nhập.',
                  'Structured questions are saved for Reading or Listening only. Switch back to either skill to continue editing your question draft.',
                )}
              </p>
            )}
            {skill === 'writing' && (
              <label className="live-check live-wide">
                <input
                  type="checkbox"
                  checked={pasteRestricted}
                  onChange={(event) => setPasteRestricted(event.target.checked)}
                />
                <span>
                  {tx(
                    vi,
                    'Hạn chế dán và kéo thả vào bài viết',
                    'Restrict pasting and dropping into the essay',
                  )}
                  <small>
                    {tx(
                      vi,
                      'Chặn dán và kéo thả vào ô bài viết; học viên vẫn có thể sao chép nội dung ra ngoài để khôi phục khi cần. Đây là hỗ trợ luyện viết trong trình duyệt, không xác minh tác giả hoặc chống gian lận.',
                      'Blocks pasting and dropping into the essay field; students can still copy their writing out for recovery. This browser practice aid does not verify authorship or prevent cheating.',
                    )}
                  </small>
                </span>
              </label>
            )}
            <label className="mis-field">
              {tx(vi, 'Hạn nộp theo giờ thiết bị', 'Deadline in your device time zone')}
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
          </>
        )}
        <div className="live-check-group live-wide">
          {section !== 'syllabus' && (
            <label className="live-check">
              <input
                type="checkbox"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
              />
              {tx(vi, 'Xuất bản cho học viên', 'Publish to students')}
            </label>
          )}
          {section === 'assignments' && (
            <label className="live-check">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
              />
              {tx(
                vi,
                'Bắt buộc nộp trước khi tham gia tư vấn',
                'Required before joining a consultation',
              )}
            </label>
          )}
          {section === 'syllabus' && (
            <label className="live-check">
              <input
                type="checkbox"
                checked={completed}
                onChange={(event) => setCompleted(event.target.checked)}
              />
              {tx(vi, 'Đã hoàn thành nội dung', 'Unit completed')}
            </label>
          )}
        </div>
        {section !== 'syllabus' && (
          <div className="live-wide">
            <Attachments
              state={props.state}
              locale={props.locale}
              classId={classId}
              purpose="material"
              value={attachmentIds}
              onChange={setAttachmentIds}
              onBusyChange={setAttachmentBusy}
            />
          </div>
        )}
      </div>
    </EditorFrame>
  )
}

function ContentList({
  props,
  section,
  onAssignment,
}: {
  props: LiveViewProps
  section: ContentSection
  onAssignment?: (id: string) => void
}) {
  const vi = props.locale === 'vi'
  const canEdit = props.state.user.role === 'admin' || props.state.user.role === 'teacher'
  const student = props.state.user.role === 'student'
  const [query, setQuery] = useState('')
  const [classId, setClassId] = useState('')
  const [skill, setSkill] = useState('')
  const [editor, setEditor] = useState<ContentRecord | null | undefined>()
  const [message, setMessage] = useState('')
  const title =
    section === 'assignments'
      ? tx(vi, 'Bài tập', 'Assignments')
      : section === 'materials'
        ? tx(vi, 'Tài liệu học tập', 'Learning materials')
        : tx(vi, 'Nội dung học', 'Syllabus')
  const source =
    section === 'assignments'
      ? props.state.assignments
      : section === 'materials'
        ? props.state.materials
        : props.state.units
  const rows = source.filter(
    (value) =>
      (!classId || value.classId === classId) &&
      (!skill || ('skill' in value && value.skill === skill)) &&
      (typeof value.title === 'string' ? value.title : `${value.title.vi} ${value.title.en}`)
        .toLocaleLowerCase(props.locale)
        .includes(query.trim().toLocaleLowerCase(props.locale)),
  )
  function saved() {
    setEditor(undefined)
    setMessage(tx(vi, 'Đã lưu trên máy chủ.', 'Saved to the server.'))
  }
  return (
    <div className="live-admin">
      <div className="live-heading">
        <div>
          <p>
            {section === 'assignments'
              ? tx(
                  vi,
                  'Nội dung và tiến độ bài tập của các lớp học.',
                  'Assignment content and progress across your classes.',
                )
              : section === 'materials'
                ? tx(
                    vi,
                    'Tài liệu do giáo viên cung cấp cho lớp học.',
                    'Resources shared by your teaching team.',
                  )
                : tx(
                    vi,
                    'Theo dõi các nội dung đã học và sắp học trong lớp.',
                    'Follow completed and upcoming units in your classes.',
                  )}
          </p>
        </div>
        {canEdit && (
          <button
            className="mis-button mis-primary"
            disabled={editor !== undefined || !props.state.classes.length}
            onClick={() => {
              setMessage('')
              setEditor(null)
            }}
          >
            <Plus size={18} aria-hidden="true" />
            {section === 'assignments'
              ? tx(vi, 'Tạo bài tập', 'Create assignment')
              : section === 'materials'
                ? tx(vi, 'Thêm tài liệu', 'Add material')
                : tx(vi, 'Thêm nội dung', 'Add unit')}
          </button>
        )}
      </div>
      {message && (
        <p className="live-success" role="status">
          {message}
        </p>
      )}
      {editor !== undefined && (
        <ContentEditor
          key={editor?.id ?? 'new'}
          props={props}
          section={section}
          record={editor}
          defaultClass={classId || props.state.classes[0]?.id || ''}
          onClose={() => setEditor(undefined)}
          onSaved={saved}
        />
      )}
      <div className="live-toolbar">
        <label className="live-search">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input
            type="search"
            className="mis-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={tx(vi, 'Tìm theo tiêu đề', 'Search by title')}
            placeholder={tx(vi, 'Tìm theo tiêu đề…', 'Search by title…')}
          />
        </label>
        <ClassSelect props={props} value={classId} onChange={setClassId} all />
        {section === 'assignments' && (
          <label className="mis-field live-filter">
            {tx(vi, 'Kỹ năng', 'Skill')}
            <select value={skill} onChange={(event) => setSkill(event.target.value)}>
              <option value="">{tx(vi, 'Tất cả kỹ năng', 'All skills')}</option>
              {(['reading', 'writing', 'listening', 'speaking'] as Skill[]).map((value) => (
                <option key={value} value={value}>
                  {skillName(value, vi)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {canEdit && (section === 'materials' || section === 'syllabus') && (
        <TeacherGuidePanel props={props} classId={classId} />
      )}
      {!rows.length ? (
        <div className="mis-panel live-empty">
          <p>
            {query || classId || skill
              ? tx(vi, 'Không có nội dung phù hợp với bộ lọc.', 'No content matches your filters.')
              : tx(vi, 'Chưa có nội dung trong mục này.', 'There is no content here yet.')}
          </p>
          {canEdit && !props.state.classes.length ? (
            <p>
              {tx(
                vi,
                'Cần có lớp học trước khi thêm nội dung. Quản trị viên có thể tạo lớp và phân công giáo viên.',
                'Create a class before adding content. An administrator can create a class and assign its teachers.',
              )}
            </p>
          ) : (
            !canEdit && (
              <p>
                {tx(
                  vi,
                  'Nội dung sẽ xuất hiện khi giáo viên cập nhật lớp học.',
                  'Content will appear when your teaching team updates the class.',
                )}
              </p>
            )
          )}
        </div>
      ) : section === 'assignments' ? (
        <div className="mis-panel mis-table-wrap" role="region" aria-label={title} tabIndex={0}>
          <table className="mis-table">
            <thead>
              <tr>
                <th scope="col">{tx(vi, 'Bài tập', 'Assignment')}</th>
                <th scope="col">{tx(vi, 'Hạn nộp', 'Deadline')}</th>
                <th scope="col">{tx(vi, 'Trạng thái', 'Status')}</th>
                <th scope="col">{tx(vi, 'Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(rows as Assignment[]).map((value) => {
                const submission = props.state.submissions
                  .filter(
                    (item) =>
                      item.assignmentId === value.id && item.studentId === props.state.user.id,
                  )
                  .sort((a, b) => b.revision - a.revision)[0]
                const draft = props.state.drafts.find(
                  (item) =>
                    item.assignmentId === value.id && item.studentId === props.state.user.id,
                )
                const status = student
                  ? submission?.review
                    ? tx(vi, 'Đã nhận xét', 'Reviewed')
                    : submission
                      ? tx(vi, 'Đã nộp', 'Submitted')
                      : draft
                        ? tx(vi, 'Đang làm', 'In progress')
                        : tx(vi, 'Chưa bắt đầu', 'Not started')
                  : value.published
                    ? tx(vi, 'Đã xuất bản', 'Published')
                    : tx(vi, 'Bản nháp', 'Draft')
                return (
                  <tr key={value.id}>
                    <td>
                      <strong>{value.title[props.locale]}</strong>
                      <span className="live-cell-note">
                        {className(props, value.classId)} · {skillName(value.skill, vi)}
                      </span>
                      {value.required && (
                        <span className="live-cell-note">
                          {tx(vi, 'Chuẩn bị bắt buộc', 'Required preparation')}
                        </span>
                      )}
                    </td>
                    <td>{displayDate(value.dueAt, props.locale)}</td>
                    <td>
                      <span
                        className={`mis-status ${student ? (submission ? 'live-status-success' : '') : value.published ? 'live-status-success' : ''}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td>
                      <div className="live-actions">
                        {student && onAssignment && (
                          <button
                            className="mis-button mis-primary"
                            onClick={() => onAssignment(value.id)}
                          >
                            {tx(vi, 'Mở bài tập', 'Open assignment')}
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className="mis-button"
                            disabled={editor !== undefined}
                            onClick={() => {
                              setMessage('')
                              setEditor(value)
                            }}
                          >
                            <PencilSimple size={16} aria-hidden="true" />
                            {tx(vi, 'Chỉnh sửa', 'Edit')}
                          </button>
                        )}
                        {!student && (
                          <details className="live-details">
                            <summary>{tx(vi, 'Xem hướng dẫn', 'View instructions')}</summary>
                            <p className="live-prose">{value.instructions[props.locale]}</p>
                            <Attachments
                              state={props.state}
                              locale={props.locale}
                              classId={value.classId}
                              purpose="material"
                              value={value.attachmentIds}
                              readOnly
                            />
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mis-panel live-content-list">
          {rows.map((value) => (
            <article key={value.id} className="live-content-item">
              <div className="live-heading">
                <div>
                  <h2>
                    {typeof value.title === 'string' ? value.title : value.title[props.locale]}
                  </h2>
                  <p>{className(props, value.classId)}</p>
                </div>
                {canEdit && (
                  <button
                    className="mis-button"
                    disabled={editor !== undefined}
                    onClick={() => {
                      setMessage('')
                      setEditor(value)
                    }}
                  >
                    <PencilSimple size={16} aria-hidden="true" />
                    {tx(vi, 'Chỉnh sửa', 'Edit')}
                  </button>
                )}
              </div>
              {'content' in value && <p className="live-prose">{value.content}</p>}
              <span
                className={`mis-status ${'completed' in value ? (value.completed ? 'live-status-success' : '') : 'published' in value && value.published ? 'live-status-success' : ''}`}
              >
                {'completed' in value
                  ? value.completed
                    ? tx(vi, 'Đã hoàn thành', 'Completed')
                    : tx(vi, 'Chưa hoàn thành', 'Upcoming')
                  : 'published' in value && value.published
                    ? tx(vi, 'Đã xuất bản', 'Published')
                    : tx(vi, 'Bản nháp', 'Draft')}
              </span>
              {'attachmentIds' in value && value.attachmentIds.length > 0 && (
                <Attachments
                  state={props.state}
                  locale={props.locale}
                  classId={value.classId}
                  purpose="material"
                  value={value.attachmentIds}
                  readOnly
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function AttendanceRow({
  props,
  studentId,
  classId,
  date,
  canEdit,
}: {
  props: LiveViewProps
  studentId: string
  classId: string
  date: string
  canEdit: boolean
}) {
  const vi = props.locale === 'vi'
  const student = props.state.users.find((value) => value.id === studentId)
  const record = props.state.attendance.find(
    (value) => value.classId === classId && value.studentId === studentId && value.date === date,
  )
  const [draft, setDraft] = useState<{
    status: Attendance['status']
    expectedVersion: number
  } | null>(null)
  const [saved, setSaved] = useState(false)
  const mutation = useMutation(props)
  const statuses: Attendance['status'][] = ['unmarked', 'present', 'late', 'absent']
  const labels = {
    unmarked: tx(vi, 'Chưa điểm danh', 'Unmarked'),
    present: tx(vi, 'Có mặt', 'Present'),
    late: tx(vi, 'Đi muộn', 'Late'),
    absent: tx(vi, 'Vắng mặt', 'Absent'),
  }
  return (
    <tr>
      <td>
        <strong>{student?.name ?? studentId}</strong>
        <span className="live-cell-note">{student?.email}</span>
      </td>
      <td>
        {canEdit ? (
          <select
            className="mis-field"
            value={draft?.status ?? record?.status ?? 'unmarked'}
            disabled={mutation.busy}
            aria-label={`${tx(vi, 'Điểm danh', 'Attendance')}: ${student?.name ?? studentId}`}
            onChange={(event) => {
              setSaved(false)
              setDraft({
                status: event.target.value as Attendance['status'],
                expectedVersion: draft?.expectedVersion ?? record?.version ?? 0,
              })
            }}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        ) : (
          labels[record?.status ?? 'unmarked']
        )}
      </td>
      {canEdit && (
        <td>
          <button
            className="mis-button"
            disabled={!draft || mutation.busy}
            onClick={() => {
              if (draft)
                void mutation.execute(
                  'attendance.save',
                  {
                    classId,
                    studentId,
                    date,
                    status: draft.status,
                    expectedVersion: draft.expectedVersion,
                  },
                  () => {
                    setDraft(null)
                    setSaved(true)
                  },
                )
            }}
          >
            {mutation.busy ? tx(vi, 'Đang lưu…', 'Saving…') : tx(vi, 'Lưu', 'Save')}
          </button>
          {saved && (
            <span className="live-cell-note live-success" role="status">
              {tx(vi, 'Đã lưu', 'Saved')}
            </span>
          )}
          {mutation.error && (
            <p className="live-error live-row-error" role="alert">
              {mutation.error}
            </p>
          )}
        </td>
      )}
    </tr>
  )
}

function AttendanceView(props: LiveViewProps) {
  const vi = props.locale === 'vi'
  const canEdit = props.state.user.role === 'admin' || props.state.user.role === 'teacher'
  const [selectedClass, setClassId] = useState(props.state.classes[0]?.id ?? '')
  const classId = props.state.classes.some((value) => value.id === selectedClass)
    ? selectedClass
    : (props.state.classes[0]?.id ?? '')
  const [date, setDate] = useState(localDate())
  const classroom = props.state.classes.find((value) => value.id === classId)
  const studentIds =
    classroom?.studentIds.filter(
      (id) => props.state.user.role !== 'student' || id === props.state.user.id,
    ) ?? []
  return (
    <div className="live-admin">
      <div className="live-heading">
        <div>
          <p>
            {tx(
              vi,
              'Chọn lớp và ngày học để xem hoặc cập nhật điểm danh.',
              'Choose a class and lesson date to view or update attendance.',
            )}
          </p>
        </div>
      </div>
      <div className="live-toolbar">
        <ClassSelect props={props} value={classId} onChange={setClassId} />
        <label className="mis-field live-filter">
          {tx(vi, 'Ngày học', 'Lesson date')}
          <input
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value)
            }}
          />
        </label>
      </div>
      {studentIds.length ? (
        <div
          className="mis-panel mis-table-wrap"
          role="region"
          aria-label={tx(vi, 'Danh sách điểm danh', 'Attendance roster')}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th scope="col">{tx(vi, 'Học viên', 'Student')}</th>
                <th scope="col">{tx(vi, 'Điểm danh', 'Attendance')}</th>
                {canEdit && <th scope="col">{tx(vi, 'Thao tác', 'Actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {studentIds.map((id) => (
                <AttendanceRow
                  key={`${classId}:${date}:${id}`}
                  props={props}
                  classId={classId}
                  studentId={id}
                  date={date}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mis-panel live-empty">
          {tx(
            vi,
            'Chưa có học viên để điểm danh trong lớp được chọn.',
            'There are no enrolled students to mark in this class.',
          )}
        </p>
      )}
    </div>
  )
}

function NotificationEditor({
  props,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [classId, setClassId] = useState(
    props.state.user.role === 'teacher' ? (props.state.classes[0]?.id ?? '') : '',
  )
  const [recipientIds, setRecipients] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [validation, setValidation] = useState('')
  const mutation = useMutation(props)
  const classroom = props.state.classes.find((value) => value.id === classId)
  const members = classroom
    ? [...classroom.studentIds, ...classroom.teacherIds, ...classroom.assistantIds]
    : []
  const recipients = props.state.users.filter(
    (user) => user.active && (!classId || members.includes(user.id)),
  )
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!recipientIds.length) {
      setValidation(tx(vi, 'Chọn ít nhất một người nhận.', 'Select at least one recipient.'))
      return
    }
    setValidation('')
    await mutation.execute(
      'notification.create',
      { classId: classId || undefined, recipientIds, title: title.trim(), body: body.trim() },
      onSaved,
    )
  }
  return (
    <EditorFrame
      title={tx(vi, 'Gửi thông báo', 'Send notification')}
      busy={mutation.busy}
      vi={vi}
      error={validation || mutation.error}
      onClose={onClose}
      onSubmit={submit}
      submitText={tx(vi, 'Gửi thông báo', 'Send notification')}
    >
      <div className="live-form-grid">
        <ClassSelect
          props={props}
          value={classId}
          onChange={(id) => {
            setClassId(id)
            setRecipients([])
          }}
          all={props.state.user.role === 'admin'}
          required={props.state.user.role === 'teacher'}
        />
        <label className="mis-field">
          {tx(vi, 'Tiêu đề', 'Title')}
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="mis-field live-wide">
          {tx(vi, 'Nội dung thông báo', 'Message')}
          <textarea
            required
            maxLength={10000}
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <fieldset className="live-membership live-wide">
          <legend>{tx(vi, 'Người nhận', 'Recipients')}</legend>
          <label className="live-check">
            <input
              type="checkbox"
              checked={
                recipients.length > 0 && recipients.every((user) => recipientIds.includes(user.id))
              }
              onChange={(event) =>
                setRecipients(event.target.checked ? recipients.map((user) => user.id) : [])
              }
            />
            {tx(vi, 'Chọn tất cả', 'Select all')}
          </label>
          <div className="live-member-list">
            {recipients.map((user) => (
              <label className="live-check" key={user.id}>
                <input
                  type="checkbox"
                  checked={recipientIds.includes(user.id)}
                  onChange={(event) =>
                    setRecipients(
                      event.target.checked
                        ? [...recipientIds, user.id]
                        : recipientIds.filter((id) => id !== user.id),
                    )
                  }
                />
                <span>
                  {user.name}
                  <small>{user.email}</small>
                </span>
              </label>
            ))}
            {!recipients.length && (
              <p className="live-help">
                {tx(
                  vi,
                  'Chưa có người nhận trong lớp này.',
                  'There are no recipients in this class.',
                )}
              </p>
            )}
          </div>
        </fieldset>
      </div>
    </EditorFrame>
  )
}

function NotificationsView(props: LiveViewProps) {
  const vi = props.locale === 'vi'
  const canCreate = props.state.user.role === 'teacher' || props.state.user.role === 'admin'
  const [editor, setEditor] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [sent, setSent] = useState(false)
  const mutation = useMutation(props)
  const rows = props.state.notifications
    .filter((value) => !unreadOnly || !value.read)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div className="live-admin">
      <div className="live-heading">
        <div>
          <p>
            {tx(vi, 'Thông báo được gửi đến tài khoản của bạn.', 'Messages sent to your account.')}
          </p>
        </div>
        {canCreate && (
          <button
            className="mis-button mis-primary"
            disabled={
              editor || (props.state.user.role === 'teacher' && !props.state.classes.length)
            }
            onClick={() => {
              setEditor(true)
              setSent(false)
            }}
          >
            <Plus size={18} aria-hidden="true" />
            {tx(vi, 'Gửi thông báo', 'Send notification')}
          </button>
        )}
      </div>
      {sent && (
        <p className="live-success" role="status">
          {tx(
            vi,
            'Đã gửi thông báo đến các tài khoản đã chọn.',
            'Notification sent to the selected accounts.',
          )}
        </p>
      )}
      {editor && (
        <NotificationEditor
          props={props}
          onClose={() => setEditor(false)}
          onSaved={() => {
            setEditor(false)
            setSent(true)
          }}
        />
      )}
      <label className="live-check">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => setUnreadOnly(event.target.checked)}
        />
        {tx(vi, 'Chỉ hiển thị chưa đọc', 'Show unread only')}
      </label>
      {mutation.error && (
        <p className="live-error" role="alert">
          {mutation.error}
        </p>
      )}
      {rows.length ? (
        <div className="mis-panel live-content-list">
          {rows.map((value) => (
            <article key={value.id} className="live-content-item">
              <div className="live-heading">
                <div>
                  <h2>{value.title}</h2>
                  <p>
                    <time dateTime={value.createdAt}>
                      {displayDate(value.createdAt, props.locale)}
                    </time>
                  </p>
                </div>
                <span className={`mis-status ${!value.read ? 'live-status-unread' : ''}`}>
                  {value.read ? tx(vi, 'Đã đọc', 'Read') : tx(vi, 'Chưa đọc', 'Unread')}
                </span>
              </div>
              <p className="live-prose">{value.body}</p>
              {!value.read && (
                <button
                  className="mis-button"
                  disabled={mutation.busy}
                  onClick={() => void mutation.execute('notification.read', { id: value.id })}
                >
                  <Check size={16} aria-hidden="true" />
                  {mutation.busy
                    ? tx(vi, 'Đang lưu…', 'Saving…')
                    : tx(vi, 'Đánh dấu đã đọc', 'Mark as read')}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mis-panel live-empty">
          {unreadOnly
            ? tx(vi, 'Bạn đã đọc tất cả thông báo.', 'You have read all your notifications.')
            : tx(vi, 'Bạn chưa nhận được thông báo nào.', 'You have no notifications yet.')}
        </p>
      )}
    </div>
  )
}

export function AcademicContentViews({
  section,
  onAssignment,
  ...props
}: LiveViewProps & { section: Section; onAssignment?: (id: string) => void }) {
  if (section === 'attendance') return <AttendanceView {...props} />
  if (section === 'notifications') return <NotificationsView {...props} />
  return <ContentList key={section} props={props} section={section} onAssignment={onAssignment} />
}
