import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretRight,
  Check,
  Folder,
  FolderOpen,
  LinkBreak,
} from '@phosphor-icons/react'
import type { Locale } from '../../../shared/portal'
import type {
  DriveAuthorization,
  DriveConnectionStatus,
  DriveFolder,
  DriveFolderPage,
} from '../../../shared/drive'
import { apiRequest, PortalApiError } from '@/features/auth/client'
import '@/styles/live-drive.css'

const translate = (locale: Locale, vi: string, en: string) => (locale === 'vi' ? vi : en)
const json = (body: object): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

function driveError(error: unknown, locale: Locale) {
  const t = (vi: string, en: string) => translate(locale, vi, en)
  if (error instanceof PortalApiError) {
    if (error.status === 401)
      return t(
        'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.',
        'Your session expired. Sign in again to continue.',
      )
    if (error.status === 409)
      return t(
        'Kết nối đã thay đổi. Làm mới trạng thái rồi kiểm tra tài khoản và thư mục trước khi thử lại.',
        'The connection changed. Refresh the status and check the account and folder before retrying.',
      )
    if (error.status === 403)
      return t(
        'Không đủ quyền truy cập. Kiểm tra quyền quản trị và quyền ghi vào thư mục; kết nối lại Google nếu cần.',
        'Access was denied. Check your administrator access and folder write permissions; reconnect Google if needed.',
      )
    if (error.status === 400 || error.status === 404 || error.status === 422)
      return t(
        'Thư mục hoặc kết nối không còn hợp lệ. Làm mới và chọn lại thư mục trên Google Drive.',
        'The folder or connection is no longer valid. Refresh and choose the folder again in Google Drive.',
      )
    if (error.status === 503)
      return t(
        'Kết nối Google chưa sẵn sàng. Làm mới trạng thái hoặc kiểm tra cấu hình máy chủ.',
        'The Google connection is not ready. Refresh the status or check the server configuration.',
      )
    if (error.status === 429)
      return t(
        'Đã có quá nhiều yêu cầu. Đợi một lúc rồi thử lại.',
        'Too many requests. Wait a moment and try again.',
      )
  }
  return t(
    'Chưa hoàn tất thao tác với Google Drive. Kiểm tra kết nối và thử lại; chưa xác nhận thay đổi.',
    'The Google Drive request did not complete. Check your connection and retry; no change has been confirmed.',
  )
}

export function DriveConnectionSettings({ locale }: { locale: Locale }) {
  const t = (vi: string, en: string) => translate(locale, vi, en)
  const headingId = useId()
  const folderChoiceId = useId()
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'connect' | 'save' | 'disconnect' | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<'saved' | 'disconnected' | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [path, setPath] = useState<DriveFolder[]>([])
  const [selected, setSelected] = useState<DriveFolder | null>(null)
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [folderLoading, setFolderLoading] = useState(false)
  const [folderError, setFolderError] = useState<unknown>(null)
  const [callback] = useState(() => new URL(window.location.href).searchParams.get('drive'))
  const mounted = useRef(false)
  const pending = useRef(false)
  const folderRequest = useRef<AbortController | null>(null)
  const browserHeading = useRef<HTMLHeadingElement>(null)

  const loadStatus = useCallback((signal?: AbortSignal) => {
    return apiRequest<DriveConnectionStatus>('portal/drive/status', { signal })
      .then((value) => {
        if (mounted.current && !signal?.aborted) setStatus(value)
      })
      .catch((cause) => {
        if (mounted.current && !signal?.aborted) setError(cause)
      })
      .finally(() => {
        if (mounted.current && !signal?.aborted) setLoading(false)
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void loadStatus(controller.signal)
    const url = new URL(window.location.href)
    if (url.searchParams.has('drive')) {
      url.searchParams.delete('drive')
      window.history.replaceState(window.history.state, '', url)
    }
    return () => {
      mounted.current = false
      controller.abort()
      folderRequest.current?.abort()
    }
  }, [loadStatus])

  useEffect(() => {
    if (browsing) browserHeading.current?.focus({ preventScroll: true })
  }, [browsing])

  async function loadFolders(nextPath: DriveFolder[], pageToken?: string) {
    if (pending.current) return
    folderRequest.current?.abort()
    const controller = new AbortController()
    folderRequest.current = controller
    const parent = nextPath.at(-1)
    const params = new URLSearchParams({ parentId: parent?.id ?? 'root' })
    if (pageToken) params.set('pageToken', pageToken)
    setFolderLoading(true)
    setFolderError(null)
    if (!pageToken) {
      setPath(nextPath)
      setFolders([])
      setNextPageToken(null)
      setSelected(parent ?? null)
    }
    try {
      const result = await apiRequest<DriveFolderPage>(`portal/drive/folders?${params}`, {
        signal: controller.signal,
      })
      if (!mounted.current || controller.signal.aborted) return
      setFolders((previous) =>
        pageToken
          ? [
              ...previous,
              ...result.folders.filter((folder) => !previous.some((old) => old.id === folder.id)),
            ]
          : result.folders,
      )
      setNextPageToken(result.nextPageToken)
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted) setFolderError(cause)
    } finally {
      if (mounted.current && !controller.signal.aborted) setFolderLoading(false)
    }
  }

  async function connect() {
    if (!status?.configured || pending.current || loading || error) return
    pending.current = true
    setBusy('connect')
    setError(null)
    setNotice(null)
    try {
      const result = await apiRequest<DriveAuthorization>(
        'portal/drive/connect',
        json({ expectedVersion: status.version }),
      )
      const url = new URL(result.authorizationUrl)
      if (
        url.protocol !== 'https:' ||
        url.host !== 'accounts.google.com' ||
        url.username ||
        url.password
      )
        throw new Error('Invalid authorization destination')
      if (mounted.current) window.location.assign(url.href)
    } catch (cause) {
      if (mounted.current) setError(cause)
    } finally {
      if (mounted.current) setBusy(null)
      pending.current = false
    }
  }

  async function updateConnection(action: 'save' | 'disconnect') {
    if (
      !status ||
      pending.current ||
      loading ||
      error ||
      (action === 'save' && (!selected || status.authRequired))
    )
      return
    pending.current = true
    setBusy(action)
    setError(null)
    setNotice(null)
    folderRequest.current?.abort()
    try {
      const result = await apiRequest<DriveConnectionStatus>(
        `portal/drive/${action === 'save' ? 'folder' : 'disconnect'}`,
        json({
          expectedVersion: status.version,
          ...(action === 'save' ? { folderId: selected!.id } : {}),
        }),
      )
      if (!mounted.current) return
      setStatus(result)
      setBrowsing(false)
      setDisconnecting(false)
      setSelected(null)
      setNotice(action === 'save' ? 'saved' : 'disconnected')
    } catch (cause) {
      if (mounted.current) setError(cause)
    } finally {
      if (mounted.current) {
        setBusy(null)
        setFolderLoading(false)
      }
      pending.current = false
    }
  }

  const disabled = Boolean(busy || loading || error)
  const active = status?.connected && status.uploadEnabled && !status.authRequired
  const wrongOrigin = Boolean(
    status?.portalOrigin && status.portalOrigin !== window.location.origin,
  )
  return (
    <section className="mis-panel mis-stack live-drive" aria-labelledby={headingId}>
      <div className="live-heading">
        <div>
          <h2 id={headingId}>
            {t('Lưu bài nộp trên Google Drive', 'Submission storage in Google Drive')}
          </h2>
          <p>
            {t(
              'Kết nối Gmail của trung tâm và chọn thư mục nhận các tệp bài nộp mới.',
              'Connect the centre’s Gmail account and choose a folder for new submission files.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="mis-button"
          disabled={loading || Boolean(busy)}
          onClick={() => {
            setNotice(null)
            setLoading(true)
            setError(null)
            void loadStatus()
          }}
        >
          <ArrowClockwise size={17} aria-hidden="true" />
          {t('Làm mới', 'Refresh')}
        </button>
      </div>
      {loading && (
        <p role="status">
          {t('Đang kiểm tra kết nối Google Drive…', 'Checking the Google Drive connection…')}
        </p>
      )}
      {callback === 'connected' && !notice && !loading && status?.connected && (
        <p className="live-success" role="status">
          {t(
            'Đã kết nối Google. Kiểm tra thư mục lưu trước khi bật lưu bài nộp.',
            'Google is connected. Check the destination folder before enabling submission storage.',
          )}
        </p>
      )}
      {(callback === 'error' || callback === 'cancelled') && !notice && (
        <p className="live-help" role="status">
          {t(
            'Chưa hoàn tất đăng nhập Google. Bạn có thể thử kết nối lại.',
            'Google sign-in did not complete. You can try connecting again.',
          )}
        </p>
      )}
      {error !== null && (
        <p className="live-error" role="alert">
          {driveError(error, locale)}
        </p>
      )}
      {notice && (
        <p className="live-success" role="status">
          <Check size={17} aria-hidden="true" />
          {notice === 'saved'
            ? t(
                'Đã chọn thư mục và bật lưu tệp bài nộp mới trên Drive.',
                'Folder selected. New submission files will be stored in Drive.',
              )
            : t(
                'Đã ngắt kết nối. Các tệp mới sẽ được lưu trên máy chủ.',
                'Disconnected. New files will be stored on the server.',
              )}
        </p>
      )}
      {status && (
        <>
          <dl className="live-drive-details">
            <div>
              <dt>{t('Trạng thái', 'Status')}</dt>
              <dd>
                {status.authRequired
                  ? t(
                      'Cần kết nối lại Google. Tạm dừng lưu tệp bài nộp mới cho đến khi khôi phục kết nối.',
                      'Reconnect Google to restore Drive storage. New submission uploads are paused until the connection is restored.',
                    )
                  : active
                    ? t(
                        'Đang lưu tệp bài nộp mới trên Drive',
                        'Saving new submission files to Drive',
                      )
                    : status.connected
                      ? t(
                          'Đã đăng nhập · Chưa bật lưu bài nộp',
                          'Signed in · Submission storage is not enabled',
                        )
                      : t(
                          'Chưa kết nối · Tệp đang lưu trên máy chủ',
                          'Not connected · Files are stored on the server',
                        )}
              </dd>
            </div>
            {status.account && (
              <div>
                <dt>{t('Tài khoản Google', 'Google account')}</dt>
                <dd>
                  {status.account.email}
                  {status.account.name && <span className="live-help">{status.account.name}</span>}
                </dd>
              </div>
            )}
            {status.folder && (
              <div>
                <dt>{t('Thư mục lưu', 'Destination folder')}</dt>
                <dd>
                  <span className="live-drive-folder-name">
                    <Folder size={18} aria-hidden="true" />
                    {status.folder.name}
                  </span>
                  <a
                    href={`https://drive.google.com/drive/folders/${encodeURIComponent(status.folder.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="live-drive-external"
                  >
                    {t('Mở trong Google Drive', 'Open in Google Drive')}
                    <ArrowSquareOut size={15} aria-hidden="true" />
                    <span className="sr-only">{t(' (tab mới)', ' (new tab)')}</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {!status.configured && (
            <p className="live-help">
              {t(
                'Cần cấu hình kết nối Google trên máy chủ trước khi đăng nhập. Người phụ trách kỹ thuật cần tạo ứng dụng OAuth Google và địa chỉ trả về cho website. Không nhập mật khẩu Gmail hoặc khóa bí mật tại đây.',
                'Google sign-in requires server setup first. A technical administrator must configure the Google OAuth application and this website’s callback address. Do not enter a Gmail password or secret key here.',
              )}
            </p>
          )}
          <p className="live-help">
            {t(
              'Đăng nhập bằng Gmail của trung tâm. Google sẽ hỏi quyền truy cập Drive để website duyệt thư mục và lưu bài nộp; quyền OAuth này rộng hơn riêng thư mục được chọn. Chỉ bật lưu sau khi kiểm tra đúng tài khoản và thư mục.',
              'Use the centre’s Google account. Google requests Drive access so the website can browse folders and store submissions; this OAuth permission covers more than the selected folder. Enable storage only after checking the account and folder.',
            )}
          </p>
          {status.previousFilesUnavailable && (
            <p className="live-error">
              {t(
                'Một số tệp đã nộp còn nằm trên Drive và hiện chưa đọc được. Kết nối lại đúng tài khoản Google trước đó để khôi phục quyền đọc các tệp này.',
                'Some earlier submissions remain in Drive and cannot currently be read. Reconnect the same Google account to restore access to these files.',
              )}
            </p>
          )}
          <div className="live-actions">
            <button
              type="button"
              className={`mis-button${status.connected ? '' : ' mis-primary'}`}
              disabled={disabled || !status.configured || wrongOrigin}
              onClick={() => void connect()}
            >
              <ArrowSquareOut size={17} aria-hidden="true" />
              {busy === 'connect'
                ? t('Đang mở Google…', 'Opening Google…')
                : status.connected
                  ? t('Kết nối lại Google', 'Reconnect Google')
                  : t('Đăng nhập Google', 'Sign in with Google')}
            </button>
            {wrongOrigin && status?.portalOrigin && (
              <p className="live-help">
                {t(
                  'Kết nối Google cần thực hiện tại địa chỉ website đã cấu hình. Đăng nhập lại tại ',
                  'Google sign-in requires the configured website address. Sign in again at ',
                )}
                <a href={`${status.portalOrigin}/learn#settings`}>{status.portalOrigin}</a>.
              </p>
            )}
            {(status.connected || status.authRequired) && (
              <>
                {status.connected && (
                  <button
                    type="button"
                    className="mis-button mis-primary"
                    disabled={disabled || browsing || status.authRequired}
                    onClick={() => {
                      setBrowsing(true)
                      setDisconnecting(false)
                      setNotice(null)
                      void loadFolders([])
                    }}
                  >
                    <FolderOpen size={17} aria-hidden="true" />
                    {status.folder
                      ? t('Đổi thư mục', 'Change folder')
                      : t('Chọn thư mục', 'Choose folder')}
                  </button>
                )}
                <button
                  type="button"
                  className="mis-button"
                  disabled={disabled || disconnecting}
                  onClick={() => {
                    folderRequest.current?.abort()
                    setBrowsing(false)
                    setFolderLoading(false)
                    setDisconnecting(true)
                  }}
                >
                  <LinkBreak size={17} aria-hidden="true" />
                  {t('Ngắt kết nối trên website', 'Disconnect from website')}
                </button>
              </>
            )}
          </div>
          {disconnecting && (
            <div className="live-drive-disconnect">
              <p>
                {t(
                  'Ngắt kết nối trên website sẽ chuyển các tệp mới về lưu trên máy chủ và xóa thông tin kết nối Google đã lưu trên máy chủ. Tệp đã lưu trên Drive không bị xóa, nhưng sẽ không đọc được từ website cho đến khi kết nối lại đúng tài khoản Google này.',
                  'Disconnecting from the website switches new files to server storage and deletes the Google connection credentials saved on the server. Existing Drive files are not deleted, but the website cannot read them until you reconnect this same Google account.',
                )}
              </p>
              <p className="live-help">
                {t(
                  'Thao tác này không thu hồi quyền đã cấp trong tài khoản Google. Bạn có thể thu hồi quyền của ứng dụng tại phần kết nối trong tài khoản Google.',
                  'This does not revoke consent in your Google account. You can remove the application’s access from your Google account connections.',
                )}
              </p>
              <div className="live-actions">
                <button
                  type="button"
                  className="mis-button"
                  disabled={Boolean(busy)}
                  onClick={() => setDisconnecting(false)}
                >
                  {t('Giữ kết nối', 'Keep connected')}
                </button>
                <button
                  type="button"
                  className="mis-button"
                  disabled={disabled}
                  onClick={() => void updateConnection('disconnect')}
                >
                  {busy === 'disconnect'
                    ? t('Đang ngắt…', 'Disconnecting…')
                    : t('Xác nhận ngắt kết nối', 'Confirm disconnect')}
                </button>
              </div>
            </div>
          )}
          {browsing && (
            <div className="live-drive-browser">
              <div className="live-heading">
                <h3 tabIndex={-1} ref={browserHeading}>
                  {t(
                    'Chọn thư mục trên Drive của trung tâm',
                    'Choose a folder in the centre’s Drive',
                  )}
                </h3>
                <button
                  type="button"
                  className="mis-button"
                  disabled={folderLoading || disabled || status.authRequired}
                  onClick={() => void loadFolders(path)}
                >
                  <ArrowClockwise size={17} aria-hidden="true" />
                  {t('Tải lại thư mục', 'Refresh folders')}
                </button>
              </div>
              <p className="live-help">
                {t(
                  'Mở thư mục để xem bên trong, hoặc chọn ngay trong danh sách. Việc lưu chỉ được bật sau khi bạn xác nhận.',
                  'Open a folder to browse inside, or select it in the list. Storage is enabled only after you confirm.',
                )}
              </p>
              <nav
                className="live-drive-path"
                aria-label={t('Đường dẫn thư mục Drive', 'Drive folder path')}
              >
                <button
                  type="button"
                  disabled={folderLoading || disabled || path.length === 0}
                  onClick={() => void loadFolders([])}
                >
                  My Drive
                </button>
                {path.map((folder, index) => (
                  <span key={folder.id}>
                    <CaretRight size={14} aria-hidden="true" />
                    <button
                      type="button"
                      aria-current={index === path.length - 1 ? 'location' : undefined}
                      disabled={folderLoading || disabled || index === path.length - 1}
                      onClick={() => void loadFolders(path.slice(0, index + 1))}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </nav>
              {folderLoading && <p role="status">{t('Đang tải thư mục…', 'Loading folders…')}</p>}
              {folderError !== null && (
                <div className="live-drive-error">
                  <p role="alert" className="live-error">
                    {driveError(folderError, locale)}
                  </p>
                  <button
                    type="button"
                    className="mis-button"
                    disabled={folderLoading || disabled}
                    onClick={() => void loadFolders(path, nextPageToken ?? undefined)}
                  >
                    {t('Tải lại thư mục', 'Retry folders')}
                  </button>
                </div>
              )}
              {!folderLoading && folderError === null && folders.length === 0 && (
                <p className="live-help">
                  {path.length > 0
                    ? t(
                        'Không có thư mục con. Bạn có thể dùng thư mục hiện tại.',
                        'There are no subfolders. You can use the current folder.',
                      )
                    : t(
                        'Chưa có thư mục để chọn. Tạo một thư mục trong Google Drive rồi tải lại.',
                        'There are no folders to choose from. Create a folder in Google Drive, then refresh this list.',
                      )}
                </p>
              )}
              {folders.length > 0 && (
                <fieldset className="live-drive-folders" disabled={folderLoading || disabled}>
                  <legend className="sr-only">
                    {t('Thư mục có thể chọn', 'Available folders')}
                  </legend>
                  {folders.map((folder) => (
                    <div className="live-drive-row" key={folder.id}>
                      <input
                        type="radio"
                        name={folderChoiceId}
                        aria-label={t(
                          `Chọn thư mục ${folder.name}`,
                          `Select folder ${folder.name}`,
                        )}
                        checked={selected?.id === folder.id}
                        onChange={() => setSelected(folder)}
                      />
                      <button
                        type="button"
                        onClick={() => void loadFolders([...path, folder])}
                        aria-label={t(`Mở thư mục ${folder.name}`, `Open folder ${folder.name}`)}
                      >
                        <Folder size={20} aria-hidden="true" />
                        <span>{folder.name}</span>
                        <CaretRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </fieldset>
              )}
              {nextPageToken && (
                <button
                  type="button"
                  className="mis-button"
                  disabled={folderLoading || disabled}
                  onClick={() => void loadFolders(path, nextPageToken)}
                >
                  {t('Tải thêm thư mục', 'Load more folders')}
                </button>
              )}
              {path.length > 0 && selected?.id !== path.at(-1)?.id && (
                <button
                  type="button"
                  className="mis-button"
                  disabled={folderLoading || disabled}
                  onClick={() => setSelected(path.at(-1)!)}
                >
                  {t('Chọn thư mục hiện tại', 'Select current folder')}
                </button>
              )}
              <p className="live-drive-selection" aria-live="polite">
                {t('Thư mục đã chọn:', 'Selected folder:')}{' '}
                <strong>{selected?.name ?? t('Chưa chọn', 'None selected')}</strong>
              </p>
              <div className="live-actions">
                <button
                  type="button"
                  className="mis-button mis-primary"
                  disabled={
                    !selected ||
                    disabled ||
                    folderLoading ||
                    Boolean(folderError) ||
                    status.authRequired
                  }
                  onClick={() => void updateConnection('save')}
                >
                  {busy === 'save'
                    ? t('Đang xác nhận…', 'Confirming…')
                    : t('Dùng thư mục này để lưu bài nộp', 'Use this folder for submissions')}
                </button>
                <button
                  type="button"
                  className="mis-button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    folderRequest.current?.abort()
                    setBrowsing(false)
                    setFolderLoading(false)
                  }}
                >
                  {t('Đóng chọn thư mục', 'Close folder browser')}
                </button>
              </div>
            </div>
          )}
          <p className="live-help">
            {t(
              'Chỉ các tệp bài nộp mới dùng thư mục được chọn. Tệp đã lưu giữ nguyên vị trí; điểm, nhận xét và dữ liệu học tập vẫn được quản lý trên website.',
              'Only new submission files use the selected folder. Existing files stay in their original location; grades, feedback and learning records remain managed by the website.',
            )}
          </p>
        </>
      )}
    </section>
  )
}
