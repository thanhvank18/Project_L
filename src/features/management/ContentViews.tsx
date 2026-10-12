/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named table regions need keyboard focus for horizontal scrolling on small screens. */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bell, Check, FileText, MagnifyingGlass, PencilSimple, Plus } from '@phosphor-icons/react'
import type { PortalLocale, PortalRole, Skill } from '@/features/learning/types'
import { portalDemoData } from '@/features/learning/data'
import { visibleCourseIds } from '@/features/management/model'
import type {
  ManagementCourse,
  ManagementMaterial,
  ManagementState,
  ManagementTask,
  ManagementUser,
  ManagementViewProps,
} from '@/features/management/types'

type ContentSection = 'syllabus' | 'materials' | 'assignments' | 'notifications' | 'users'
type Props = ManagementViewProps & {
  section: ContentSection
  onAssignment: (id: string) => void
  onReviewAssignment?: (id: string) => void
  assignmentDraftIds?: string[]
  sharedPreview?: boolean
}
type Feedback = { ok: boolean; text: string } | null
const roles: PortalRole[] = ['student', 'teacher', 'assistant', 'admin']
const skills: Skill[] = ['reading', 'listening', 'writing', 'speaking']
const knownTasks = new Set(['reading-01', 'writing-01', 'listening-01', 'speaking-01'])
const assignmentStatusNames = {
  missing: { vi: 'Chưa làm', en: 'Not started' },
  draft: { vi: 'Bản nháp chưa nộp', en: 'Unsubmitted draft' },
  submitted: { vi: 'Đã nộp · Chờ nhận xét', en: 'Submitted · Awaiting review' },
  returned: { vi: 'Đã có nhận xét', en: 'Feedback received' },
}

function assignmentInstructions(task: ManagementTask) {
  return (
    task.instructions ??
    portalDemoData.assignments.find((assignment) => assignment.id === task.id)?.description ?? {
      vi: '',
      en: '',
    }
  )
}

function sameAssignmentVersion(current: ManagementTask, original: ManagementTask) {
  return (
    current.id === original.id &&
    current.courseId === original.courseId &&
    current.skill === original.skill &&
    current.title.vi === original.title.vi &&
    current.title.en === original.title.en &&
    current.instructions?.vi === original.instructions?.vi &&
    current.instructions?.en === original.instructions?.en &&
    current.due === original.due &&
    current.published === original.published
  )
}
const roleNames = {
  student: { vi: 'Học viên', en: 'Student' },
  teacher: { vi: 'Giáo viên', en: 'Teacher' },
  assistant: { vi: 'Trợ giảng', en: 'Teaching assistant' },
  admin: { vi: 'Quản trị viên', en: 'Administrator' },
}

function text(locale: PortalLocale, vi: string, en: string) {
  return locale === 'vi' ? vi : en
}

function scopedCourses(state: ManagementState, role: PortalRole) {
  const ids = new Set(visibleCourseIds(state, role))
  return state.courses.filter((course) => ids.has(course.id))
}

function canEdit(role: PortalRole) {
  return role === 'admin' || role === 'teacher'
}

function Status({ published, locale }: { published: boolean; locale: PortalLocale }) {
  return (
    <span className={`mis-status ${published ? 'mc-published' : 'mc-draft'}`}>
      {published ? text(locale, 'Đã đăng', 'Published') : text(locale, 'Bản nháp', 'Draft')}
    </span>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p
      className={`mc-feedback ${feedback.ok ? 'mc-success' : 'mc-error'}`}
      role={feedback.ok ? 'status' : 'alert'}
    >
      {feedback.text}
    </p>
  )
}

function CourseFilter({
  courses,
  value,
  onChange,
  locale,
}: {
  courses: ManagementCourse[]
  value: string
  onChange: (value: string) => void
  locale: PortalLocale
}) {
  return (
    <label className="mis-field mc-filter">
      <span>{text(locale, 'Lớp học', 'Class')}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{text(locale, 'Tất cả lớp', 'All classes')}</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>
    </label>
  )
}

function SearchField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <label className="mis-field mc-search">
      <span>{label}</span>
      <span className="mc-search-input">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={160}
        />
      </span>
    </label>
  )
}

function Empty({ locale }: { locale: PortalLocale }) {
  return (
    <p className="mis-empty">
      {text(
        locale,
        'Không có dữ liệu phù hợp. Hãy thử thay đổi bộ lọc.',
        'No matching records. Try changing the filters.',
      )}
    </p>
  )
}

function SyllabusView({ state, commit, locale, role }: ManagementViewProps) {
  const [query, setQuery] = useState('')
  const [courseId, setCourseId] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const courses = scopedCourses(state, role)
  const queryLower = query.trim().toLocaleLowerCase()
  const visible = courses.filter(
    (course) =>
      (!courseId || course.id === courseId) &&
      (course.title.toLocaleLowerCase().includes(queryLower) ||
        state.units.some(
          (unit) =>
            unit.courseId === course.id &&
            unit.title[locale].toLocaleLowerCase().includes(queryLower),
        )),
  )

  function toggleUnit(id: string, value: boolean) {
    if (!canEdit(role)) return
    const ok = commit((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.id === id && (role === 'admin' || unit.courseId === 'ielts-foundation')
          ? { ...unit, done: value }
          : unit,
      ),
    }))
    setFeedback({
      ok,
      text: ok
        ? text(locale, 'Đã lưu tiến độ giảng dạy mẫu.', 'Sample teaching progress saved.')
        : text(
            locale,
            'Chưa lưu được tiến độ. Hãy thử lại.',
            'Could not save progress. Please try again.',
          ),
    })
  }

  return (
    <div className="mc-content">
      <div className="mis-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label={text(locale, 'Tìm chương trình hoặc chủ đề', 'Search syllabus or topic')}
        />
        <CourseFilter courses={courses} value={courseId} onChange={setCourseId} locale={locale} />
      </div>
      <p className="mc-context">
        {text(
          locale,
          'Theo dõi các chủ đề đã được giảng dạy trong từng lớp. Tiến độ này không phải điểm hoàn thành cá nhân.',
          'Track topics taught in each class. This is teaching progress, not individual completion.',
        )}
      </p>
      <FeedbackMessage feedback={feedback} />
      {!visible.length && <Empty locale={locale} />}
      {visible.map((course) => {
        const units = state.units.filter((unit) => unit.courseId === course.id)
        const done = units.filter((unit) => unit.done).length
        return (
          <section className="mis-panel mc-syllabus" key={course.id} aria-label={course.title}>
            <div className="mc-panel-heading">
              <div>
                <h2>{course.title}</h2>
                <p>
                  {course.level} · {course.teacher}
                </p>
              </div>
              <span className="mis-status">
                {done}/{units.length} {text(locale, 'chủ đề', 'topics')}
              </span>
            </div>
            <progress
              className="mc-progress"
              value={done}
              max={units.length || 1}
              aria-label={text(
                locale,
                `Tiến độ giảng dạy ${course.title}`,
                `${course.title} teaching progress`,
              )}
            />
            {units.length ? (
              <ul className="mc-unit-list">
                {units.map((unit) => (
                  <li key={unit.id}>
                    <label className="mc-check">
                      <input
                        type="checkbox"
                        checked={unit.done}
                        disabled={!canEdit(role)}
                        onChange={(event) => toggleUnit(unit.id, event.target.checked)}
                      />
                      <span>{unit.title[locale]}</span>
                    </label>
                    <span className="mc-small">
                      {unit.done
                        ? text(locale, 'Đã giảng dạy', 'Taught')
                        : text(locale, 'Chưa giảng dạy', 'Upcoming')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mis-empty">
                {text(locale, 'Chưa có chủ đề cho lớp này.', 'No topics added for this class.')}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function MaterialsView({ state, commit, locale, role }: ManagementViewProps) {
  const [query, setQuery] = useState('')
  const [courseId, setCourseId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ManagementMaterial | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const courses = scopedCourses(state, role)
  const courseIds = new Set(courses.map((course) => course.id))
  const rows = state.materials.filter(
    (material) =>
      courseIds.has(material.courseId) &&
      (role !== 'student' || material.published) &&
      (!courseId || material.courseId === courseId) &&
      material.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const selected = rows.find((material) => material.id === selectedId)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !canEdit(role)) return
    const material = { ...editing, title: editing.title.trim(), content: editing.content.trim() }
    if (!material.title || !material.content || !courseIds.has(material.courseId)) {
      setFeedback({
        ok: false,
        text: text(
          locale,
          'Nhập tiêu đề, nội dung và chọn lớp hợp lệ.',
          'Enter a title and content, and select a valid class.',
        ),
      })
      return
    }
    const ok = commit((current) => ({
      ...current,
      materials: current.materials.some((item) => item.id === material.id)
        ? current.materials.map((item) => (item.id === material.id ? material : item))
        : [...current.materials, material],
    }))
    setFeedback({
      ok,
      text: ok
        ? text(locale, 'Đã lưu học liệu trên thiết bị này.', 'Material saved on this device.')
        : text(
            locale,
            'Chưa lưu được học liệu. Nội dung vẫn ở trong biểu mẫu.',
            'Could not save. Your content is still in the form.',
          ),
    })
    if (ok) {
      setEditing(null)
      setSelectedId(material.id)
    }
  }

  return (
    <div className="mc-content">
      <div className="mis-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label={text(locale, 'Tìm học liệu', 'Search materials')}
        />
        <CourseFilter courses={courses} value={courseId} onChange={setCourseId} locale={locale} />
        {canEdit(role) && (
          <button
            type="button"
            className="mis-button mis-primary mc-toolbar-action"
            onClick={() => {
              setFeedback(null)
              setEditing({
                id: `material-${crypto.randomUUID()}`,
                title: '',
                content: '',
                courseId: courses[0]?.id ?? '',
                published: false,
              })
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {text(locale, 'Thêm học liệu', 'Add material')}
          </button>
        )}
      </div>
      <FeedbackMessage feedback={feedback} />
      {editing && (
        <form className="mis-panel mc-form" onSubmit={save}>
          <h2>{text(locale, 'Biên soạn học liệu', 'Edit learning material')}</h2>
          <div className="mc-form-grid">
            <label className="mis-field">
              <span>{text(locale, 'Tiêu đề', 'Title')}</span>
              <input
                required
                maxLength={140}
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
              />
            </label>
            <label className="mis-field">
              <span>{text(locale, 'Lớp học', 'Class')}</span>
              <select
                required
                value={editing.courseId}
                onChange={(event) => setEditing({ ...editing, courseId: event.target.value })}
              >
                {courses.map((course) => (
                  <option value={course.id} key={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mis-field">
            <span>{text(locale, 'Nội dung bài đọc', 'Article content')}</span>
            <textarea
              required
              maxLength={6000}
              rows={7}
              value={editing.content}
              onChange={(event) => setEditing({ ...editing, content: event.target.value })}
            />
          </label>
          <label className="mc-check">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(event) => setEditing({ ...editing, published: event.target.checked })}
            />
            <span>
              {text(
                locale,
                'Hiển thị cho học viên trong bản thử',
                'Publish to students in this preview',
              )}
            </span>
          </label>
          <div className="mc-actions">
            <button className="mis-button mis-primary" type="submit">
              {text(locale, 'Lưu học liệu', 'Save material')}
            </button>
            <button type="button" className="mis-button" onClick={() => setEditing(null)}>
              {text(locale, 'Hủy', 'Cancel')}
            </button>
          </div>
        </form>
      )}
      <div className="mis-panel">
        <div
          className="mis-table-wrap"
          role="region"
          aria-label={text(locale, 'Danh sách học liệu', 'Materials list')}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th>{text(locale, 'Học liệu', 'Material')}</th>
                <th>{text(locale, 'Lớp học', 'Class')}</th>
                <th>{text(locale, 'Trạng thái', 'Status')}</th>
                <th>{text(locale, 'Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((material) => (
                <tr key={material.id}>
                  <td>
                    <span className="mc-table-title">
                      <FileText size={18} aria-hidden="true" />
                      {material.title}
                    </span>
                  </td>
                  <td>{courses.find((course) => course.id === material.courseId)?.title}</td>
                  <td>
                    <Status published={material.published} locale={locale} />
                  </td>
                  <td>
                    <div className="mc-actions">
                      <button
                        type="button"
                        className="mis-button mc-compact"
                        onClick={() =>
                          setSelectedId(selectedId === material.id ? null : material.id)
                        }
                        aria-expanded={selectedId === material.id}
                      >
                        {selectedId === material.id
                          ? text(locale, 'Đóng', 'Close')
                          : text(locale, 'Đọc', 'Read')}
                      </button>
                      {canEdit(role) && (
                        <button
                          type="button"
                          className="mis-button mc-compact"
                          aria-label={text(
                            locale,
                            `Sửa ${material.title}`,
                            `Edit ${material.title}`,
                          )}
                          onClick={() => {
                            setEditing({ ...material })
                            setFeedback(null)
                          }}
                        >
                          <PencilSimple size={16} aria-hidden="true" />
                          {text(locale, 'Sửa', 'Edit')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty locale={locale} />}
      </div>
      {selected && (
        <article className="mis-panel mc-article">
          <div className="mc-panel-heading">
            <h2>{selected.title}</h2>
            <button
              type="button"
              className="mis-button mc-compact"
              onClick={() => setSelectedId(null)}
            >
              {text(locale, 'Đóng học liệu', 'Close material')}
            </button>
          </div>
          <p>{selected.content}</p>
        </article>
      )}
    </div>
  )
}

function AssignmentsView({
  state,
  commit,
  locale,
  role,
  onAssignment,
  onReviewAssignment,
  assignmentDraftIds = [],
}: ManagementViewProps &
  Pick<Props, 'onAssignment' | 'onReviewAssignment' | 'assignmentDraftIds'>) {
  const [query, setQuery] = useState('')
  const [courseId, setCourseId] = useState('')
  const [skill, setSkill] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<ManagementTask | null>(null)
  const [editingOriginal, setEditingOriginal] = useState<ManagementTask | null>(null)
  const editingTitleRef = useRef<HTMLInputElement>(null)
  const editingId = editing?.id
  const hasFixedPrompt = editingId === 'reading-01' || editingId === 'writing-01'
  useEffect(() => {
    if (editingId) editingTitleRef.current?.focus()
  }, [editingId])
  const [detail, setDetail] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const courses = scopedCourses(state, role)
  const courseIds = new Set(courses.map((course) => course.id))
  const studentActive = state.learners.some(
    (learner) => learner.id === 'learner-01' && learner.status === 'active',
  )
  const draftIds = new Set(assignmentDraftIds)
  const learnerSubmissions = state.submissions.filter((item) => item.learnerId === 'learner-01')
  function taskStatus(taskId: string) {
    if (draftIds.has(taskId)) return 'draft'
    return learnerSubmissions.find((item) => item.taskId === taskId)?.status ?? 'missing'
  }
  const visibleTasks = state.tasks.filter(
    (task) =>
      courseIds.has(task.courseId) &&
      (role !== 'student' ||
        (studentActive &&
          task.published &&
          courses.some((course) => course.id === task.courseId && course.status === 'active'))),
  )
  if (role === 'student') visibleTasks.sort((left, right) => left.due.localeCompare(right.due))
  const rows = visibleTasks.filter(
    (task) =>
      courseIds.has(task.courseId) &&
      (role !== 'student' || task.published) &&
      (!courseId || task.courseId === courseId) &&
      (!skill || task.skill === skill) &&
      (!status ||
        (role === 'student'
          ? taskStatus(task.id) === status
          : String(task.published) === status)) &&
      task.title[locale].toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const selected = rows.find((task) => task.id === detail)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !canEdit(role)) return
    const title = { vi: editing.title.vi.trim(), en: editing.title.en.trim() }
    const instructions = {
      vi: assignmentInstructions(editing).vi.trim(),
      en: assignmentInstructions(editing).en.trim(),
    }
    const due = editing.due.slice(0, 10)
    const parsedDue = new Date(due)
    if (
      !title.vi ||
      !title.en ||
      !instructions.vi ||
      !instructions.en ||
      !courseIds.has(editing.courseId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
      !Number.isFinite(parsedDue.getTime()) ||
      parsedDue.toISOString().slice(0, 10) !== due ||
      due < '2020-01-01' ||
      due > '2100-12-31' ||
      !skills.includes(editing.skill)
    ) {
      setFeedback({
        ok: false,
        text: text(
          locale,
          'Điền tiêu đề và đề bài ở cả hai ngôn ngữ; chọn kỹ năng, lớp và ngày hạn hợp lệ.',
          'Add titles and instructions in both languages, then choose a valid skill, class and due date.',
        ),
      })
      return
    }
    const task = { ...editing, title, instructions, due }
    let changed = false
    const saved = commit((current) => {
      changed = false
      const allowedCourses = new Set(visibleCourseIds(current, role))
      const currentTask = current.tasks.find((item) => item.id === task.id)
      const locked =
        knownTasks.has(task.id) || current.submissions.some((item) => item.taskId === task.id)
      if (
        !canEdit(role) ||
        !allowedCourses.has(task.courseId) ||
        (editingOriginal
          ? !currentTask ||
            !allowedCourses.has(currentTask.courseId) ||
            !sameAssignmentVersion(currentTask, editingOriginal) ||
            (locked && (task.courseId !== currentTask.courseId || task.skill !== currentTask.skill))
          : Boolean(currentTask))
      ) {
        changed = true
        return current
      }
      return {
        ...current,
        tasks: currentTask
          ? current.tasks.map((item) => (item.id === task.id ? task : item))
          : [...current.tasks, task],
      }
    })
    const ok = saved && !changed
    setFeedback({
      ok,
      text: ok
        ? text(
            locale,
            task.published
              ? 'Đã đăng bài tập trong dữ liệu dùng thử. Học viên có thể mở đề và nộp bài mẫu.'
              : 'Đã lưu bản nháp. Chọn hiển thị cho học viên khi đề bài sẵn sàng.',
            task.published
              ? 'Assignment published in the trial data. Students can open the task and submit sample work.'
              : 'Draft saved. Publish to students when the instructions are ready.',
          )
        : changed
          ? text(
              locale,
              'Bài tập hoặc phạm vi lớp đã thay đổi ở phiên khác. Nội dung bạn nhập vẫn được giữ lại; hãy sao chép nội dung cần giữ, hủy biểu mẫu rồi mở lại bài tập trước khi lưu.',
              'This assignment or its class access changed in another session. Your typed content is preserved. Copy anything you want to keep, cancel the form, then reopen the assignment before saving.',
            )
          : text(
              locale,
              'Chưa lưu được bài tập. Hãy thử lại.',
              'Could not save the assignment. Please try again.',
            ),
    })
    if (ok) {
      setEditing(null)
      setEditingOriginal(null)
      setDetail(task.id)
    }
  }

  return (
    <div className="mc-content">
      <div className="mis-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label={text(locale, 'Tìm bài tập', 'Search assignments')}
        />
        <CourseFilter courses={courses} value={courseId} onChange={setCourseId} locale={locale} />
        <label className="mis-field mc-filter">
          <span>{text(locale, 'Kỹ năng', 'Skill')}</span>
          <select value={skill} onChange={(event) => setSkill(event.target.value)}>
            <option value="">{text(locale, 'Tất cả kỹ năng', 'All skills')}</option>
            {skills.map((value) => (
              <option key={value} value={value}>
                {value[0]?.toUpperCase()}
                {value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="mis-field mc-filter">
          <span>{text(locale, 'Trạng thái', 'Status')}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{text(locale, 'Tất cả trạng thái', 'All statuses')}</option>
            {role === 'student' ? (
              Object.entries(assignmentStatusNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label[locale]}
                </option>
              ))
            ) : (
              <>
                <option value="true">{text(locale, 'Đã đăng', 'Published')}</option>
                <option value="false">{text(locale, 'Bản nháp', 'Draft')}</option>
              </>
            )}
          </select>
        </label>
        {canEdit(role) && (
          <button
            type="button"
            className="mis-button mis-primary mc-toolbar-action"
            onClick={() => {
              setFeedback(null)
              setEditingOriginal(null)
              setEditing({
                id: `task-${crypto.randomUUID()}`,
                title: { vi: '', en: '' },
                instructions: { vi: '', en: '' },
                courseId: courses[0]?.id ?? '',
                skill: 'writing',
                due: '2026-10-18',
                published: false,
              })
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {text(locale, 'Thêm bài tập', 'Add assignment')}
          </button>
        )}
      </div>
      <p className="mc-context">
        {role === 'student'
          ? text(
              locale,
              'Mở bài tập, lưu nháp rồi nộp để nhận phản hồi trong luồng dùng thử. Hạn nộp được tính theo giờ Việt Nam (UTC+07).',
              'Open a task, save a draft, then submit for feedback in the trial workflow. Due dates use Vietnam time (UTC+07).',
            )
          : role === 'assistant'
            ? text(
                locale,
                'Theo dõi đề bài và số bài nộp của lớp được phân công. Trợ giảng xem dữ liệu dùng thử, chưa có quyền chỉnh sửa hoặc chấm bài.',
                'Track instructions and submissions for your assigned class. Teaching assistants can view trial data; editing and grading are not enabled.',
              )
            : text(
                locale,
                'Soạn đề bài, đăng cho học viên và theo dõi bài nộp. Dữ liệu dùng thử chỉ lưu trên trình duyệt; không gửi email.',
                'Write instructions, publish to students and track submissions. Trial data stays in this browser; no email is sent.',
              )}
      </p>
      <FeedbackMessage feedback={feedback} />
      {editing && (
        <form className="mis-panel mc-form" onSubmit={save}>
          <h2>{text(locale, 'Thông tin bài tập', 'Assignment details')}</h2>
          <div className="mc-form-grid">
            <label className="mis-field">
              <span>{text(locale, 'Tiêu đề tiếng Việt', 'Vietnamese title')}</span>
              <input
                ref={editingTitleRef}
                required
                maxLength={140}
                value={editing.title.vi}
                onChange={(event) =>
                  setEditing({ ...editing, title: { ...editing.title, vi: event.target.value } })
                }
              />
            </label>
            <label className="mis-field">
              <span>{text(locale, 'Tiêu đề tiếng Anh', 'English title')}</span>
              <input
                required
                maxLength={140}
                value={editing.title.en}
                onChange={(event) =>
                  setEditing({ ...editing, title: { ...editing.title, en: event.target.value } })
                }
              />
            </label>
            <label className="mis-field">
              <span>{text(locale, 'Lớp học', 'Class')}</span>
              <select
                required
                value={editing.courseId}
                disabled={
                  knownTasks.has(editing.id) ||
                  state.submissions.some((item) => item.taskId === editing.id)
                }
                onChange={(event) => setEditing({ ...editing, courseId: event.target.value })}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="mis-field">
              <span>{text(locale, 'Kỹ năng', 'Skill')}</span>
              <select
                value={editing.skill}
                disabled={
                  knownTasks.has(editing.id) ||
                  state.submissions.some((item) => item.taskId === editing.id)
                }
                onChange={(event) => setEditing({ ...editing, skill: event.target.value as Skill })}
              >
                {skills.map((value) => (
                  <option key={value} value={value}>
                    {value[0]?.toUpperCase()}
                    {value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mis-field">
              <span>
                {text(
                  locale,
                  'Ngày hết hạn (23:59, giờ Việt Nam)',
                  'Due date (23:59, Vietnam time)',
                )}
              </span>
              <input
                type="date"
                min="2020-01-01"
                max="2100-12-31"
                required
                value={editing.due.slice(0, 10)}
                onChange={(event) => setEditing({ ...editing, due: event.target.value })}
              />
            </label>
          </div>
          <div className="mc-form-grid">
            {(['vi', 'en'] as const).map((language) => (
              <label className="mis-field" key={language}>
                <span>
                  {language === 'vi'
                    ? hasFixedPrompt
                      ? text(
                          locale,
                          'Hướng dẫn bổ sung tiếng Việt',
                          'Vietnamese supplementary guidance',
                        )
                      : text(locale, 'Đề bài tiếng Việt', 'Vietnamese instructions')
                    : hasFixedPrompt
                      ? text(
                          locale,
                          'Hướng dẫn bổ sung tiếng Anh',
                          'English supplementary guidance',
                        )
                      : text(locale, 'Đề bài tiếng Anh', 'English instructions')}
                </span>
                <textarea
                  required
                  rows={6}
                  maxLength={6000}
                  value={assignmentInstructions(editing)[language]}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      instructions: {
                        ...assignmentInstructions(editing),
                        [language]: event.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          {hasFixedPrompt && (
            <p className="mc-context">
              {text(
                locale,
                'Đoạn đọc, câu hỏi và đề viết của bài mẫu được giữ cố định. Phần này chỉ thêm hướng dẫn cho học viên; hãy tạo bài tập mới nếu cần một đề khác.',
                'The sample passage, questions and writing prompt stay fixed. This field adds guidance for students; create a new assignment for a different prompt.',
              )}
            </p>
          )}
          {(knownTasks.has(editing.id) ||
            state.submissions.some((item) => item.taskId === editing.id)) && (
            <p className="mc-context">
              {text(
                locale,
                'Bài tập có sẵn hoặc đã có bài nộp giữ nguyên lớp và kỹ năng để bảo toàn nội dung học tập.',
                'Built-in tasks and tasks with submissions keep their class and skill to preserve existing work.',
              )}
            </p>
          )}
          <label className="mc-check">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(event) => setEditing({ ...editing, published: event.target.checked })}
            />
            <span>
              {text(
                locale,
                'Hiển thị cho học viên trong bản thử',
                'Publish to students in this preview',
              )}
            </span>
          </label>
          <div className="mc-actions">
            <button type="submit" className="mis-button mis-primary">
              {text(locale, 'Lưu bài tập', 'Save assignment')}
            </button>
            <button type="button" className="mis-button" onClick={() => setEditing(null)}>
              {text(locale, 'Hủy', 'Cancel')}
            </button>
          </div>
        </form>
      )}
      {role === 'student' ? (
        <section
          className="mis-panel"
          aria-label={text(locale, 'Bài tập của bạn', 'Your assignments')}
        >
          <div className="mc-assignment-summary">
            <strong>
              {rows.length} {text(locale, 'bài tập', 'assignments')}
            </strong>
            <span>
              {visibleTasks.filter((task) => taskStatus(task.id) === 'returned').length}{' '}
              {text(locale, 'bài có nhận xét', 'with feedback')}
            </span>
          </div>
          {rows.length ? (
            <ul className="mc-student-tasks">
              {rows.map((task) => {
                const progress = taskStatus(task.id)
                const result = learnerSubmissions.find((item) => item.taskId === task.id)?.review
                const required = portalDemoData.assignments.find(
                  (item) => item.id === task.id,
                )?.required
                const actionLabel =
                  progress === 'returned'
                    ? text(locale, 'Xem nhận xét', 'View feedback')
                    : progress === 'draft'
                      ? text(locale, 'Làm tiếp', 'Continue')
                      : progress === 'submitted'
                        ? text(locale, 'Xem bài đã nộp', 'View submission')
                        : text(locale, 'Bắt đầu làm', 'Start task')
                return (
                  <li key={task.id}>
                    <div className="mc-task-main">
                      <h2>{task.title[locale]}</h2>
                      <div className="mc-task-tags">
                        <span className="mc-capitalize">{task.skill}</span>
                        {required && (
                          <span>{text(locale, 'Bài chuẩn bị 1:1', '1:1 preparation')}</span>
                        )}
                      </div>
                      <p className="mc-task-meta">
                        {courses.find((course) => course.id === task.courseId)?.title}
                        {' · '}
                        {text(locale, 'Hạn', 'Due')}{' '}
                        <time dateTime={task.due}>
                          {new Date(task.due).toLocaleDateString(
                            locale === 'vi' ? 'vi-VN' : 'en-GB',
                            { timeZone: 'Asia/Ho_Chi_Minh' },
                          )}
                        </time>
                      </p>
                      <span className={`mis-status mc-task-status mc-task-${progress}`}>
                        {assignmentStatusNames[progress][locale]}
                      </span>
                      {result && progress === 'returned' && (
                        <p className="mc-task-result">
                          {text(locale, 'Điểm phản hồi', 'Feedback score')}:{' '}
                          <strong>{result.score}/9</strong>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`mis-button ${progress === 'missing' || progress === 'draft' ? 'mis-primary' : ''}`}
                      onClick={() => onAssignment(task.id)}
                      aria-label={`${actionLabel}: ${task.title[locale]}`}
                    >
                      {actionLabel}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : !studentActive || !courses.some((course) => course.status === 'active') ? (
            <p className="mis-empty">
              {text(
                locale,
                'Chưa có bài tập khả dụng vì học viên hoặc lớp mẫu đang tạm dừng. Quản trị viên có thể kích hoạt lại trong luồng dùng thử.',
                'Assignments are unavailable while the sample learner or class is inactive. An administrator can reactivate them in the trial workflow.',
              )}
            </p>
          ) : (
            <Empty locale={locale} />
          )}
        </section>
      ) : (
        <div className="mis-panel">
          <div
            className="mis-table-wrap"
            role="region"
            tabIndex={0}
            aria-label={text(locale, 'Danh sách bài tập', 'Assignments list')}
          >
            <table className="mis-table">
              <thead>
                <tr>
                  <th>{text(locale, 'Bài tập', 'Assignment')}</th>
                  <th>{text(locale, 'Kỹ năng', 'Skill')}</th>
                  <th>{text(locale, 'Lớp học', 'Class')}</th>
                  <th>{text(locale, 'Hạn nộp', 'Due')}</th>
                  <th>{text(locale, 'Trạng thái', 'Status')}</th>
                  <th>{text(locale, 'Bài nộp', 'Submissions')}</th>
                  <th>{text(locale, 'Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => (
                  <tr key={task.id}>
                    <td className="mc-title-cell">{task.title[locale]}</td>
                    <td>
                      <span className="mc-capitalize">{task.skill}</span>
                    </td>
                    <td>{courses.find((course) => course.id === task.courseId)?.title}</td>
                    <td className="mc-date">
                      {new Date(task.due).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </td>
                    <td>
                      <Status published={task.published} locale={locale} />
                    </td>
                    <td>
                      <span className="mc-submission-count">
                        {state.submissions.filter((item) => item.taskId === task.id).length}{' '}
                        {text(locale, 'đã nộp', 'submitted')}
                      </span>
                      <span className="mc-small">
                        {
                          state.submissions.filter(
                            (item) => item.taskId === task.id && item.status === 'submitted',
                          ).length
                        }{' '}
                        {text(locale, 'chờ nhận xét', 'awaiting review')}
                      </span>
                    </td>
                    <td>
                      <div className="mc-actions">
                        <button
                          type="button"
                          className="mis-button mc-compact"
                          onClick={() => {
                            setDetail(detail === task.id ? null : task.id)
                          }}
                        >
                          {text(locale, 'Chi tiết', 'Details')}
                        </button>
                        {canEdit(role) && (
                          <button
                            type="button"
                            className="mis-button mc-compact"
                            onClick={() => {
                              setEditingOriginal(structuredClone(task))
                              setEditing({
                                ...task,
                                title: { ...task.title },
                                instructions: { ...assignmentInstructions(task) },
                              })
                              setFeedback(null)
                            }}
                            aria-label={text(
                              locale,
                              `Sửa ${task.title[locale]}`,
                              `Edit ${task.title[locale]}`,
                            )}
                          >
                            {text(locale, 'Sửa', 'Edit')}
                          </button>
                        )}
                        {(role === 'teacher' || role === 'admin') &&
                          onReviewAssignment &&
                          state.submissions.some((item) => item.taskId === task.id) && (
                            <button
                              type="button"
                              className="mis-button mc-compact"
                              onClick={() => onReviewAssignment(task.id)}
                            >
                              {role === 'teacher'
                                ? text(locale, 'Nhận xét', 'Review')
                                : text(locale, 'Xem bài nộp', 'View submissions')}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <Empty locale={locale} />}
        </div>
      )}
      {selected && (
        <section className="mis-panel mc-article">
          <div className="mc-panel-heading">
            <h2>{selected.title[locale]}</h2>
            <button type="button" className="mis-button mc-compact" onClick={() => setDetail(null)}>
              {text(locale, 'Đóng', 'Close')}
            </button>
          </div>
          <p>
            {text(locale, 'Kỹ năng', 'Skill')}:{' '}
            <span className="mc-capitalize">{selected.skill}</span>
          </p>
          <p>
            {assignmentInstructions(selected)[locale] ||
              text(
                locale,
                'Chưa có đề bài. Giáo viên cần bổ sung trước khi học viên làm bài.',
                'No instructions yet. The teacher needs to add them before students begin.',
              )}
          </p>
        </section>
      )}
    </div>
  )
}

function NotificationsView({
  state,
  commit,
  locale,
  role,
  sharedPreview = false,
}: ManagementViewProps & Pick<Props, 'sharedPreview'>) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState<PortalRole | 'all'>('student')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const canView = (recipientRole: PortalRole | 'all') =>
    role === 'admin' ||
    recipientRole === 'all' ||
    recipientRole === role ||
    (role === 'teacher' && recipientRole === 'student')
  const isRead = (notice: ManagementState['notifications'][number]) =>
    notice.readBy ? notice.readBy.includes(role) : notice.read
  const visible = state.notifications.filter(
    (notice) => canView(notice.recipient) && (!unreadOnly || !isRead(notice)),
  )
  const unread = state.notifications.filter(
    (notice) => canView(notice.recipient) && !isRead(notice),
  ).length

  function markRead(id?: string) {
    const ok = commit((current) => ({
      ...current,
      notifications: current.notifications.map((notice) =>
        canView(notice.recipient) && (!id || notice.id === id)
          ? {
              ...notice,
              readBy: Array.from(new Set([...(notice.readBy ?? (notice.read ? roles : [])), role])),
            }
          : notice,
      ),
    }))
    setFeedback({
      ok,
      text: ok
        ? text(
            locale,
            'Đã đánh dấu thông báo đã đọc trong bản thử.',
            'Notification marked as read in this preview.',
          )
        : text(
            locale,
            'Chưa lưu được trạng thái đã đọc. Hãy thử lại.',
            'Could not save read status. Please try again.',
          ),
    })
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit(role)) return
    if (!title.trim() || !body.trim()) {
      setFeedback({
        ok: false,
        text: text(
          locale,
          'Nhập tiêu đề và nội dung thông báo.',
          'Enter a notification title and message.',
        ),
      })
      return
    }
    const target = role === 'teacher' ? 'student' : recipient
    const notice = {
      id: `notice-${crypto.randomUUID()}`,
      title: title.trim(),
      body: body.trim(),
      recipient: target,
      read: false,
      readBy: [],
      date: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    }
    const ok = commit((current) => ({
      ...current,
      notifications: [notice, ...current.notifications],
    }))
    setFeedback({
      ok,
      text: ok
        ? text(
            locale,
            `Đã đăng thông báo mẫu cho ${roleNames[target as PortalRole]?.vi ?? 'tất cả vai trò'}. Chỉ lưu trên thiết bị, chưa gửi email.`,
            `Sample notification posted for ${roleNames[target as PortalRole]?.en ?? 'all roles'}. Saved on this device only; no email sent.`,
          )
        : text(
            locale,
            'Chưa lưu được thông báo. Nội dung vẫn ở trong biểu mẫu.',
            'Could not save the notification. Your content is still in the form.',
          ),
    })
    if (ok) {
      setComposing(false)
      setTitle('')
      setBody('')
    }
  }

  return (
    <div className="mc-content">
      <div className="mis-toolbar mc-notification-toolbar">
        <label className="mc-check">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          <span>
            {text(locale, 'Chỉ thông báo chưa đọc', 'Unread only')} ({unread})
          </span>
        </label>
        <div className="mc-actions">
          <button
            type="button"
            className="mis-button"
            disabled={!unread}
            onClick={() => markRead()}
          >
            <Check size={17} aria-hidden="true" />
            {text(locale, 'Đánh dấu tất cả đã đọc', 'Mark all as read')}
          </button>
          {canEdit(role) && (
            <button
              type="button"
              className="mis-button mis-primary"
              onClick={() => {
                setComposing(!composing)
                setFeedback(null)
              }}
            >
              <Plus size={17} aria-hidden="true" />
              {text(locale, 'Soạn thông báo', 'Compose notification')}
            </button>
          )}
        </div>
      </div>
      <p className="mis-notice">
        {text(
          locale,
          sharedPreview
            ? 'Thông báo dùng thử được chia sẻ giữa các vai trò trên trình duyệt này. Trạng thái đã đọc lưu riêng cho từng vai trò. Chưa gửi email.'
            : 'Thông báo chỉ lưu trong dữ liệu mẫu của tài khoản hiện tại trên trình duyệt này. Chưa gửi đến tài khoản khác hoặc email.',
          sharedPreview
            ? 'Trial notifications are shared across preview roles in this browser. Read status is separate for each role. No email is sent.'
            : 'Notifications stay in the current account’s sample data in this browser. They are not delivered to other accounts or by email.',
        )}
      </p>
      <FeedbackMessage feedback={feedback} />
      {composing && (
        <form className="mis-panel mc-form" onSubmit={publish}>
          <h2>{text(locale, 'Thông báo mới', 'New notification')}</h2>
          <div className="mc-form-grid">
            <label className="mis-field">
              <span>{text(locale, 'Tiêu đề', 'Title')}</span>
              <input
                required
                maxLength={140}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="mis-field">
              <span>{text(locale, 'Nhóm nhận', 'Recipient group')}</span>
              <select
                value={recipient}
                disabled={role === 'teacher'}
                onChange={(event) => setRecipient(event.target.value as PortalRole | 'all')}
              >
                <option value="all">{text(locale, 'Tất cả vai trò', 'All roles')}</option>
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {roleNames[value][locale]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mis-field">
            <span>{text(locale, 'Nội dung', 'Message')}</span>
            <textarea
              required
              maxLength={2000}
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <div className="mc-actions">
            <button type="submit" className="mis-button mis-primary">
              {text(locale, 'Đăng thông báo mẫu', 'Post sample notification')}
            </button>
            <button type="button" className="mis-button" onClick={() => setComposing(false)}>
              {text(locale, 'Hủy', 'Cancel')}
            </button>
          </div>
        </form>
      )}
      <section
        className="mis-panel"
        aria-label={text(locale, 'Hộp thông báo', 'Notification inbox')}
      >
        {visible.length ? (
          <ul className="mc-notification-list">
            {visible.map((notice) => (
              <li key={notice.id} className={isRead(notice) ? '' : 'mc-unread'}>
                <Bell size={21} aria-hidden="true" />
                <div className="mc-notification-body">
                  <div className="mc-notification-title">
                    <h2>{notice.title}</h2>
                    {!isRead(notice) && (
                      <span className="mis-status">{text(locale, 'Chưa đọc', 'Unread')}</span>
                    )}
                  </div>
                  <p>{notice.body}</p>
                  <time dateTime={notice.date}>
                    {new Date(notice.date).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                      dateStyle: 'medium',
                    })}{' '}
                    (UTC+07)
                    {' · '}
                    {text(locale, 'Nhóm nhận mẫu', 'Sample recipients')}:{' '}
                    {notice.recipient === 'all'
                      ? text(locale, 'Tất cả vai trò', 'All roles')
                      : roleNames[notice.recipient][locale]}
                  </time>
                </div>
                {!isRead(notice) && (
                  <button
                    type="button"
                    className="mis-button mc-compact"
                    onClick={() => markRead(notice.id)}
                  >
                    {text(locale, 'Đánh dấu đã đọc', 'Mark as read')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mis-empty">
            {unreadOnly
              ? text(locale, 'Bạn đã đọc hết thông báo.', 'You are all caught up.')
              : text(
                  locale,
                  'Chưa có thông báo cho vai trò này.',
                  'No notifications for this role yet.',
                )}
          </p>
        )}
      </section>
    </div>
  )
}

function UsersView({ state, commit, locale, role }: ManagementViewProps) {
  const [query, setQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [editing, setEditing] = useState<ManagementUser | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  if (role !== 'admin')
    return (
      <p className="mis-notice">
        {text(
          locale,
          'Danh sách tài khoản chỉ có trong chế độ quản trị viên.',
          'The account list is available in administrator mode only.',
        )}
      </p>
    )
  const rows = state.users.filter(
    (user) =>
      (!filterRole || user.role === filterRole) &&
      `${user.name} ${user.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || role !== 'admin') return
    const user = {
      ...editing,
      name: editing.name.trim(),
      email: editing.email.trim().toLowerCase(),
    }
    if (
      !user.name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
      !roles.includes(user.role)
    ) {
      setFeedback({
        ok: false,
        text: text(
          locale,
          'Nhập tên, email và vai trò hợp lệ.',
          'Enter a valid name, email, and role.',
        ),
      })
      return
    }
    if (
      state.users.some((item) => item.id !== user.id && item.email.toLowerCase() === user.email)
    ) {
      setFeedback({
        ok: false,
        text: text(
          locale,
          'Email này đã có trong danh sách mẫu. Hãy dùng email khác.',
          'This email already exists in the sample list. Use a different email.',
        ),
      })
      return
    }
    const ok = commit((current) => ({
      ...current,
      users: current.users.some((item) => item.id === user.id)
        ? current.users.map((item) => (item.id === user.id ? user : item))
        : [...current.users, user],
    }))
    setFeedback({
      ok,
      text: ok
        ? text(
            locale,
            'Đã cập nhật danh sách tài khoản mẫu. Thông tin đăng nhập không thay đổi.',
            'Sample account list updated. Sign-in credentials have not changed.',
          )
        : text(
            locale,
            'Chưa lưu được tài khoản mẫu. Hãy thử lại.',
            'Could not save the sample account. Please try again.',
          ),
    })
    if (ok) setEditing(null)
  }

  return (
    <div className="mc-content">
      <p className="mis-notice">
        {text(
          locale,
          'Danh sách tài khoản mẫu để thử giao diện quản trị. Thêm, đổi vai trò hoặc khóa tại đây không tạo tài khoản đăng nhập và không thay đổi quyền truy cập thật.',
          'A sample account list for trying administration. Adding users, changing roles, or deactivating them does not create sign-in accounts or change real access permissions.',
        )}
      </p>
      <div className="mis-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label={text(locale, 'Tìm tên hoặc email', 'Search name or email')}
        />
        <label className="mis-field mc-filter">
          <span>{text(locale, 'Vai trò', 'Role')}</span>
          <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
            <option value="">{text(locale, 'Tất cả vai trò', 'All roles')}</option>
            {roles.map((value) => (
              <option key={value} value={value}>
                {roleNames[value][locale]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mis-button mis-primary mc-toolbar-action"
          onClick={() => {
            setFeedback(null)
            setEditing({
              id: `user-${crypto.randomUUID()}`,
              name: '',
              email: '',
              role: 'student',
              active: true,
            })
          }}
        >
          <Plus size={17} aria-hidden="true" />
          {text(locale, 'Thêm tài khoản mẫu', 'Add sample account')}
        </button>
      </div>
      <FeedbackMessage feedback={feedback} />
      {editing && (
        <form className="mis-panel mc-form" onSubmit={save}>
          <h2>{text(locale, 'Thông tin tài khoản mẫu', 'Sample account details')}</h2>
          <div className="mc-form-grid">
            <label className="mis-field">
              <span>{text(locale, 'Họ tên', 'Full name')}</span>
              <input
                required
                maxLength={100}
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </label>
            <label className="mis-field">
              <span>Email</span>
              <input
                type="email"
                required
                maxLength={160}
                value={editing.email}
                onChange={(event) => setEditing({ ...editing, email: event.target.value })}
              />
            </label>
            <label className="mis-field">
              <span>{text(locale, 'Vai trò', 'Role')}</span>
              <select
                value={editing.role}
                onChange={(event) =>
                  setEditing({ ...editing, role: event.target.value as PortalRole })
                }
              >
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {roleNames[value][locale]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mc-check">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
            />
            <span>
              {text(locale, 'Đang hoạt động trong danh sách mẫu', 'Active in the sample list')}
            </span>
          </label>
          <div className="mc-actions">
            <button type="submit" className="mis-button mis-primary">
              {text(locale, 'Lưu tài khoản mẫu', 'Save sample account')}
            </button>
            <button type="button" className="mis-button" onClick={() => setEditing(null)}>
              {text(locale, 'Hủy', 'Cancel')}
            </button>
          </div>
        </form>
      )}
      <div className="mis-panel">
        <div
          className="mis-table-wrap"
          role="region"
          tabIndex={0}
          aria-label={text(locale, 'Danh sách tài khoản mẫu', 'Sample account list')}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th>{text(locale, 'Họ tên', 'Full name')}</th>
                <th>Email</th>
                <th>{text(locale, 'Vai trò', 'Role')}</th>
                <th>{text(locale, 'Trạng thái', 'Status')}</th>
                <th>{text(locale, 'Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td className="mc-title-cell">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleNames[user.role][locale]}</td>
                  <td>
                    <span className={`mis-status ${user.active ? 'mc-published' : 'mc-draft'}`}>
                      {user.active
                        ? text(locale, 'Hoạt động', 'Active')
                        : text(locale, 'Tạm khóa', 'Inactive')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="mis-button mc-compact"
                      aria-label={text(locale, `Sửa ${user.name}`, `Edit ${user.name}`)}
                      onClick={() => {
                        setEditing({ ...user })
                        setFeedback(null)
                      }}
                    >
                      <PencilSimple size={16} aria-hidden="true" />
                      {text(locale, 'Sửa', 'Edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty locale={locale} />}
      </div>
    </div>
  )
}

export function ContentViews(props: Props) {
  switch (props.section) {
    case 'syllabus':
      return <SyllabusView key={props.role} {...props} />
    case 'materials':
      return <MaterialsView key={props.role} {...props} />
    case 'assignments':
      return <AssignmentsView key={props.role} {...props} />
    case 'notifications':
      return <NotificationsView key={props.role} {...props} />
    case 'users':
      return <UsersView key={props.role} {...props} />
  }
}
