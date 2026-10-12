import { useEffect, useRef, useState } from 'react'
import { DownloadSimple, Eye, Microphone, Paperclip, Stop, X } from '@phosphor-icons/react'
import { apiRequest, readSessionToken, PortalApiError } from '@/features/auth/client'
import { errorMessage } from '@/features/live/types'
import type { FileRecord, LiveState, Locale } from '../../../shared/portal'
import '@/styles/attachment-preview.css'

const LIMIT = 8 * 1024 * 1024
function assertFileSession(token: string | null): void {
  if (!token || token !== readSessionToken()) throw new PortalApiError('expired', 401)
}

class AttachmentValidationError extends Error {
  readonly reason: 'empty' | 'large' | 'format'

  constructor(reason: 'empty' | 'large' | 'format') {
    super(reason)
    this.reason = reason
  }
}

function attachmentError(failure: unknown, locale: Locale) {
  if (failure instanceof AttachmentValidationError) {
    const messages = {
      empty: {
        vi: 'Tệp đang trống. Hãy chọn một tệp có nội dung.',
        en: 'This file is empty. Choose a file with content.',
      },
      large: {
        vi: 'Tệp vượt quá 8 MB. Hãy giảm dung lượng hoặc chọn một tệp nhỏ hơn.',
        en: 'This file exceeds 8 MB. Reduce its size or choose a smaller file.',
      },
      format: {
        vi: 'Định dạng tệp chưa được hỗ trợ. Chọn PDF, PNG, JPG, MP3, WAV, OGG hoặc WebM.',
        en: 'This file format is not supported. Choose PDF, PNG, JPG, MP3, WAV, OGG or WebM.',
      },
    }
    return messages[failure.reason][locale]
  }
  if (failure instanceof PortalApiError && [400, 413, 422].includes(failure.status))
    return locale === 'vi'
      ? 'Không thể nhận tệp này. Kiểm tra định dạng, nội dung tệp và giới hạn 8 MB rồi thử lại.'
      : 'This file could not be accepted. Check its format, contents and the 8 MB limit, then retry.'
  if (failure instanceof PortalApiError && failure.status === 503)
    return locale === 'vi'
      ? 'Kho lưu tệp tạm thời không khả dụng. Nội dung bài làm vẫn được giữ; thử lại sau hoặc liên hệ quản trị viên.'
      : 'File storage is temporarily unavailable. Your work is kept; retry later or contact an administrator.'
  if (failure instanceof PortalApiError && failure.status === 502)
    return locale === 'vi'
      ? 'Chưa thể xác minh tệp lưu trữ. Vui lòng liên hệ quản trị viên để kiểm tra tệp.'
      : 'The stored file could not be verified. Please ask an administrator to check it.'
  return errorMessage(failure, locale)
}

async function uploadFile(
  file: File,
  classId: string,
  purpose: 'material' | 'submission',
): Promise<FileRecord> {
  const token = readSessionToken()
  assertFileSession(token)
  if (file.size === 0) throw new AttachmentValidationError('empty')
  if (file.size > LIMIT) throw new AttachmentValidationError('large')
  if (!/\.(pdf|png|jpe?g|mp3|wav|webm|ogg)$/i.test(file.name))
    throw new AttachmentValidationError('format')
  const bytes = new Uint8Array(await file.arrayBuffer())
  // Reading a file is asynchronous; never send its bytes under a later account.
  assertFileSession(token)
  let binary = ''
  for (let start = 0; start < bytes.length; start += 16384)
    binary += String.fromCharCode(...bytes.subarray(start, start + 16384))
  const record = await apiRequest<FileRecord>('portal/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId,
      purpose,
      name: file.name,
      mime: file.type,
      dataBase64: btoa(binary),
    }),
  })
  // A completed server write remains intact, but its result belongs to this session only.
  assertFileSession(token)
  return record
}

function Attachment({
  file,
  locale,
  onRemove,
  inlinePreview,
}: {
  file: FileRecord
  locale: Locale
  onRemove?: () => void
  inlinePreview: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const request = useRef<AbortController | null>(null)
  const active = useRef(true)
  const isPdf = file.mime === 'application/pdf'
  const canPreview = inlinePreview && (isPdf || ['image/png', 'image/jpeg'].includes(file.mime))
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      request.current?.abort()
    }
  }, [])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  const load = async (download: boolean) => {
    const token = readSessionToken()
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      assertFileSession(token)
      const response = await fetch(`/api/v1/portal/files/${encodeURIComponent(file.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      })
      assertFileSession(token)
      if (!response.ok) throw new PortalApiError('service', response.status)
      const blob = await response.blob()
      assertFileSession(token)
      if (!active.current || controller.signal.aborted) return
      const next = URL.createObjectURL(blob)
      setUrl(next)
      if (!download && canPreview) setPreview(true)
      if (download) {
        const link = document.createElement('a')
        link.href = next
        link.download = file.name
        link.click()
      }
    } catch (failure) {
      if (active.current && !controller.signal.aborted) setError(attachmentError(failure, locale))
    } finally {
      if (active.current && request.current === controller) setBusy(false)
    }
  }
  return (
    <li className="live-attachment">
      <div>
        <Paperclip size={18} aria-hidden="true" />
        <span>
          {file.name}
          <small>{(file.size / 1024).toFixed(0)} KB</small>
        </span>
      </div>
      <div className="mis-toolbar">
        {canPreview && (
          <button
            type="button"
            className="mis-button"
            disabled={busy}
            aria-expanded={preview}
            aria-label={`${preview ? t('Ẩn bản xem', 'Hide preview of') : t('Xem trong đề', 'Preview')} ${file.name}`}
            onClick={() => {
              if (preview) {
                setPreview(false)
                setUrl(null)
              } else void load(false)
            }}
          >
            <Eye size={18} aria-hidden="true" />
            {busy
              ? t('Đang tải…', 'Loading…')
              : preview
                ? t('Ẩn bản xem', 'Hide preview')
                : t('Xem tại đây', 'Preview here')}
          </button>
        )}
        {file.mime.startsWith('audio/') && (
          <button
            type="button"
            className="mis-button"
            disabled={busy}
            onClick={() => void load(false)}
            aria-label={`${t('Nghe', 'Listen to')} ${file.name}`}
          >
            {busy ? t('Đang tải…', 'Loading…') : t('Nghe', 'Listen')}
          </button>
        )}
        <button
          type="button"
          className="mis-button"
          disabled={busy}
          onClick={() => void load(true)}
          aria-label={`${t('Tải xuống', 'Download')} ${file.name}`}
        >
          <DownloadSimple size={18} aria-hidden="true" />
        </button>
        {onRemove && (
          <button
            type="button"
            className="mis-button"
            onClick={onRemove}
            aria-label={`${t('Bỏ đính kèm', 'Detach')} ${file.name}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {/* User-provided audio has no generated transcript; task text is supplied separately. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {url && file.mime.startsWith('audio/') && <audio controls src={url} aria-label={file.name} />}
      {url && preview && canPreview && (
        <div className="attachment-preview">
          {isPdf ? (
            <>
              <object
                className="attachment-preview-pdf"
                data={url}
                type="application/pdf"
                aria-label={`${t('Tài liệu', 'Document')}: ${file.name}`}
              >
                <p>
                  {t(
                    'Trình duyệt này không hiển thị PDF tại đây. Dùng nút tải xuống để mở tài liệu.',
                    'This browser cannot display the PDF here. Use Download to open the document.',
                  )}
                </p>
              </object>
              <p className="live-help">
                {t(
                  'Nếu bản xem PDF không hiển thị, dùng nút tải xuống phía trên.',
                  'If the PDF preview does not appear, use the Download button above.',
                )}
              </p>
            </>
          ) : (
            <img
              className="attachment-preview-image"
              src={url}
              alt={file.name}
              onError={() =>
                setError(
                  t(
                    'Không hiển thị được ảnh. Hãy tải tệp xuống để kiểm tra.',
                    'This image could not be displayed. Download the file to inspect it.',
                  ),
                )
              }
            />
          )}
        </div>
      )}
      {error && (
        <p className="mis-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export function Attachments({
  state,
  locale,
  classId,
  purpose,
  value,
  onChange,
  readOnly = false,
  onBusyChange,
  inlinePreview = false,
}: {
  state: LiveState
  locale: Locale
  classId: string
  purpose: 'material' | 'submission'
  value: string[]
  onChange?: (ids: string[]) => void
  readOnly?: boolean
  onBusyChange?: (busy: boolean) => void
  inlinePreview?: boolean
}) {
  const [uploaded, setUploaded] = useState<FileRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const files = value
    .map(
      (id) => state.files.find((file) => file.id === id) ?? uploaded.find((file) => file.id === id),
    )
    .filter((file): file is FileRecord => Boolean(file))
  return (
    <div className="live-attachments">
      {files.length > 0 && (
        <ul>
          {files.map((file) => (
            <Attachment
              key={file.id}
              file={file}
              locale={locale}
              inlinePreview={inlinePreview}
              onRemove={
                !readOnly && onChange
                  ? () => onChange(value.filter((id) => id !== file.id))
                  : undefined
              }
            />
          ))}
        </ul>
      )}
      {!readOnly && onChange && (
        <label className="mis-field">
          {t('Đính kèm học liệu hoặc âm thanh', 'Attach learning material or audio')}
          <input
            type="file"
            disabled={busy || !classId || value.length >= 5}
            accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.webm,.ogg"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              const token = readSessionToken()
              setBusy(true)
              onBusyChange?.(true)
              setError('')
              try {
                const record = await uploadFile(file, classId, purpose)
                assertFileSession(token)
                setUploaded((previous) => [...previous, record])
                onChange([...value, record.id])
              } catch (failure) {
                setError(attachmentError(failure, locale))
              } finally {
                setBusy(false)
                onBusyChange?.(false)
              }
            }}
          />
          <small role={busy ? 'status' : undefined}>
            {busy
              ? t('Đang tải tệp lên…', 'Uploading…')
              : t(
                  'PDF, ảnh, MP3, WAV, OGG hoặc WebM · tối đa 8 MB/tệp, 5 tệp.',
                  'PDF, images, MP3, WAV, OGG or WebM · up to 8 MB each, 5 files.',
                )}
          </small>
        </label>
      )}
      {error && (
        <p className="mis-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function VoiceRecorder({
  classId,
  locale,
  onUploaded,
  onBusyChange,
  onUnsavedChange,
  disabled,
}: {
  classId: string
  locale: Locale
  onUploaded: (file: FileRecord) => void
  onBusyChange: (busy: boolean) => void
  onUnsavedChange: (unsaved: boolean) => void
  disabled: boolean
}) {
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timeout = useRef<number | undefined>(undefined)
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  useEffect(
    () => () => {
      window.clearTimeout(timeout.current)
      stream.current?.getTracks().forEach((track) => track.stop())
      if (recorder.current?.state === 'recording') recorder.current.stop()
    },
    [],
  )
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  const start = async () => {
    setError('')
    setBusy(true)
    onBusyChange(true)
    try {
      if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined')
        throw new Error('unsupported')
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(
        (mime) => MediaRecorder.isTypeSupported(mime),
      )
      if (!mimeType) {
        stream.current.getTracks().forEach((track) => track.stop())
        throw new Error('unsupported')
      }
      const active = new MediaRecorder(stream.current, { mimeType, audioBitsPerSecond: 64000 })
      recorder.current = active
      const chunks: Blob[] = []
      active.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      active.onstop = () => {
        window.clearTimeout(timeout.current)
        stream.current?.getTracks().forEach((track) => track.stop())
        setRecording(false)
        onBusyChange(false)
        onUnsavedChange(true)
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
        setClip(blob)
        setUrl(URL.createObjectURL(blob))
      }
      active.start()
      setRecording(true)
      setClip(null)
      setUrl(null)
      onUnsavedChange(true)
      timeout.current = window.setTimeout(() => {
        if (active.state === 'recording') active.stop()
      }, 300000)
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop())
      onBusyChange(false)
      setError(
        t(
          'Không mở được micro. Hãy kiểm tra quyền của trình duyệt hoặc đính kèm tệp ghi âm có sẵn.',
          'Could not open the microphone. Check browser permissions or attach an existing recording.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="live-recorder">
      <h3>{t('Ghi âm câu trả lời', 'Record your response')}</h3>
      <p>
        {t(
          'Tối đa 5 phút. Nghe lại trước khi lưu vào bản nháp.',
          'Up to 5 minutes. Listen before saving to your draft.',
        )}
      </p>
      <div className="mis-toolbar">
        {recording ? (
          <button type="button" className="mis-button" onClick={() => recorder.current?.stop()}>
            <Stop size={18} aria-hidden="true" />
            {t('Dừng ghi âm', 'Stop recording')}
          </button>
        ) : (
          <button
            type="button"
            className="mis-button"
            disabled={busy || disabled}
            onClick={() => void start()}
          >
            <Microphone size={18} aria-hidden="true" />
            {t('Bắt đầu ghi âm', 'Start recording')}
          </button>
        )}
        {clip && (
          <button
            type="button"
            className="mis-button"
            disabled={busy || recording || disabled}
            onClick={async () => {
              const token = readSessionToken()
              setBusy(true)
              onBusyChange(true)
              setError('')
              try {
                const file = await uploadFile(
                  new File(
                    [clip],
                    `speaking-${Date.now()}.${clip.type.includes('ogg') ? 'ogg' : 'webm'}`,
                    { type: clip.type },
                  ),
                  classId,
                  'submission',
                )
                assertFileSession(token)
                onUploaded(file)
                setClip(null)
                setUrl(null)
                onUnsavedChange(false)
              } catch (failure) {
                setError(attachmentError(failure, locale))
              } finally {
                setBusy(false)
                onBusyChange(false)
              }
            }}
          >
            {busy ? t('Đang lưu…', 'Saving…') : t('Lưu bản ghi âm', 'Save recording')}
          </button>
        )}
        {clip && (
          <button
            type="button"
            className="mis-button"
            disabled={busy || disabled}
            onClick={() => {
              setClip(null)
              setUrl(null)
              onUnsavedChange(false)
            }}
          >
            {t('Bỏ bản ghi âm', 'Discard recording')}
          </button>
        )}
      </div>
      {url && (
        // A local recording preview has no transcript service attached.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={url} aria-label={t('Nghe lại bản ghi âm', 'Preview recording')} />
      )}
      {recording && <p role="status">{t('Đang ghi âm…', 'Recording…')}</p>}
      {error && (
        <p role="alert" className="mis-error">
          {error}
        </p>
      )}
    </section>
  )
}
