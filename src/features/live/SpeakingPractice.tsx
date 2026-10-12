import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SpeakerHigh, Sparkle } from '@phosphor-icons/react'
import { PortalApiError } from '@/features/auth/client'
import { SESSION_EVENT } from '@/features/auth/session'
import { errorMessage } from '@/features/live/types'
import { normalizeSpeakingAudio, SpeakingAudioError } from '@/features/live/speaking-audio'
import {
  getSpeakingHistory,
  createSpeakingJob,
  cancelSpeakingJob,
  fetchSpeakingAudio,
  fetchSpeakingSource,
  uploadSpeakingAudio,
} from '@/features/live/speaking-client'
import {
  speakingCriteria,
  type SpeakingHistory,
  type SpeakingJob,
  type SpeakingStatus,
} from '../../../shared/speaking'
import type { Assignment, FileRecord, Locale } from '../../../shared/portal'
import '@/styles/speaking-practice.css'

const active = (job: SpeakingJob) =>
  ['queued', 'synthesizing', 'transcribing', 'assessing'].includes(job.status)
const labels: Record<SpeakingStatus, [string, string]> = {
  queued: ['Đang chờ xử lý', 'Queued'],
  synthesizing: ['Đang tạo giọng đọc', 'Generating speech'],
  transcribing: ['Đang chép lời', 'Transcribing'],
  assessing: ['Đang nhận xét', 'Assessing'],
  completed: ['Đã hoàn tất', 'Completed'],
  needs_review: ['Cần xem lại bản ghi', 'Recording needs review'],
  failed: ['Chưa xử lý được', 'Processing failed'],
  cancelled: ['Đã hủy', 'Cancelled'],
}
const criteriaLabels = {
  fluency_coherence: ['Độ trôi chảy và mạch lạc', 'Fluency and coherence'],
  lexical_resource: ['Vốn từ vựng', 'Lexical resource'],
  grammatical_range_accuracy: [
    'Ngữ pháp: phạm vi và độ chính xác',
    'Grammatical range and accuracy',
  ],
  pronunciation: ['Phát âm', 'Pronunciation'],
} as const

function QuestionAudio({ job, locale }: { job: SpeakingJob; locale: Locale }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const resource = useRef('')
  useEffect(() => {
    const clear = () => {
      controller.current?.abort()
      if (resource.current) URL.revokeObjectURL(resource.current)
      resource.current = ''
      setUrl('')
    }
    window.addEventListener(SESSION_EVENT, clear)
    return () => {
      window.removeEventListener(SESSION_EVENT, clear)
      clear()
    }
  }, [])
  const load = async () => {
    if (busy) return
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError('')
    try {
      const blob = await fetchSpeakingAudio(job.id, request.signal)
      request.signal.throwIfAborted()
      resource.current = URL.createObjectURL(blob)
      setUrl(resource.current)
    } catch (failure) {
      if (!request.signal.aborted) setError(errorMessage(failure, locale))
    } finally {
      if (!request.signal.aborted) setBusy(false)
    }
  }
  return (
    <div className="speaking-question-audio">
      {url ? (
        // The exact spoken prompt is provided as the text alternative directly below.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          controls
          preload="metadata"
          src={url}
          aria-label={locale === 'vi' ? 'Câu hỏi được đọc bởi AI' : 'AI-generated question audio'}
        />
      ) : (
        <button type="button" className="mis-button" disabled={busy} onClick={() => void load()}>
          <SpeakerHigh size={18} aria-hidden="true" />
          {locale === 'vi'
            ? busy
              ? 'Đang tải…'
              : 'Nghe câu hỏi'
            : busy
              ? 'Loading…'
              : 'Listen to the question'}
        </button>
      )}
      <details>
        <summary>{locale === 'vi' ? 'Nội dung giọng đọc' : 'Spoken text'}</summary>
        <p className="speaking-transcript">{job.prompt}</p>
      </details>
      {error && (
        <p className="mis-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function SpeakingPractice({
  assignment,
  files,
  locale,
  disabled,
  children,
}: {
  assignment: Assignment
  files: FileRecord[]
  locale: Locale
  disabled: boolean
  children?: ReactNode
}) {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const [history, setHistory] = useState<SpeakingHistory | null>(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [questionLocale, setQuestionLocale] = useState<Locale>('en')
  const [consentProvider, setConsentProvider] = useState('')
  const [reload, setReload] = useState(0)
  const lifetime = useRef<AbortController | null>(null)
  const working = useRef(false)
  const prepared = useRef(new Map<string, FileRecord>())
  const pending = useRef<{ key: string; requestId: string } | null>(null)
  useEffect(() => {
    const clear = () => {
      lifetime.current?.abort()
      prepared.current.clear()
      pending.current = null
      setHistory(null)
      setConsentProvider('')
    }
    window.addEventListener(SESSION_EVENT, clear)
    return () => window.removeEventListener(SESSION_EVENT, clear)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const result = await getSpeakingHistory(assignment.id, controller.signal)
        controller.signal.throwIfAborted()
        setHistory(result)
        setLoadError('')
        if (result.jobs.some(active)) timer = setTimeout(() => void load(), 3500)
      } catch (failure) {
        if (!controller.signal.aborted) setLoadError(errorMessage(failure, locale))
      }
    }
    void load()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [assignment.id, assignment.version, locale, reload])
  const audioFiles = files.filter(
    (file) => file.mime.startsWith('audio/') || file.mime === 'video/webm',
  )
  const selectedFile = audioFiles.find((file) => file.id === sourceId) ?? audioFiles[0]
  const jobs = history?.jobs ?? []
  const currentProvider = history?.configuration.provider
  const providerName =
    currentProvider === 'gemini'
      ? 'Google Gemini'
      : currentProvider === 'openai'
        ? 'OpenAI'
        : t('dịch vụ AI', 'the AI provider')
  const consent = Boolean(currentProvider && consentProvider === currentProvider)
  const assessmentJobs = jobs.filter((job) => job.kind === 'assessment')
  const selected = assessmentJobs.find((job) => job.id === selectedId) ?? assessmentJobs[0]
  const question = jobs.find(
    (job) =>
      job.kind === 'question' &&
      job.assignmentVersion === assignment.version &&
      job.locale === questionLocale,
  )
  const running = jobs.some(active)
  const enabled = history?.configuration.enabled === true
  const create = async (kind: 'question' | 'assessment', retry?: SpeakingJob) => {
    const signal = lifetime.current?.signal
    if (!signal || signal.aborted || working.current || !enabled || disabled || running || !consent)
      return
    working.current = true
    setBusy(true)
    setError('')
    try {
      let fileId = retry?.fileId
      if (kind === 'assessment' && !fileId) {
        if (!selectedFile) return
        const cached = prepared.current.get(selectedFile.id)
        if (cached) fileId = cached.id
        else {
          setPhase(t('Đang chuẩn bị bản ghi…', 'Preparing recording…'))
          const source = await fetchSpeakingSource(selectedFile.id, signal)
          const normalized = await normalizeSpeakingAudio(source, signal)
          const file = await uploadSpeakingAudio(normalized.blob, assignment.classId, signal)
          signal.throwIfAborted()
          prepared.current.set(selectedFile.id, file)
          fileId = file.id
        }
      }
      setPhase(t('Đang gửi yêu cầu…', 'Sending request…'))
      const language = kind === 'question' ? questionLocale : locale
      const key = `${currentProvider}:${assignment.id}:${assignment.version}:${kind}:${fileId ?? ''}:${language}:${retry?.id ?? ''}`
      if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() }
      const job = await createSpeakingJob(
        {
          assignmentId: assignment.id,
          assignmentVersion: assignment.version,
          kind,
          locale: language,
          requestId: pending.current.requestId,
          provider: currentProvider,
          ...(fileId ? { fileId } : {}),
        },
        signal,
      )
      signal.throwIfAborted()
      pending.current = null
      setHistory(
        (old) => old && { ...old, jobs: [job, ...old.jobs.filter((item) => item.id !== job.id)] },
      )
      if (kind === 'assessment') setSelectedId(job.id)
      setReload((value) => value + 1)
    } catch (failure) {
      if (!signal.aborted) {
        if (failure instanceof PortalApiError && (failure.status === 503 || failure.status === 409))
          setReload((value) => value + 1)
        if (failure instanceof PortalApiError && failure.status >= 400 && failure.status < 500)
          pending.current = null
        setError(
          failure instanceof SpeakingAudioError
            ? t(
                'Không thể dùng bản ghi này. Chọn âm thanh hợp lệ dài từ 3 giây đến 4 phút; không cắt ngắn tự động. Thử ghi lại hoặc đổi tệp.',
                'This recording cannot be used. Choose valid audio between 3 seconds and 4 minutes; clips are never automatically trimmed. Record again or choose another file.',
              )
            : failure instanceof PortalApiError && failure.status === 503
              ? t(
                  'Dịch vụ AI chưa sẵn sàng. Bạn vẫn có thể lưu và nộp bài cho giáo viên; thử AI lại sau.',
                  'AI is not ready. You can still save and submit to your teacher; try AI again later.',
                )
              : errorMessage(failure, locale),
        )
      }
    } finally {
      working.current = false
      setBusy(false)
      setPhase('')
    }
  }
  const cancel = async (job: SpeakingJob) => {
    const signal = lifetime.current?.signal
    if (!signal || signal.aborted || working.current) return
    working.current = true
    setBusy(true)
    setError('')
    try {
      await cancelSpeakingJob(job.id, job.version, signal)
      signal.throwIfAborted()
      setReload((value) => value + 1)
    } catch (failure) {
      if (!signal.aborted) setError(errorMessage(failure, locale))
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  const jobState = (job: SpeakingJob) => (
    <div className="speaking-job-state">
      <span role="status">{labels[job.status][locale === 'vi' ? 0 : 1]}</span>
      {active(job) && (
        <button
          type="button"
          className="study-text-button"
          disabled={busy}
          onClick={() => void cancel(job)}
        >
          {t('Hủy xử lý', 'Cancel processing')}
        </button>
      )}
      {job.status === 'failed' && (
        <p className="live-help">
          {job.errorCode === 'speaking_quota_exhausted'
            ? t(
                'Dịch vụ AI của trung tâm đã hết hạn mức xử lý. Vui lòng báo quản trị viên; bản ghi vẫn được lưu và có thể nộp cho giáo viên.',
                'The centre’s AI service has no remaining quota. Contact your administrator; your recording remains saved and can be submitted to your teacher.',
              )
            : job.errorCode === 'speaking_provider_auth'
              ? t(
                  'Dịch vụ AI chưa chấp nhận khóa API hoặc quyền truy cập. Vui lòng báo quản trị viên kiểm tra cấu hình; bản ghi vẫn được giữ.',
                  'The AI service rejected the API key or access permissions. Ask your administrator to check the configuration; your recording is retained.',
                )
              : job.errorCode === 'speaking_expired'
                ? t(
                    'Thời gian dùng thử AI đã kết thúc. Bản ghi vẫn được lưu; bạn có thể nộp bài cho giáo viên.',
                    'The AI trial has ended. Your recording remains saved and can be submitted to your teacher.',
                  )
                : t(
                    'Chưa có kết quả. Kiểm tra bản ghi hoặc liên hệ quản trị viên nếu dịch vụ gặp lỗi. Bạn có thể chủ động thử lại.',
                    'No result is available. Check your recording or contact your administrator about service errors. You can explicitly retry.',
                  )}
        </p>
      )}
    </div>
  )
  return (
    <section
      className="speaking-practice"
      aria-label={t('Luyện Speaking với AI', 'Speaking practice with AI')}
    >
      <div className="speaking-heading">
        <Sparkle size={22} aria-hidden="true" />
        <h3>{t('Luyện Speaking với AI', 'Speaking practice with AI')}</h3>
      </div>
      <p className="live-help">
        {t(
          'Nghe câu hỏi, ghi âm rồi xem bản chép lời và nhận xét. Nhận xét AI chỉ để luyện tập, không thay thế điểm giáo viên hay kết quả IELTS chính thức.',
          'Listen, record, then review your transcript and feedback. AI feedback supports practice; it does not replace teacher grades or an official IELTS result.',
        )}
      </p>
      {!history && !loadError && (
        <p role="status">{t('Đang kiểm tra dịch vụ…', 'Checking service…')}</p>
      )}
      {loadError && (
        <div>
          <p className="mis-error" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            className="mis-button"
            onClick={() => setReload((value) => value + 1)}
          >
            {t('Tải lại trạng thái AI', 'Reload AI status')}
          </button>
        </div>
      )}
      {history && !enabled && (
        <p className="speaking-unavailable" role="status">
          {history.configuration.reason === 'expired'
            ? t(
                'Thời gian dùng thử AI đã kết thúc. Bản ghi và nhận xét đã có vẫn được giữ; bạn có thể tiếp tục ghi âm, lưu và nộp bài.',
                'The AI trial has ended. Existing recordings and feedback are retained; you can continue recording, saving and submitting work.',
              )
            : t(
                `${providerName} chưa sẵn sàng. Bạn vẫn có thể ghi âm, lưu và nộp bài; vui lòng báo quản trị viên kiểm tra cấu hình AI.`,
                `${providerName} is not ready. You can still record, save and submit work; ask your administrator to check the AI configuration.`,
              )}
        </p>
      )}
      {enabled && history?.configuration.expiresAt && (
        <p className="live-help">
          {t('AI dùng thử đến ', 'AI trial ends ')}
          <time dateTime={history.configuration.expiresAt}>
            {new Date(history.configuration.expiresAt).toLocaleString(
              locale === 'vi' ? 'vi-VN' : 'en-GB',
              { dateStyle: 'medium', timeStyle: 'long' },
            )}
          </time>
          {t(
            '. Sau thời điểm này hệ thống ngừng gửi yêu cầu AI mới.',
            '. After this time, the system stops sending new AI requests.',
          )}
        </p>
      )}
      {running && (
        <div
          className="speaking-active-jobs"
          aria-label={t('Yêu cầu AI đang xử lý', 'Active AI requests')}
        >
          {jobs.filter(active).map((job) => (
            <div key={job.id}>
              <strong>
                {job.kind === 'question'
                  ? t('Giọng đọc câu hỏi', 'Question audio')
                  : t('Nhận xét bản ghi', 'Recording feedback')}{' '}
                · v{job.assignmentVersion}
              </strong>
              {jobState(job)}
            </div>
          ))}
        </div>
      )}
      <label className="speaking-consent">
        <input
          type="checkbox"
          checked={consent}
          disabled={!enabled || busy}
          onChange={(event) =>
            setConsentProvider(event.target.checked ? (currentProvider ?? '') : '')
          }
        />
        <span>
          {t(
            `Khi tôi bấm tạo giọng đọc hoặc nhận xét, gửi đề bài và bản ghi được chọn đến ${providerName} để xử lý.`,
            `When I request speech or feedback, send the prompt and selected recording to ${providerName} for processing.`,
          )}
        </span>
      </label>
      <div className="speaking-step">
        <h4>{t('Nghe câu hỏi', 'Listen to the question')}</h4>
        <p className="live-help">
          {t(
            'Giọng đọc do AI tạo từ hướng dẫn giáo viên đã lưu.',
            'AI-generated voice reads your teacher’s saved instructions.',
          )}
        </p>
        <div className="speaking-controls">
          <label className="mis-field">
            {t('Ngôn ngữ câu hỏi', 'Question language')}
            <select
              value={questionLocale}
              disabled={busy || running}
              onChange={(event) => setQuestionLocale(event.target.value as Locale)}
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </label>
          {question?.hasAudio ? (
            <QuestionAudio key={question.id} job={question} locale={locale} />
          ) : (
            <button
              type="button"
              className="mis-button"
              disabled={!enabled || !consent || disabled || busy || running}
              onClick={() =>
                void create('question', question?.status === 'failed' ? question : undefined)
              }
            >
              {t('Tạo giọng đọc câu hỏi', 'Generate question audio')}
            </button>
          )}
        </div>
        {question && jobState(question)}
      </div>
      <div className="speaking-step">
        <h4>{t('Chuẩn bị bản ghi', 'Prepare your recording')}</h4>
        <p className="live-help">
          {t(
            'Lưu bản ghi bằng công cụ dưới đây hoặc tải tệp âm thanh trong phần đính kèm. AI nhận bản ghi từ 3 giây đến 4 phút.',
            'Save a recording below or upload an audio attachment. AI accepts recordings from 3 seconds to 4 minutes.',
          )}
        </p>
        {children}
      </div>
      <div className="speaking-step">
        <h4>{t('Chép lời và nhận xét', 'Transcription and feedback')}</h4>
        {audioFiles.length ? (
          <label className="mis-field">
            {t('Bản ghi gửi nhận xét', 'Recording to assess')}
            <select
              value={selectedFile?.id ?? ''}
              disabled={busy || running}
              onChange={(event) => {
                setSourceId(event.target.value)
                setError('')
              }}
            >
              {audioFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="live-help">
            {t(
              'Chưa có bản ghi đã lưu. Hãy ghi âm và tải lên trước.',
              'No saved recording yet. Record and upload your response first.',
            )}
          </p>
        )}
        <button
          type="button"
          className="mis-button mis-primary"
          disabled={!enabled || !consent || !selectedFile || disabled || busy || running}
          onClick={() => void create('assessment')}
        >
          {busy
            ? phase || t('Đang xử lý…', 'Working…')
            : t('Chép lời và xem nhận xét AI', 'Transcribe and get AI feedback')}
        </button>
        {busy && (
          <p className="live-help" role="status">
            {phase}
          </p>
        )}
        {error && (
          <p className="mis-error" role="alert">
            {error}
          </p>
        )}
        {assessmentJobs.length > 0 && (
          <label className="mis-field">
            {t('Lịch sử luyện tập riêng tư', 'Private practice history')}
            <select
              value={selected?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {assessmentJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {new Date(job.createdAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}{' '}
                  · {t('Đề', 'Task')} v{job.assignmentVersion} ·{' '}
                  {labels[job.status][locale === 'vi' ? 0 : 1]}
                </option>
              ))}
            </select>
          </label>
        )}
        {selected && (
          <div className="speaking-result">
            {jobState(selected)}
            {selected.assignmentVersion !== assignment.version && (
              <p className="live-help">
                {t(
                  'Kết quả này thuộc phiên bản đề trước.',
                  'This result belongs to an earlier task version.',
                )}
              </p>
            )}
            <details>
              <summary>{t('Đề bài của lần luyện này', 'Prompt for this practice')}</summary>
              <p className="speaking-transcript">{selected.prompt}</p>
            </details>
            {selected.transcript && (
              <details open>
                <summary>{t('Bản chép lời', 'Transcript')}</summary>
                <p className="speaking-transcript">{selected.transcript}</p>
                <p className="live-help">
                  {t(
                    'Bản chép lời tự động có thể có sai sót; đối chiếu với âm thanh gốc.',
                    'Automatic transcription may contain errors; compare it with the original recording.',
                  )}
                </p>
              </details>
            )}
            {selected.status === 'needs_review' && (
              <p className="live-help">
                {t(
                  'Âm thanh chưa đủ rõ để nhận xét đầy đủ. Kiểm tra micro, nói rõ hơn và ghi lại; không tự suy ra điểm cho tiêu chí thiếu bằng chứng.',
                  'The recording is not clear enough for full feedback. Check your microphone and record again. Criteria without enough evidence are left unscored.',
                )}
              </p>
            )}
            {selected.assessment && (
              <>
                <p>{selected.assessment.summary}</p>
                <div className="speaking-criteria">
                  {speakingCriteria.map((key) => {
                    const criterion = selected.assessment!.criteria[key]
                    return (
                      <details key={key}>
                        <summary>
                          <span>{criteriaLabels[key][locale === 'vi' ? 0 : 1]}</span>
                          <strong>
                            {criterion.score === null
                              ? t('Chưa đủ dữ liệu', 'Insufficient evidence')
                              : `${criterion.score}/9`}
                          </strong>
                        </summary>
                        <div className="speaking-criterion-body">
                          <p>{criterion.feedback}</p>
                          {criterion.evidence.length > 0 && (
                            <>
                              <h5>{t('Dẫn chứng', 'Evidence')}</h5>
                              <ul>
                                {criterion.evidence.map((text, index) => (
                                  <li key={index}>{text}</li>
                                ))}
                              </ul>
                            </>
                          )}
                          {criterion.improvements.length > 0 && (
                            <>
                              <h5>{t('Cách cải thiện', 'How to improve')}</h5>
                              <ul>
                                {criterion.improvements.map((text, index) => (
                                  <li key={index}>{text}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </details>
                    )
                  })}
                </div>
                {selected.assessment.limitations.length > 0 && (
                  <div className="live-help">
                    <strong>{t('Giới hạn của nhận xét', 'Feedback limitations')}</strong>
                    <ul>
                      {selected.assessment.limitations.map((text, index) => (
                        <li key={index}>{text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {selected.status === 'failed' && selected.assignmentVersion === assignment.version && (
              <button
                type="button"
                className="mis-button"
                disabled={!enabled || !consent || disabled || busy || running}
                onClick={() => void create('assessment', selected)}
              >
                {t('Thử xử lý lại bản ghi này', 'Retry this recording')}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
