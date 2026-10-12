/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The labeled table regions support keyboard scrolling. */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MagnifyingGlass, PencilSimple, Plus, X } from '@phosphor-icons/react'
import type { Account, Classroom, Role } from '../../../shared/portal'
import { PortalApiError } from '@/features/auth/client'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import '@/styles/live-administration.css'

const tx = (vi: boolean, vietnamese: string, english: string) => (vi ? vietnamese : english)
const roles: Role[] = ['admin', 'teacher', 'assistant', 'student']
const roleName = (role: Role, vi: boolean) =>
  ({
    admin: tx(vi, 'Quản trị viên', 'Administrator'),
    teacher: tx(vi, 'Giáo viên', 'Teacher'),
    assistant: tx(vi, 'Trợ giảng', 'Teaching assistant'),
    student: tx(vi, 'Học viên', 'Student'),
  })[role]

function useAdministrationEditor(
  props: LiveViewProps,
  record: { version: number } | null,
  latest: { version: number } | undefined,
  input: string,
  onClose: () => void,
  onSaved: () => void,
) {
  const vi = props.locale === 'vi'
  const [initialInput] = useState(input)
  const [expectedVersion, setExpectedVersion] = useState(record?.version ?? 0)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [conflicted, setConflicted] = useState(false)
  const [freshAfterConflict, setFreshAfterConflict] = useState(false)
  const pending = useRef(false)
  const dirty = input !== initialInput
  const available =
    props.state.user.active && props.state.user.role === 'admin' && (!record || Boolean(latest))
  const changed = Boolean(record && latest && latest.version !== expectedVersion)

  useEffect(() => {
    if (!dirty && !busy && !refreshing) return
    const allowLeave = () =>
      !pending.current &&
      !refreshing &&
      (!dirty ||
        window.confirm(
          tx(
            vi,
            'Biểu mẫu có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?',
            'This form has unsaved changes. Leave and discard them?',
          ),
        ))
    const unload = (event: BeforeUnloadEvent) => event.preventDefault()
    const routeLeave = (event: Event) => {
      if (!allowLeave()) event.preventDefault()
    }
    const leave = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest('a[href], .mis-signout') : null
      if (
        !target ||
        target.getAttribute('href')?.startsWith('#') ||
        target.hasAttribute('download') ||
        target.getAttribute('target') === '_blank'
      )
        return
      if (!allowLeave()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('project-l:before-leave', routeLeave)
    document.addEventListener('click', leave, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('project-l:before-leave', routeLeave)
      document.removeEventListener('click', leave, true)
    }
  }, [dirty, busy, refreshing, vi])

  function close() {
    if (pending.current || refreshing) return
    if (
      !dirty ||
      window.confirm(
        tx(
          vi,
          'Biểu mẫu có thay đổi chưa lưu. Đóng và bỏ các thay đổi?',
          'This form has unsaved changes. Close and discard them?',
        ),
      )
    )
      onClose()
  }
  async function refresh() {
    if (pending.current || refreshing) return
    setRefreshing(true)
    try {
      await props.refresh()
      setFreshAfterConflict(true)
    } catch (cause) {
      setError(cause)
    } finally {
      setRefreshing(false)
    }
  }
  function acknowledge() {
    if (pending.current || refreshing || !available || !latest || (!changed && !freshAfterConflict))
      return
    setExpectedVersion(latest.version)
    setConflicted(false)
    setFreshAfterConflict(false)
    setError(null)
  }
  async function save(type: string, payload: Record<string, unknown>) {
    if (pending.current || refreshing || !available || changed || conflicted) return
    pending.current = true
    setBusy(true)
    setFreshAfterConflict(false)
    setError(null)
    try {
      await props.run(type, payload)
      onSaved()
    } catch (cause) {
      setError(cause)
      if (record && cause instanceof PortalApiError && cause.status === 409) setConflicted(true)
      if (cause instanceof PortalApiError && [403, 404, 409].includes(cause.status))
        await props
          .refresh()
          .then(() => setFreshAfterConflict(true))
          .catch(() => undefined)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return {
    expectedVersion,
    busy,
    refreshing,
    error: error ? errorMessage(error, props.locale) : '',
    available,
    changed,
    conflicted,
    canAcknowledge: available && Boolean(latest) && (changed || freshAfterConflict),
    saveBlocked: !available || changed || conflicted || refreshing,
    close,
    refresh,
    acknowledge,
    save,
  }
}

function EditorRecovery({
  editor,
  vi,
  children,
}: {
  editor: ReturnType<typeof useAdministrationEditor>
  vi: boolean
  children?: ReactNode
}) {
  if (editor.available && !editor.changed && !editor.conflicted) return null
  return (
    <div className="mis-notice" role="status">
      <p>
        {!editor.available
          ? tx(
              vi,
              'Bản ghi hoặc quyền chỉnh sửa không còn khả dụng. Nội dung đang nhập vẫn được giữ; tải lại để kiểm tra.',
              'This record or your editing access is unavailable. Your input is kept; refresh to check the current state.',
            )
          : tx(
              vi,
              'Dữ liệu đã thay đổi hoặc có thông tin trùng. Kiểm tra bản đã lưu bên dưới và điều chỉnh biểu mẫu trước khi dùng phiên bản mới nhất. Các giá trị đang nhập sẽ thay thế các trường tương ứng khi bạn bấm Lưu.',
              'The record changed or contains duplicate information. Review the saved record below and adjust the form before using the latest version. Saving will replace the corresponding fields with your entered values.',
            )}
      </p>
      {children && (
        <details open>
          <summary>{tx(vi, 'Bản đã lưu hiện tại', 'Current saved record')}</summary>
          <div className="live-prose">{children}</div>
        </details>
      )}
      <div className="live-actions">
        <button
          className="mis-button"
          type="button"
          disabled={editor.busy || editor.refreshing}
          onClick={() => void editor.refresh()}
        >
          {editor.refreshing
            ? tx(vi, 'Đang tải…', 'Refreshing…')
            : tx(vi, 'Tải bản mới nhất', 'Refresh latest record')}
        </button>
        {editor.available && (
          <button
            className="mis-button"
            type="button"
            disabled={editor.busy || editor.refreshing || !editor.canAcknowledge}
            onClick={editor.acknowledge}
          >
            {tx(
              vi,
              'Giữ nội dung đang nhập và dùng phiên bản mới nhất',
              'Keep my input and use the latest version',
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function UserEditor({
  props,
  account,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  account: Account | null
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [name, setName] = useState(account?.name ?? '')
  const [email, setEmail] = useState(account?.email ?? '')
  const [role, setRole] = useState<Role>(account?.role ?? 'student')
  const [active, setActive] = useState(account?.active ?? true)
  const [password, setPassword] = useState('')
  const latest = account ? props.state.users.find((user) => user.id === account.id) : undefined
  const editor = useAdministrationEditor(
    props,
    account,
    latest,
    JSON.stringify([name, email, role, active, password]),
    onClose,
    onSaved,
  )
  const { busy, refreshing, error } = editor
  async function submit(event: FormEvent) {
    event.preventDefault()
    await editor.save(
      account ? 'user.update' : 'user.create',
      account
        ? {
            id: account.id,
            version: editor.expectedVersion,
            name: name.trim(),
            email: email.trim(),
            role,
            active,
            ...(password ? { password } : {}),
          }
        : { name: name.trim(), email: email.trim(), role, password },
    )
  }
  return (
    <form className="mis-panel live-editor" onSubmit={submit}>
      <div className="live-heading">
        <h2>
          {account
            ? tx(vi, 'Chỉnh sửa tài khoản', 'Edit account')
            : tx(vi, 'Tạo tài khoản', 'Create account')}
        </h2>
        <button
          type="button"
          className="mis-button"
          disabled={busy || refreshing}
          onClick={editor.close}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <EditorRecovery editor={editor} vi={vi}>
        {latest && (
          <>
            <p>
              <strong>{latest.name}</strong> · {latest.email} · v{latest.version}
            </p>
            <p>
              {roleName(latest.role, vi)} ·{' '}
              {latest.active
                ? tx(vi, 'Cho phép đăng nhập', 'Sign-in enabled')
                : tx(vi, 'Đã khóa', 'Sign-in disabled')}
            </p>
            {password && (
              <p>
                {tx(
                  vi,
                  'Biểu mẫu đang chứa mật khẩu mới. Lưu tài khoản sẽ đổi mật khẩu và thu hồi các phiên đăng nhập của tài khoản này.',
                  'The form contains a new password. Saving will reset the password and revoke this account’s sign-in sessions.',
                )}
              </p>
            )}
          </>
        )}
      </EditorRecovery>
      <fieldset disabled={busy || refreshing} className="live-fieldset">
        <div className="live-form-grid">
          <label className="mis-field">
            {tx(vi, 'Họ và tên', 'Full name')}
            <input
              required
              maxLength={140}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="mis-field">
            Email
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="mis-field">
            {tx(vi, 'Vai trò', 'Role')}
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {roles.map((value) => (
                <option key={value} value={value}>
                  {roleName(value, vi)}
                </option>
              ))}
            </select>
          </label>
          <label className="mis-field">
            {account
              ? tx(vi, 'Mật khẩu mới (không bắt buộc)', 'New password (optional)')
              : tx(vi, 'Mật khẩu ban đầu', 'Initial password')}
            <input
              required={!account}
              type="password"
              minLength={12}
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <span className="live-help">
              {tx(vi, 'Ít nhất 12 ký tự.', 'At least 12 characters.')}
            </span>
          </label>
          {account && (
            <label className="live-check">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              {tx(vi, 'Cho phép đăng nhập', 'Allow sign-in')}
            </label>
          )}
        </div>
        <div className="live-actions">
          <button className="mis-button mis-primary" type="submit" disabled={editor.saveBlocked}>
            {busy
              ? tx(vi, 'Đang lưu…', 'Saving…')
              : account
                ? tx(vi, 'Lưu tài khoản', 'Save account')
                : tx(vi, 'Tạo tài khoản', 'Create account')}
          </button>
          <button className="mis-button" type="button" onClick={editor.close}>
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

function ClassEditor({
  props,
  classroom,
  onClose,
  onSaved,
}: {
  props: LiveViewProps
  classroom: Classroom | null
  onClose: () => void
  onSaved: () => void
}) {
  const vi = props.locale === 'vi'
  const [title, setTitle] = useState(classroom?.title ?? '')
  const [level, setLevel] = useState(classroom?.level ?? '')
  const [description, setDescription] = useState(classroom?.description ?? '')
  const [active, setActive] = useState(classroom?.active ?? true)
  const [listed, setListed] = useState(classroom?.listed ?? false)
  const [enrollmentOpen, setEnrollmentOpen] = useState(classroom?.enrollmentOpen ?? false)
  const [teacherIds, setTeachers] = useState(classroom?.teacherIds ?? [])
  const [assistantIds, setAssistants] = useState(classroom?.assistantIds ?? [])
  const [studentIds, setStudents] = useState(classroom?.studentIds ?? [])
  const latest = classroom
    ? props.state.classes.find((value) => value.id === classroom.id)
    : undefined
  const editor = useAdministrationEditor(
    props,
    classroom,
    latest,
    JSON.stringify([
      title,
      level,
      description,
      active,
      listed,
      enrollmentOpen,
      [...teacherIds].sort(),
      [...assistantIds].sort(),
      [...studentIds].sort(),
    ]),
    onClose,
    onSaved,
  )
  const { busy, refreshing, error } = editor
  async function submit(event: FormEvent) {
    event.preventDefault()
    await editor.save('class.save', {
      id: classroom?.id,
      expectedVersion: editor.expectedVersion,
      title: title.trim(),
      level: level.trim(),
      description: description.trim(),
      active,
      listed,
      enrollmentOpen,
      teacherIds,
      assistantIds,
      studentIds,
    })
  }
  const groups = [
    {
      role: 'teacher',
      label: tx(vi, 'Giáo viên phụ trách', 'Assigned teachers'),
      ids: teacherIds,
      set: setTeachers,
    },
    {
      role: 'assistant',
      label: tx(vi, 'Trợ giảng', 'Teaching assistants'),
      ids: assistantIds,
      set: setAssistants,
    },
    {
      role: 'student',
      label: tx(vi, 'Học viên trong lớp', 'Enrolled students'),
      ids: studentIds,
      set: setStudents,
    },
  ]
  return (
    <form className="mis-panel live-editor" onSubmit={submit}>
      <div className="live-heading">
        <h2>
          {classroom
            ? tx(vi, 'Chỉnh sửa lớp học', 'Edit class')
            : tx(vi, 'Tạo lớp học', 'Create class')}
        </h2>
        <button
          className="mis-button"
          type="button"
          disabled={busy || refreshing}
          onClick={editor.close}
          aria-label={tx(vi, 'Đóng biểu mẫu', 'Close form')}
        >
          <X size={18} />
        </button>
      </div>
      <EditorRecovery editor={editor} vi={vi}>
        {latest && (
          <>
            <p>
              <strong>{latest.title}</strong> ·{' '}
              {latest.level || tx(vi, 'Chưa đặt trình độ', 'No level set')} · v{latest.version}
            </p>
            {latest.description && <p>{latest.description}</p>}
            <p>
              {latest.active ? tx(vi, 'Đang hoạt động', 'Active') : tx(vi, 'Đã đóng', 'Closed')} ·{' '}
              {latest.listed ? tx(vi, 'Công khai', 'Listed') : tx(vi, 'Riêng tư', 'Private')} ·{' '}
              {latest.enrollmentOpen
                ? tx(vi, 'Mở đăng ký', 'Enrollment open')
                : tx(vi, 'Đóng đăng ký', 'Enrollment closed')}
            </p>
            {groups.map((group) => {
              const ids =
                group.role === 'teacher'
                  ? latest.teacherIds
                  : group.role === 'assistant'
                    ? latest.assistantIds
                    : latest.studentIds
              return (
                <p key={group.role}>
                  <strong>{group.label}:</strong>{' '}
                  {ids
                    .map((id) => {
                      const user = props.state.users.find((value) => value.id === id)
                      return user ? `${user.name} (${user.email})` : id
                    })
                    .join('; ') || tx(vi, 'Chưa có', 'None')}
                </p>
              )
            })}
          </>
        )}
      </EditorRecovery>
      <fieldset disabled={busy || refreshing} className="live-fieldset">
        <div className="live-form-grid">
          <label className="mis-field">
            {tx(vi, 'Tên lớp', 'Class name')}
            <input
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="mis-field">
            {tx(vi, 'Trình độ', 'Level')}
            <input
              maxLength={80}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            />
          </label>
          <label className="mis-field live-wide">
            {tx(vi, 'Mô tả', 'Description')}
            <textarea
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="live-check live-wide">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            {tx(vi, 'Lớp đang hoạt động', 'Active class')}
          </label>
          <label className="live-check live-wide">
            <input
              type="checkbox"
              checked={listed}
              onChange={(event) => setListed(event.target.checked)}
            />
            {tx(vi, 'Hiển thị trong danh mục công khai', 'Show in the public course catalog')}
          </label>
          <label className="live-check live-wide">
            <input
              type="checkbox"
              checked={enrollmentOpen}
              onChange={(event) => setEnrollmentOpen(event.target.checked)}
            />
            <span>
              {tx(vi, 'Mở đăng ký cho học viên', 'Open student enrollment')}
              <small>
                {tx(
                  vi,
                  'Lớp phải đang hoạt động và hiển thị công khai. Yêu cầu đăng ký cần quản trị viên duyệt.',
                  'The class must be active and publicly listed. Enrollment requests require administrator approval.',
                )}
              </small>
            </span>
          </label>
          {groups.map((group) => (
            <fieldset className="live-membership" key={group.role}>
              <legend>{group.label}</legend>
              <div className="live-member-list">
                {props.state.users
                  .filter(
                    (user) =>
                      (user.role === group.role && user.active) || group.ids.includes(user.id),
                  )
                  .map((user) => (
                    <label key={user.id} className="live-check">
                      <input
                        type="checkbox"
                        checked={group.ids.includes(user.id)}
                        onChange={(event) =>
                          group.set(
                            event.target.checked
                              ? [...group.ids, user.id]
                              : group.ids.filter((id) => id !== user.id),
                          )
                        }
                      />
                      <span>
                        {user.name}
                        <small>
                          {user.email}
                          {!user.active && ` · ${tx(vi, 'Đã khóa', 'Inactive')}`}
                          {user.role !== group.role &&
                            ` · ${tx(vi, 'Vai trò hiện tại', 'Current role')}: ${roleName(user.role, vi)}`}
                        </small>
                      </span>
                    </label>
                  ))}
                {!props.state.users.some(
                  (user) =>
                    (user.role === group.role && user.active) || group.ids.includes(user.id),
                ) && (
                  <p className="live-help">
                    {tx(
                      vi,
                      'Chưa có tài khoản phù hợp. Tạo tài khoản trong mục Người dùng.',
                      'No matching accounts. Create an account in Users.',
                    )}
                  </p>
                )}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="live-actions">
          <button className="mis-button mis-primary" type="submit" disabled={editor.saveBlocked}>
            {busy ? tx(vi, 'Đang lưu…', 'Saving…') : tx(vi, 'Lưu lớp học', 'Save class')}
          </button>
          <button className="mis-button" type="button" onClick={editor.close}>
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

export function AdministrationViews({
  section,
  ...props
}: LiveViewProps & { section: 'users' | 'classes' | 'students' }) {
  const vi = props.locale === 'vi'
  const admin = props.state.user.role === 'admin'
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [userEditor, setUserEditor] = useState<Account | null | undefined>()
  const [classEditor, setClassEditor] = useState<Classroom | null | undefined>()
  const [message, setMessage] = useState('')
  const title =
    section === 'users'
      ? tx(vi, 'Người dùng', 'Users')
      : section === 'classes'
        ? tx(vi, 'Lớp học', 'Classes')
        : tx(vi, 'Học viên', 'Students')
  const search = query.trim().toLocaleLowerCase(props.locale)
  const users = props.state.users.filter(
    (user) =>
      (section !== 'students' || user.role === 'student') &&
      (section !== 'students' ||
        !classFilter ||
        props.state.classes
          .find((value) => value.id === classFilter)
          ?.studentIds.includes(user.id)) &&
      `${user.name} ${user.email} ${roleName(user.role, vi)}`
        .toLocaleLowerCase(props.locale)
        .includes(search),
  )
  const classes = props.state.classes.filter((value) =>
    `${value.title} ${value.level}`.toLocaleLowerCase(props.locale).includes(search),
  )
  function saved() {
    setUserEditor(undefined)
    setClassEditor(undefined)
    setMessage(tx(vi, 'Đã lưu trên máy chủ.', 'Saved to the server.'))
  }
  if (section === 'users' && !admin)
    return (
      <div className="live-admin">
        <p className="live-empty">
          {tx(
            vi,
            'Chỉ quản trị viên được quản lý tài khoản.',
            'Only administrators can manage accounts.',
          )}
        </p>
      </div>
    )
  return (
    <div className="live-admin">
      <div className="live-heading">
        <div>
          <p>
            {section === 'classes'
              ? tx(
                  vi,
                  'Lớp học, giáo viên và danh sách ghi danh.',
                  'Classes, teaching teams and enrollment.',
                )
              : section === 'users'
                ? tx(
                    vi,
                    'Tạo tài khoản đăng nhập và quản lý quyền truy cập.',
                    'Create sign-in accounts and manage access.',
                  )
                : tx(
                    vi,
                    'Danh sách học viên trong các lớp bạn được truy cập.',
                    'Students in the classes you can access.',
                  )}
          </p>
        </div>
        {admin && section !== 'students' && (
          <button
            className="mis-button mis-primary"
            disabled={userEditor !== undefined || classEditor !== undefined}
            onClick={() => {
              setMessage('')
              if (section === 'users') setUserEditor(null)
              else setClassEditor(null)
            }}
          >
            <Plus size={18} aria-hidden="true" />
            {section === 'users'
              ? tx(vi, 'Tạo tài khoản', 'Create account')
              : tx(vi, 'Tạo lớp học', 'Create class')}
          </button>
        )}
      </div>
      {message && (
        <p className="live-success" role="status">
          {message}
        </p>
      )}
      {section === 'users' && userEditor !== undefined && (
        <UserEditor
          key={userEditor?.id ?? 'new'}
          props={props}
          account={userEditor}
          onClose={() => setUserEditor(undefined)}
          onSaved={saved}
        />
      )}
      {section === 'classes' && classEditor !== undefined && (
        <ClassEditor
          key={classEditor?.id ?? 'new'}
          props={props}
          classroom={classEditor}
          onClose={() => setClassEditor(undefined)}
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
            aria-label={tx(vi, 'Tìm kiếm', 'Search')}
            placeholder={
              section === 'classes'
                ? tx(vi, 'Tìm tên lớp, trình độ…', 'Search classes, levels…')
                : tx(vi, 'Tìm tên hoặc email…', 'Search names or email…')
            }
          />
        </label>
        {section === 'students' && (
          <label className="mis-field live-filter">
            {tx(vi, 'Lớp học', 'Class')}
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="">{tx(vi, 'Tất cả lớp', 'All classes')}</option>
              {props.state.classes.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="live-help">
          {section === 'classes' ? classes.length : users.length} {tx(vi, 'kết quả', 'results')}
        </span>
      </div>
      {section === 'classes' ? (
        classes.length ? (
          <div className="mis-panel mis-table-wrap" role="region" aria-label={title} tabIndex={0}>
            <table className="mis-table">
              <thead>
                <tr>
                  <th scope="col">{tx(vi, 'Lớp học', 'Class')}</th>
                  <th scope="col">{tx(vi, 'Giáo viên', 'Teachers')}</th>
                  <th scope="col">{tx(vi, 'Học viên', 'Students')}</th>
                  <th scope="col">{tx(vi, 'Trạng thái', 'Status')}</th>
                  {admin && <th scope="col">{tx(vi, 'Thao tác', 'Actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {classes.map((value) => (
                  <tr key={value.id}>
                    <td>
                      <strong>{value.title}</strong>
                      <span className="live-cell-note">{value.level}</span>
                      {value.description && (
                        <span className="live-cell-note live-prose">{value.description}</span>
                      )}
                    </td>
                    <td>
                      {value.teacherIds
                        .map((id) => props.state.users.find((user) => user.id === id)?.name ?? id)
                        .join(', ') || tx(vi, 'Chưa phân công', 'Unassigned')}
                    </td>
                    <td>{value.studentIds.length}</td>
                    <td>
                      <span className={`mis-status ${value.active ? 'live-status-success' : ''}`}>
                        {value.active
                          ? tx(vi, 'Đang hoạt động', 'Active')
                          : tx(vi, 'Đã đóng', 'Closed')}
                      </span>
                      {admin && (
                        <span className="live-cell-note">
                          {value.active && value.listed && value.enrollmentOpen
                            ? tx(vi, 'Đang nhận đăng ký', 'Accepting enrollment requests')
                            : tx(vi, 'Chưa nhận đăng ký', 'Enrollment closed')}
                        </span>
                      )}
                    </td>
                    {admin && (
                      <td>
                        <button
                          className="mis-button"
                          disabled={classEditor !== undefined}
                          onClick={() => {
                            setMessage('')
                            setClassEditor(value)
                          }}
                        >
                          <PencilSimple size={16} aria-hidden="true" />
                          {tx(vi, 'Chỉnh sửa', 'Edit')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mis-panel live-empty">
            {query
              ? tx(vi, 'Không có lớp phù hợp với tìm kiếm.', 'No classes match your search.')
              : admin
                ? tx(
                    vi,
                    'Chưa có lớp học. Tạo lớp và chọn các tài khoản để bắt đầu.',
                    'No classes yet. Create a class and select its members to begin.',
                  )
                : tx(
                    vi,
                    'Bạn chưa được phân vào lớp học nào. Liên hệ quản trị viên để được ghi danh.',
                    'You have no assigned classes yet. Contact an administrator for enrollment.',
                  )}
          </p>
        )
      ) : users.length ? (
        <div className="mis-panel mis-table-wrap" role="region" aria-label={title} tabIndex={0}>
          <table className="mis-table">
            <thead>
              <tr>
                <th scope="col">{tx(vi, 'Họ và tên', 'Name')}</th>
                <th scope="col">
                  {section === 'users' ? tx(vi, 'Vai trò', 'Role') : tx(vi, 'Lớp học', 'Classes')}
                </th>
                <th scope="col">{tx(vi, 'Trạng thái', 'Status')}</th>
                {section === 'users' && <th scope="col">{tx(vi, 'Thao tác', 'Actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span className="live-cell-note">{user.email}</span>
                  </td>
                  <td>
                    {section === 'users'
                      ? roleName(user.role, vi)
                      : props.state.classes
                          .filter((value) => value.studentIds.includes(user.id))
                          .map((value) => value.title)
                          .join(', ') || tx(vi, 'Chưa ghi danh', 'Not enrolled')}
                  </td>
                  <td>
                    <span className={`mis-status ${user.active ? 'live-status-success' : ''}`}>
                      {user.active
                        ? tx(vi, 'Đang hoạt động', 'Active')
                        : tx(vi, 'Đã khóa', 'Inactive')}
                    </span>
                  </td>
                  {section === 'users' && (
                    <td>
                      <button
                        className="mis-button"
                        disabled={userEditor !== undefined}
                        onClick={() => {
                          setMessage('')
                          setUserEditor(user)
                        }}
                      >
                        <PencilSimple size={16} aria-hidden="true" />
                        {tx(vi, 'Chỉnh sửa', 'Edit')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mis-panel live-empty">
          {query || classFilter
            ? tx(vi, 'Không có tài khoản phù hợp với bộ lọc.', 'No accounts match your filters.')
            : tx(
                vi,
                'Chưa có học viên trong các lớp này. Quản trị viên có thể tạo tài khoản và ghi danh học viên trong mục Lớp học.',
                'No students in these classes yet. An administrator can create accounts and enroll students in Classes.',
              )}
        </p>
      )}
    </div>
  )
}
