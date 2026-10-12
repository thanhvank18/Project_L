/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Labeled scroll regions need a tab stop for keyboard table scrolling. */
import { useState, type FormEvent } from 'react'
import { Plus, MagnifyingGlass, PencilSimple, Check, X, CaretRight } from '@phosphor-icons/react'
import { visibleCourseIds, visibleLearners } from '@/features/management/model'
import type {
  ManagementAttendance,
  ManagementCourse,
  ManagementGrade,
  ManagementLearner,
  ManagementViewProps,
} from '@/features/management/types'

type AcademicSection = 'students' | 'courses' | 'attendance' | 'grading' | 'reports'
const tx = (vi: boolean, vietnamese: string, english: string) => (vi ? vietnamese : english)
const courseName = (props: ManagementViewProps, id: string) =>
  props.state.courses.find((v) => v.id === id)?.title ?? id

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
    <label className="ma-search">
      <MagnifyingGlass size={18} aria-hidden="true" />
      <input
        type="search"
        className="mis-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
      />
    </label>
  )
}

function CourseFilter({
  props,
  value,
  onChange,
}: {
  props: ManagementViewProps
  value: string
  onChange: (value: string) => void
}) {
  const vi = props.locale === 'vi'
  const ids = visibleCourseIds(props.state, props.role)
  return (
    <label className="ma-filter">
      <span className="ma-sr-only">{tx(vi, 'Lọc theo lớp', 'Filter by class')}</span>
      <select className="mis-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{tx(vi, 'Tất cả lớp', 'All classes')}</option>
        {props.state.courses
          .filter((v) => ids.includes(v.id))
          .map((v) => (
            <option value={v.id} key={v.id}>
              {v.title}
            </option>
          ))}
      </select>
    </label>
  )
}

function SaveMessage({ message, error }: { message: string; error: boolean }) {
  return message ? (
    <p className={error ? 'ma-feedback ma-error' : 'ma-feedback'} role={error ? 'alert' : 'status'}>
      {message}
    </p>
  ) : null
}

function LearnerEditor({
  props,
  learner,
  onClose,
  onSaved,
}: {
  props: ManagementViewProps
  learner: ManagementLearner | null
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [name, setName] = useState(learner?.name ?? '')
  const [email, setEmail] = useState(learner?.email ?? '')
  const [courseId, setCourseId] = useState(learner?.courseId ?? props.state.courses[0]?.id ?? '')
  const [status, setStatus] = useState<ManagementLearner['status']>(learner?.status ?? 'active')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (props.role !== 'admin') return
    if (!name.trim() || !email.trim() || !courseId) {
      setError(tx(vi, 'Điền tên, email và chọn lớp.', 'Enter a name, email and class.'))
      return
    }
    if (
      props.state.learners.some(
        (v) => v.id !== learner?.id && v.email.toLowerCase() === email.trim().toLowerCase(),
      )
    ) {
      setError(
        tx(
          vi,
          'Email này đã có trong danh sách mẫu.',
          'This email is already in the sample roster.',
        ),
      )
      return
    }
    const item: ManagementLearner = {
      id: learner?.id ?? `learner-${crypto.randomUUID()}`,
      name: name.trim(),
      email: email.trim(),
      courseId,
      status,
    }
    const saved = props.commit((state) => ({
      ...state,
      learners: learner
        ? state.learners.map((v) => (v.id === learner.id ? item : v))
        : [...state.learners, item],
    }))
    if (saved) onSaved()
    else
      setError(
        tx(
          vi,
          'Chưa lưu được. Kiểm tra bộ nhớ trình duyệt rồi thử lại.',
          'Could not save. Check browser storage and try again.',
        ),
      )
  }
  return (
    <form className="ma-editor mis-panel" onSubmit={submit}>
      <div className="ma-heading">
        <h2>
          {learner
            ? tx(vi, 'Chỉnh sửa học viên mẫu', 'Edit sample learner')
            : tx(vi, 'Thêm học viên mẫu', 'Add sample learner')}
        </h2>
        <button
          className="mis-button"
          type="button"
          onClick={onClose}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <div className="ma-form-grid">
        <label className="mis-field">
          {tx(vi, 'Họ và tên', 'Full name')}
          <input required maxLength={140} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mis-field">
          Email
          <input
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mis-field">
          {tx(vi, 'Lớp học', 'Class')}
          <select
            required
            disabled={Boolean(learner)}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {props.state.courses.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
        <label className="mis-field">
          {tx(vi, 'Trạng thái', 'Status')}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ManagementLearner['status'])}
          >
            <option value="active">{tx(vi, 'Đang học', 'Active')}</option>
            <option value="paused">{tx(vi, 'Tạm dừng', 'Paused')}</option>
          </select>
        </label>
      </div>
      {learner && (
        <p className="ma-help">
          {tx(
            vi,
            'Chuyển lớp có dữ liệu học tập cần quy trình ghi danh riêng; biểu mẫu này giữ nguyên lớp hiện tại.',
            'Class transfers with academic history require a separate enrollment workflow; this form keeps the current class.',
          )}
        </p>
      )}
      <SaveMessage message={error} error />
      <div className="ma-actions">
        <button className="mis-button mis-primary" type="submit">
          <Check size={17} />
          {tx(vi, 'Lưu trên thiết bị', 'Save on this device')}
        </button>
        <button className="mis-button" type="button" onClick={onClose}>
          {tx(vi, 'Hủy', 'Cancel')}
        </button>
      </div>
    </form>
  )
}

function StudentsView(props: ManagementViewProps) {
  const vi = props.locale === 'vi'
  const [query, setQuery] = useState('')
  const [course, setCourse] = useState('')
  const [editor, setEditor] = useState<ManagementLearner | 'new' | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const learners = visibleLearners(props.state, props.role).filter(
    (v) =>
      (!course || v.courseId === course) &&
      `${v.name} ${v.email} ${v.id}`.toLowerCase().includes(query.toLowerCase()),
  )
  const detail = learners.find((v) => v.id === detailId)
  return (
    <div className="ma-view">
      <div className="ma-heading">
        <div>
          <p>
            {tx(
              vi,
              'Danh sách và hồ sơ theo lớp được phân công.',
              'Roster and profiles for assigned classes.',
            )}
          </p>
        </div>
        {props.role === 'admin' && (
          <button
            className="mis-button mis-primary"
            onClick={() => {
              setEditor('new')
              setSaved(false)
            }}
          >
            <Plus size={18} />
            {tx(vi, 'Thêm học viên', 'Add student')}
          </button>
        )}
      </div>
      {editor !== null && props.role === 'admin' && (
        <LearnerEditor
          key={editor === 'new' ? 'new' : editor.id}
          props={props}
          learner={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setSaved(true)
          }}
        />
      )}
      {saved && (
        <p role="status">
          {tx(vi, 'Đã lưu thay đổi trên thiết bị.', 'Changes saved on this device.')}
        </p>
      )}
      <section className="mis-panel">
        <div className="mis-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            label={tx(vi, 'Tìm tên, email hoặc mã học viên', 'Search name, email or learner ID')}
          />
          <CourseFilter props={props} value={course} onChange={setCourse} />
          <span className="ma-count">
            {learners.length} {tx(vi, 'học viên', 'students')}
          </span>
        </div>
        <div
          className="mis-table-wrap"
          role="region"
          aria-label={tx(
            vi,
            'Danh sách học viên, có thể cuộn ngang',
            'Student list, scroll horizontally',
          )}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th>{tx(vi, 'Học viên', 'Student')}</th>
                <th>{tx(vi, 'Lớp', 'Class')}</th>
                <th>{tx(vi, 'Trạng thái', 'Status')}</th>
                <th>{tx(vi, 'Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.name}</strong>
                    <span className="ma-cell-sub">{v.email}</span>
                  </td>
                  <td>{courseName(props, v.courseId)}</td>
                  <td>
                    <span className={`mis-status ma-status-${v.status}`}>
                      {v.status === 'active'
                        ? tx(vi, 'Đang học', 'Active')
                        : tx(vi, 'Tạm dừng', 'Paused')}
                    </span>
                  </td>
                  <td>
                    <div className="ma-row-actions">
                      <button
                        className="mis-button"
                        onClick={() => setDetailId(detailId === v.id ? null : v.id)}
                        aria-expanded={detailId === v.id}
                      >
                        {tx(vi, 'Hồ sơ', 'Profile')}
                        <CaretRight size={15} />
                      </button>
                      {props.role === 'admin' && (
                        <button
                          className="mis-button"
                          onClick={() => setEditor(v)}
                          aria-label={`${tx(vi, 'Sửa', 'Edit')} ${v.name}`}
                        >
                          <PencilSimple size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {learners.length === 0 && (
          <div className="mis-empty">
            {tx(
              vi,
              'Không tìm thấy học viên. Thử từ khóa khác hoặc bỏ lọc lớp.',
              'No students found. Try another search or clear the class filter.',
            )}
          </div>
        )}
      </section>
      {detail && (
        <section className="mis-panel ma-detail">
          <div className="ma-heading">
            <h2>{detail.name}</h2>
            <button className="mis-button" onClick={() => setDetailId(null)}>
              {tx(vi, 'Đóng hồ sơ', 'Close profile')}
            </button>
          </div>
          <dl className="ma-definition">
            <div>
              <dt>{tx(vi, 'Mã học viên', 'Learner ID')}</dt>
              <dd>{detail.id}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{detail.email}</dd>
            </div>
            <div>
              <dt>{tx(vi, 'Lớp', 'Class')}</dt>
              <dd>{courseName(props, detail.courseId)}</dd>
            </div>
            <div>
              <dt>{tx(vi, 'Kết quả mẫu đã nhận xét', 'Reviewed sample results')}</dt>
              <dd>
                {props.state.grades.filter((v) => v.learnerId === detail.id && v.reviewed).length}
              </dd>
            </div>
          </dl>
          <p className="ma-help">
            {tx(
              vi,
              'Hồ sơ minh họa; không chứa tài liệu, ghi chú riêng hoặc thông tin học viên thật.',
              'Illustrative profile; no real student records, private notes or personal documents.',
            )}
          </p>
        </section>
      )}
    </div>
  )
}

function CourseEditor({
  props,
  course,
  onClose,
  onSaved,
}: {
  props: ManagementViewProps
  course: ManagementCourse | null
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [title, setTitle] = useState(course?.title ?? '')
  const [level, setLevel] = useState(course?.level ?? '')
  const [teacher, setTeacher] = useState(course?.teacher ?? '')
  const [status, setStatus] = useState<ManagementCourse['status']>(course?.status ?? 'draft')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (props.role !== 'admin') return
    if (![title, level, teacher].every((v) => v.trim())) {
      setError(
        tx(
          vi,
          'Điền đủ tên lớp, trình độ và giáo viên.',
          'Enter the class name, level and teacher.',
        ),
      )
      return
    }
    const next: ManagementCourse = {
      id: course?.id ?? `course-${crypto.randomUUID()}`,
      title: title.trim(),
      level: level.trim(),
      teacher: teacher.trim(),
      status,
    }
    if (
      props.commit((state) => ({
        ...state,
        courses: course
          ? state.courses.map((v) => (v.id === course.id ? next : v))
          : [...state.courses, next],
      }))
    )
      onSaved()
    else
      setError(
        tx(
          vi,
          'Chưa lưu được lớp. Kiểm tra bộ nhớ trình duyệt rồi thử lại.',
          'Could not save the class. Check browser storage and retry.',
        ),
      )
  }
  return (
    <form className="mis-panel ma-editor" onSubmit={submit}>
      <div className="ma-heading">
        <h2>
          {course
            ? tx(vi, 'Chỉnh sửa lớp mẫu', 'Edit sample class')
            : tx(vi, 'Tạo lớp mẫu', 'Create sample class')}
        </h2>
        <button
          className="mis-button"
          type="button"
          onClick={onClose}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <div className="ma-form-grid">
        <label className="mis-field">
          {tx(vi, 'Tên lớp', 'Class name')}
          <input
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mis-field">
          {tx(vi, 'Trình độ', 'Level')}
          <input required maxLength={50} value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label className="mis-field">
          {tx(vi, 'Giáo viên mẫu', 'Sample teacher')}
          <input
            required
            maxLength={140}
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
          />
        </label>
        <label className="mis-field">
          {tx(vi, 'Trạng thái', 'Status')}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ManagementCourse['status'])}
          >
            <option value="draft">{tx(vi, 'Bản nháp', 'Draft')}</option>
            <option value="active">{tx(vi, 'Đang mở', 'Active')}</option>
          </select>
        </label>
      </div>
      <SaveMessage message={error} error />
      <div className="ma-actions">
        <button type="submit" className="mis-button mis-primary">
          {tx(vi, 'Lưu lớp trên thiết bị', 'Save class on this device')}
        </button>
        <button type="button" className="mis-button" onClick={onClose}>
          {tx(vi, 'Hủy', 'Cancel')}
        </button>
      </div>
    </form>
  )
}

function CoursesView(props: ManagementViewProps) {
  const vi = props.locale === 'vi'
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<ManagementCourse | 'new' | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const ids = visibleCourseIds(props.state, props.role)
  const courses = props.state.courses.filter(
    (v) =>
      ids.includes(v.id) &&
      `${v.title} ${v.level} ${v.teacher}`.toLowerCase().includes(query.toLowerCase()),
  )
  const detail = courses.find((v) => v.id === detailId)
  return (
    <div className="ma-view">
      <div className="ma-heading">
        <div>
          <p>
            {tx(
              vi,
              'Lớp, chương trình và học viên trong phạm vi của bạn.',
              'Classes, curriculum and learners in your scope.',
            )}
          </p>
        </div>
        {props.role === 'admin' && (
          <button className="mis-button mis-primary" onClick={() => setEditor('new')}>
            <Plus size={18} />
            {tx(vi, 'Tạo lớp', 'Create class')}
          </button>
        )}
      </div>
      {editor !== null && props.role === 'admin' && (
        <CourseEditor
          key={editor === 'new' ? 'new' : editor.id}
          props={props}
          course={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setSaved(true)
          }}
        />
      )}
      {saved && (
        <SaveMessage
          message={tx(vi, 'Đã lưu lớp mẫu trên thiết bị.', 'Sample class saved on this device.')}
          error={false}
        />
      )}
      <section className="mis-panel">
        <div className="mis-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            label={tx(vi, 'Tìm lớp, trình độ, giáo viên', 'Search class, level or teacher')}
          />
          <span className="ma-count">
            {courses.length} {tx(vi, 'lớp', 'classes')}
          </span>
        </div>
        <div
          className="mis-table-wrap"
          role="region"
          aria-label={tx(vi, 'Danh sách lớp, có thể cuộn ngang', 'Class list, scroll horizontally')}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th>{tx(vi, 'Tên lớp', 'Class')}</th>
                <th>{tx(vi, 'Giáo viên', 'Teacher')}</th>
                <th>{tx(vi, 'Học viên', 'Students')}</th>
                <th>{tx(vi, 'Trạng thái', 'Status')}</th>
                <th>{tx(vi, 'Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.title}</strong>
                    <span className="ma-cell-sub">{v.level}</span>
                  </td>
                  <td>{v.teacher}</td>
                  <td>
                    {props.role === 'student'
                      ? tx(vi, 'Đã ghi danh', 'Enrolled')
                      : props.state.learners.filter((l) => l.courseId === v.id).length}
                  </td>
                  <td>
                    <span className={`mis-status ma-status-${v.status}`}>
                      {v.status === 'active'
                        ? tx(vi, 'Đang mở', 'Active')
                        : tx(vi, 'Bản nháp', 'Draft')}
                    </span>
                  </td>
                  <td>
                    <div className="ma-row-actions">
                      <button
                        className="mis-button"
                        onClick={() => setDetailId(detailId === v.id ? null : v.id)}
                        aria-expanded={detailId === v.id}
                      >
                        {tx(vi, 'Chi tiết', 'Details')}
                      </button>
                      {props.role === 'admin' && (
                        <button
                          className="mis-button"
                          onClick={() => setEditor(v)}
                          aria-label={`${tx(vi, 'Sửa lớp', 'Edit class')} ${v.title}`}
                        >
                          <PencilSimple size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {courses.length === 0 && (
          <p className="mis-empty">
            {tx(
              vi,
              'Không có lớp phù hợp. Thử tìm kiếm khác.',
              'No matching classes. Try another search.',
            )}
          </p>
        )}
      </section>
      {detail && (
        <section className="mis-panel ma-detail">
          <div className="ma-heading">
            <h2>{detail.title}</h2>
            <button className="mis-button" onClick={() => setDetailId(null)}>
              {tx(vi, 'Đóng chi tiết', 'Close details')}
            </button>
          </div>
          <p>
            {detail.level} · {detail.teacher}
          </p>
          <h3>{tx(vi, 'Chương trình mẫu', 'Sample curriculum')}</h3>
          <ul className="ma-unit-list">
            {props.state.units
              .filter((v) => v.courseId === detail.id)
              .map((v) => (
                <li key={v.id}>
                  <span>{v.title[props.locale]}</span>
                  <span className="mis-status">
                    {v.done ? tx(vi, 'Đã dạy', 'Delivered') : tx(vi, 'Sắp học', 'Upcoming')}
                  </span>
                </li>
              ))}
          </ul>
          {!props.state.units.some((v) => v.courseId === detail.id) && (
            <p className="mis-empty">
              {tx(vi, 'Chưa có chủ đề cho lớp này.', 'No curriculum topics for this class yet.')}
            </p>
          )}
          <div className="ma-actions">
            <a className="mis-button" href="#syllabus">
              {tx(vi, 'Chương trình học', 'Syllabus')}
            </a>
            <a className="mis-button" href="#assignments">
              {tx(vi, 'Xem bài tập', 'View assignments')}
            </a>
            <a className="mis-button" href="#schedule">
              {tx(vi, 'Xem lịch học', 'View timetable')}
            </a>
          </div>
        </section>
      )}
    </div>
  )
}

function AttendanceView(props: ManagementViewProps) {
  const vi = props.locale === 'vi'
  const [course, setCourse] = useState('')
  const [day, setDay] = useState('2026-10-12')
  const [edits, setEdits] = useState<Record<string, ManagementAttendance['status']>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const learners = visibleLearners(props.state, props.role).filter(
    (v) => !course || v.courseId === course,
  )
  const canEdit = props.role === 'admin' || props.role === 'teacher'
  const statusFor = (learnerId: string) =>
    edits[`${day}:${learnerId}`] ??
    props.state.attendance.find((v) => v.learnerId === learnerId && v.date === day)?.status ??
    'unmarked'
  const statusLabel = (status: ManagementAttendance['status']) =>
    ({
      present: tx(vi, 'Có mặt', 'Present'),
      absent: tx(vi, 'Vắng', 'Absent'),
      late: tx(vi, 'Đi muộn', 'Late'),
      unmarked: tx(vi, 'Chưa điểm danh', 'Unmarked'),
    })[status]
  function save() {
    if (!canEdit || !day) return
    const saved = props.commit((state) => {
      const attendance = [...state.attendance]
      for (const learner of learners) {
        const status = edits[`${day}:${learner.id}`]
        if (!status) continue
        const index = attendance.findIndex((v) => v.date === day && v.learnerId === learner.id)
        const item: ManagementAttendance = {
          id: index >= 0 ? attendance[index]!.id : `attendance-${crypto.randomUUID()}`,
          learnerId: learner.id,
          courseId: learner.courseId,
          date: day,
          status,
        }
        if (index >= 0) attendance[index] = item
        else attendance.push(item)
      }
      return { ...state, attendance }
    })
    setError(!saved)
    setMessage(
      saved
        ? tx(vi, 'Đã lưu điểm danh mẫu trên thiết bị.', 'Sample attendance saved on this device.')
        : tx(
            vi,
            'Chưa lưu được. Kiểm tra bộ nhớ trình duyệt rồi thử lại.',
            'Could not save. Check browser storage and retry.',
          ),
    )
    if (saved) setEdits({})
  }
  const changed = learners.some((v) => edits[`${day}:${v.id}`] !== undefined)
  return (
    <div className="ma-view">
      <div className="ma-heading">
        <div>
          <p>
            {tx(
              vi,
              'Theo dõi từng buổi trong dữ liệu mẫu. Chưa đồng bộ Zoom.',
              'Track sample session attendance. Zoom is not connected.',
            )}
          </p>
        </div>
      </div>
      {props.role === 'assistant' && (
        <p className="mis-notice">
          {tx(
            vi,
            'Trợ giảng được xem chuyên cần. Chỉnh sửa cần quyền ủy nhiệm riêng, chưa được cấp trong bản thử này.',
            'Teaching assistants can review attendance. Editing requires explicit delegation, which is not assigned in this preview.',
          )}
        </p>
      )}
      <section className="mis-panel">
        <div className="mis-toolbar">
          <label className="ma-filter">
            <span>{tx(vi, 'Ngày học', 'Session date')}</span>
            <input
              type="date"
              className="mis-field"
              required
              value={day}
              onChange={(e) => {
                setDay(e.target.value)
                setEdits({})
                setMessage('')
              }}
            />
          </label>
          <CourseFilter
            props={props}
            value={course}
            onChange={(value) => {
              setCourse(value)
              setEdits({})
              setMessage('')
            }}
          />
          <span className="ma-count">
            {learners.length} {tx(vi, 'học viên', 'students')}
          </span>
        </div>
        <div
          className="mis-table-wrap"
          role="region"
          aria-label={tx(
            vi,
            'Bảng điểm danh, có thể cuộn ngang',
            'Attendance table, scroll horizontally',
          )}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                <th>{tx(vi, 'Học viên', 'Student')}</th>
                <th>{tx(vi, 'Lớp', 'Class')}</th>
                <th>{tx(vi, 'Chuyên cần', 'Attendance')}</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.name}</strong>
                  </td>
                  <td>{courseName(props, v.courseId)}</td>
                  <td>
                    {canEdit ? (
                      <select
                        className="mis-field"
                        aria-label={`${tx(vi, 'Điểm danh', 'Attendance for')} ${v.name}`}
                        value={statusFor(v.id)}
                        onChange={(e) => {
                          setEdits({
                            ...edits,
                            [`${day}:${v.id}`]: e.target.value as ManagementAttendance['status'],
                          })
                          setMessage('')
                        }}
                      >
                        {(['unmarked', 'present', 'late', 'absent'] as const).map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`mis-status ma-status-${statusFor(v.id)}`}>
                        {statusLabel(statusFor(v.id))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {learners.length === 0 && (
          <p className="mis-empty">
            {tx(vi, 'Chưa có học viên trong lớp này.', 'No students in this class yet.')}
          </p>
        )}
        {canEdit && (
          <div className="ma-panel-footer">
            <button className="mis-button mis-primary" onClick={save} disabled={!changed || !day}>
              <Check size={17} />
              {tx(vi, 'Lưu điểm danh', 'Save attendance')}
            </button>
            <span className="ma-help">
              {tx(
                vi,
                'Lưu trên thiết bị, không gửi thông báo.',
                'Saved on this device; no notifications sent.',
              )}
            </span>
          </div>
        )}
      </section>
      <SaveMessage message={message} error={error} />
    </div>
  )
}

function GradeEditor({
  props,
  grade,
  onClose,
  onSaved,
}: {
  props: ManagementViewProps
  grade: ManagementGrade
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [score, setScore] = useState(grade.score?.toString() ?? '')
  const [feedback, setFeedback] = useState(grade.feedback)
  const [error, setError] = useState('')
  const learner = props.state.learners.find((v) => v.id === grade.learnerId)
  const task = props.state.tasks.find((v) => v.id === grade.taskId)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (props.role !== 'teacher') return
    const value = Number(score)
    if (!score.trim() || !Number.isFinite(value) || value < 0 || value > 9 || !feedback.trim()) {
      setError(
        tx(vi, 'Nhập điểm từ 0 đến 9 và nhận xét.', 'Enter a score from 0 to 9 and feedback.'),
      )
      return
    }
    const saved = props.commit((state) => ({
      ...state,
      grades: state.grades.map((v) =>
        v.id === grade.id ? { ...v, score: value, feedback: feedback.trim(), reviewed: true } : v,
      ),
    }))
    if (saved) onSaved()
    else
      setError(
        tx(
          vi,
          'Chưa lưu được nhận xét. Kiểm tra bộ nhớ trình duyệt rồi thử lại.',
          'Could not save feedback. Check browser storage and retry.',
        ),
      )
  }
  return (
    <form className="mis-panel ma-editor" onSubmit={submit}>
      <div className="ma-heading">
        <h2>{tx(vi, 'Nhận xét kết quả mẫu', 'Review sample result')}</h2>
        <button
          type="button"
          className="mis-button"
          onClick={onClose}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <p>
        {learner?.name} · {task?.title[props.locale]}
      </p>
      <p className="ma-help">
        {tx(
          vi,
          'Đây là bản ghi kết quả minh họa, không phải bài làm thật hoặc kết quả AI.',
          'This is an illustrative result record, not real submitted work or an AI assessment.',
        )}
      </p>
      <div className="ma-form-grid">
        <label className="mis-field">
          {tx(vi, 'Điểm mẫu (0–9)', 'Sample score (0–9)')}
          <input
            required
            type="number"
            min="0"
            max="9"
            step="0.5"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </label>
        <label className="mis-field ma-wide">
          {tx(vi, 'Nhận xét', 'Feedback')}
          <textarea
            required
            maxLength={4000}
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
      </div>
      <SaveMessage message={error} error />
      <div className="ma-actions">
        <button type="submit" className="mis-button mis-primary">
          {tx(vi, 'Lưu nhận xét mẫu', 'Save sample feedback')}
        </button>
        <button className="mis-button" type="button" onClick={onClose}>
          {tx(vi, 'Hủy', 'Cancel')}
        </button>
      </div>
    </form>
  )
}

function ResultsView({
  section,
  ...props
}: ManagementViewProps & { section: 'grading' | 'reports' }) {
  const vi = props.locale === 'vi'
  const [course, setCourse] = useState('')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [editorId, setEditorId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const learners = visibleLearners(props.state, props.role)
  const ids = new Set(learners.map((v) => v.id))
  const grades = props.state.grades.filter((v) => {
    const task = props.state.tasks.find((t) => t.id === v.taskId)
    const learner = learners.find((l) => l.id === v.learnerId)
    return (
      ids.has(v.learnerId) &&
      (!course || task?.courseId === course) &&
      (status === 'all' || (status === 'reviewed' ? v.reviewed : !v.reviewed)) &&
      `${learner?.name} ${task?.title[props.locale]}`.toLowerCase().includes(query.toLowerCase())
    )
  })
  const editor = grades.find((v) => v.id === editorId)
  const canGrade = section === 'grading' && props.role === 'teacher'
  return (
    <div className="ma-view">
      <div className="ma-heading">
        <div>
          <p>
            {tx(
              vi,
              'Kết quả minh họa theo học viên và kỹ năng.',
              'Illustrative results by learner and skill.',
            )}
          </p>
        </div>
      </div>
      <p className="mis-notice">
        {tx(
          vi,
          'Bản ghi điểm mẫu độc lập với bài Reading/Writing bạn nộp thử. Chưa có chấm AI hoặc công bố báo cáo từ máy chủ.',
          'Sample result records are separate from your local Reading/Writing submissions. AI grading and server report publication are not connected.',
        )}
      </p>
      {section === 'grading' && (props.role === 'admin' || props.role === 'assistant') && (
        <p className="ma-help">
          {tx(
            vi,
            'Vai trò này được xem kết quả mẫu; quyền sửa điểm học thuật chưa được cấp.',
            'This role can review sample results; academic grade editing has not been granted.',
          )}
        </p>
      )}
      {editor && canGrade && (
        <GradeEditor
          key={editor.id}
          props={props}
          grade={editor}
          onClose={() => setEditorId(null)}
          onSaved={() => {
            setEditorId(null)
            setSaved(true)
          }}
        />
      )}
      {saved && (
        <SaveMessage
          message={tx(
            vi,
            'Đã lưu nhận xét mẫu trên thiết bị.',
            'Sample feedback saved on this device.',
          )}
          error={false}
        />
      )}
      <section className="mis-panel">
        <div className="mis-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            label={tx(vi, 'Tìm học viên hoặc bài tập', 'Search learner or assignment')}
          />
          <CourseFilter props={props} value={course} onChange={setCourse} />
          <label className="ma-filter">
            <span className="ma-sr-only">{tx(vi, 'Trạng thái nhận xét', 'Review status')}</span>
            <select
              className="mis-field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">{tx(vi, 'Tất cả trạng thái', 'All statuses')}</option>
              <option value="pending">{tx(vi, 'Chưa nhận xét', 'Awaiting feedback')}</option>
              <option value="reviewed">{tx(vi, 'Đã nhận xét', 'Reviewed')}</option>
            </select>
          </label>
        </div>
        <div
          className="mis-table-wrap"
          role="region"
          aria-label={tx(
            vi,
            'Bảng kết quả mẫu, có thể cuộn ngang',
            'Sample results, scroll horizontally',
          )}
          tabIndex={0}
        >
          <table className="mis-table">
            <thead>
              <tr>
                {props.role !== 'student' && <th>{tx(vi, 'Học viên', 'Student')}</th>}
                <th>{tx(vi, 'Bài tập', 'Assignment')}</th>
                <th>{tx(vi, 'Điểm mẫu', 'Sample score')}</th>
                <th>{tx(vi, 'Trạng thái', 'Status')}</th>
                <th>{tx(vi, 'Phản hồi', 'Feedback')}</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((v) => {
                const task = props.state.tasks.find((t) => t.id === v.taskId)
                return (
                  <tr key={v.id}>
                    {props.role !== 'student' && (
                      <td>{learners.find((l) => l.id === v.learnerId)?.name}</td>
                    )}
                    <td>
                      <strong>{task?.title[props.locale]}</strong>
                      <span className="ma-cell-sub">
                        {task ? courseName(props, task.courseId) : ''}
                      </span>
                    </td>
                    <td>{v.score === null ? '—' : `${v.score} / 9`}</td>
                    <td>
                      <span className={`mis-status ma-status-${v.reviewed ? 'present' : 'draft'}`}>
                        {v.reviewed
                          ? tx(vi, 'Đã nhận xét', 'Reviewed')
                          : tx(vi, 'Chưa nhận xét', 'Awaiting feedback')}
                      </span>
                    </td>
                    <td>
                      {canGrade ? (
                        <button className="mis-button" onClick={() => setEditorId(v.id)}>
                          {v.reviewed
                            ? tx(vi, 'Sửa nhận xét', 'Edit feedback')
                            : tx(vi, 'Nhận xét', 'Review')}
                        </button>
                      ) : (
                        <button
                          className="mis-button"
                          aria-expanded={expandedId === v.id}
                          onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                        >
                          {tx(vi, 'Xem phản hồi', 'View feedback')}
                        </button>
                      )}
                      {expandedId === v.id && (
                        <p className="ma-inline-feedback">
                          {v.feedback ||
                            tx(
                              vi,
                              'Chưa có nhận xét cho bản ghi mẫu này.',
                              'No feedback for this sample record yet.',
                            )}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {grades.length === 0 && (
          <p className="mis-empty">
            {tx(
              vi,
              'Chưa có kết quả phù hợp. Thử bỏ bộ lọc.',
              'No matching results. Try clearing the filters.',
            )}
          </p>
        )}
      </section>
    </div>
  )
}

export function AcademicViews({
  section,
  ...props
}: ManagementViewProps & { section: AcademicSection }) {
  if (section === 'students') return <StudentsView {...props} />
  if (section === 'courses') return <CoursesView {...props} />
  if (section === 'attendance') return <AttendanceView {...props} />
  return <ResultsView {...props} section={section} />
}
