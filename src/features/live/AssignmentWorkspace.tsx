import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, FloppyDisk, PaperPlaneTilt } from '@phosphor-icons/react'
import { Attachments, VoiceRecorder } from '@/features/live/Attachments'
import { errorMessage, type LiveViewProps } from '@/features/live/types'
import { PortalApiError } from '@/features/auth/client'
import { StudyWorkbench } from '@/features/live/StudyWorkbench'
import { ReadingQuestions } from '@/features/live/ReadingQuestions'
import { ReadingResponseSummary } from '@/features/live/ReadingResponseSummary'
import { SpeakingPractice } from '@/features/live/SpeakingPractice'
import { isReadingComplete, reconcileReadingAnswers } from '@/features/live/reading-helpers'
import type { Assignment, FileRecord } from '../../../shared/portal'
import type { ReadingDefinition, ReadingResponse } from '../../../shared/reading'

export function AssignmentWorkspace({
  state,
  locale,
  run,
  refresh,
  assignment,
  available = true,
}: LiveViewProps & { assignment: Assignment; available?: boolean }) {
  const original = state.drafts.find((item) => item.assignmentId === assignment.id)
  const [answer, setAnswer] = useState(original?.answer ?? '')
  const [notes, setNotes] = useState(original?.notes ?? '')
  const [attachments, setAttachments] = useState(original?.attachmentIds ?? [])
  const [readingDefinition, setReadingDefinition] = useState(
    original?.reading ?? assignment.reading,
  )
  const [readingAnswers, setReadingAnswers] = useState<ReadingResponse>(
    original?.readingAnswers ?? {},
  )
  const [preservedReading, setPreservedReading] = useState<
    { definition: ReadingDefinition; answers: ReadingResponse }[]
  >([])
  const [confirmSubmission, setConfirmSubmission] = useState(false)
  const [draftVersion, setDraftVersion] = useState(original?.version ?? 0)
  const [taskVersion, setTaskVersion] = useState(original?.assignmentVersion ?? assignment.version)
  const [promptVersion, setPromptVersion] = useState(assignment.version)
  const [saved, setSaved] = useState(
    JSON.stringify([
      original?.answer ?? '',
      original?.notes ?? '',
      original?.attachmentIds ?? [],
      original?.readingAnswers ?? {},
      original?.assignmentVersion ?? assignment.version,
    ]),
  )
  const [busy, setBusy] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [studyDirty, setStudyDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [unsavedClip, setUnsavedClip] = useState(false)
  const [voiceFiles, setVoiceFiles] = useState<FileRecord[]>([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [replaceDraft, setReplaceDraft] = useState(false)
  const saving = useRef(false)
  const pendingSubmission = useRef<Record<string, unknown> | null>(null)
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const skillLabel = {
    reading: t('Đọc', 'Reading'),
    writing: t('Viết', 'Writing'),
    listening: t('Nghe', 'Listening'),
    speaking: t('Nói', 'Speaking'),
  }[assignment.skill]
  const current = JSON.stringify([answer, notes, attachments, readingAnswers, taskVersion])
  const dirty = current !== saved
  const changedTask = assignment.version !== taskVersion || assignment.version !== promptVersion
  const pasteRestricted = assignment.skill === 'writing' && assignment.pasteRestricted === true
  const remoteDraft = state.drafts.find((item) => item.assignmentId === assignment.id)
  const changedDraft = (remoteDraft?.version ?? 0) > draftVersion
  const previous = state.submissions
    .filter((item) => item.assignmentId === assignment.id)
    .sort((a, b) => b.revision - a.revision)
  useEffect(() => {
    if (!dirty && !busy && !uploading && !unsavedClip && !recordingBusy && !studyDirty) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    const routeLeave = (event: Event) => {
      if (busy || uploading || recordingBusy) {
        event.preventDefault()
        setStatus(
          locale === 'vi'
            ? 'Đợi thao tác đang thực hiện hoàn tất trước khi rời trang.'
            : 'Wait for the current operation to finish before leaving.',
        )
        return
      }
      if (
        !window.confirm(
          locale === 'vi'
            ? 'Bản nháp chưa được lưu. Rời trang và bỏ các thay đổi?'
            : 'Your draft has unsaved changes. Leave and discard them?',
        )
      )
        event.preventDefault()
    }
    const leave = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href], .mis-signout') : null
      if (anchor?.getAttribute('href')?.startsWith('#')) return
      if (
        anchor?.getAttribute('target') === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      if (anchor && (busy || uploading || recordingBusy)) {
        event.preventDefault()
        event.stopPropagation()
        setStatus(
          locale === 'vi'
            ? 'Đợi thao tác đang thực hiện hoàn tất trước khi rời trang.'
            : 'Wait for the current operation to finish before leaving.',
        )
        return
      }
      if (
        anchor &&
        !anchor.hasAttribute('download') &&
        !window.confirm(
          locale === 'vi'
            ? 'Bản nháp chưa được lưu. Rời trang và bỏ các thay đổi?'
            : 'Your draft has unsaved changes. Leave and discard them?',
        )
      ) {
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
  }, [dirty, busy, uploading, unsavedClip, recordingBusy, studyDirty, locale])
  const saveDraft = useCallback(async () => {
    const response = await run('draft.save', {
      assignmentId: assignment.id,
      assignmentVersion: taskVersion,
      expectedVersion: draftVersion,
      answer,
      notes,
      attachmentIds: attachments,
      readingAnswers,
    })
    const stored = response.state.drafts.find((item) => item.assignmentId === assignment.id)
    if (!stored) throw new Error('missing-draft')
    setDraftVersion(stored.version)
    setSaved(current)
    return stored.version
  }, [
    run,
    assignment.id,
    taskVersion,
    draftVersion,
    answer,
    notes,
    attachments,
    readingAnswers,
    current,
    setDraftVersion,
  ])
  useEffect(() => {
    if (
      !dirty ||
      busy ||
      uploading ||
      recordingBusy ||
      unsavedClip ||
      !available ||
      changedTask ||
      changedDraft ||
      error
    )
      return
    const timer = window.setTimeout(() => {
      if (saving.current) return
      saving.current = true
      setBusy(true)
      setAutoSaving(true)
      void saveDraft()
        .then(() => {
          setStatus(
            locale === 'vi'
              ? 'Đã tự lưu bản nháp trên máy chủ.'
              : 'Draft automatically saved to the server.',
          )
        })
        .catch((failure) => setError(errorMessage(failure, locale)))
        .finally(() => {
          saving.current = false
          setBusy(false)
          setAutoSaving(false)
        })
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [
    dirty,
    busy,
    uploading,
    recordingBusy,
    unsavedClip,
    available,
    changedTask,
    changedDraft,
    error,
    saveDraft,
    locale,
  ])
  const save = async (submit: boolean) => {
    if (
      saving.current ||
      uploading ||
      recordingBusy ||
      unsavedClip ||
      !available ||
      changedTask ||
      changedDraft
    )
      return
    saving.current = true
    setBusy(true)
    setError('')
    setStatus('')
    try {
      if (submit) {
        if (!pendingSubmission.current) {
          const version =
            dirty || !draftVersion || remoteDraft?.assignmentVersion !== taskVersion
              ? await saveDraft()
              : draftVersion
          pendingSubmission.current = {
            assignmentId: assignment.id,
            assignmentVersion: taskVersion,
            draftVersion: version,
            expectedRevision: previous[0]?.revision ?? 0,
            requestId: crypto.randomUUID(),
          }
        }
        await run('submission.create', pendingSubmission.current)
        pendingSubmission.current = null
        setStatus(
          t(
            'Đã nộp bài. Giáo viên sẽ xem bản nộp này; bản nháp và ghi chú riêng vẫn được giữ.',
            'Submitted. Your teacher can now review this version; your draft and private notes are kept.',
          ),
        )
      } else {
        pendingSubmission.current = null
        await saveDraft()
        setStatus(t('Đã lưu bản nháp trên máy chủ.', 'Draft saved to the server.'))
      }
    } catch (failure) {
      if (failure instanceof PortalApiError && failure.status >= 400 && failure.status < 500)
        pendingSubmission.current = null
      setError(errorMessage(failure, locale))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const edit = () => {
    pendingSubmission.current = null
    setStatus('')
    setReplaceDraft(false)
    setConfirmSubmission(false)
  }
  return (
    <div className="mis-stack live-workspace">
      <div className="mis-toolbar">
        <a className="mis-button" href="#assignments">
          <ArrowLeft size={18} aria-hidden="true" />
          {t('Về bài tập', 'Back to assignments')}
        </a>
        <span className="mis-status">
          {skillLabel} · {t('Phiên bản đề', 'Task version')} {assignment.version}
        </span>
      </div>
      {!available && (
        <p className="mis-error" role="alert">
          {t(
            'Bài tập không còn khả dụng với tài khoản này. Nội dung đang nhập được giữ để bạn sao chép; hãy liên hệ giáo viên trước khi nộp.',
            'This assignment is no longer available to your account. Your input is kept so you can copy it; contact your teacher before submitting.',
          )}
        </p>
      )}
      {changedTask && (
        <div className="mis-panel mis-stack">
          <p role="alert">
            {t(
              'Giáo viên đã cập nhật đề bài. Mở và đọc đề mới trong khung đề bài bên dưới trước khi tiếp tục.',
              'Your teacher updated this task. Open and read the updated prompt below before continuing.',
            )}
          </p>
          <button
            className="mis-button"
            disabled={busy || promptVersion !== assignment.version}
            onClick={() => {
              if (readingDefinition)
                setPreservedReading((items) => [
                  ...items,
                  { definition: readingDefinition, answers: readingAnswers },
                ])
              setReadingAnswers(
                readingDefinition && assignment.reading
                  ? reconcileReadingAnswers(readingDefinition, assignment.reading, readingAnswers)
                  : {},
              )
              setReadingDefinition(assignment.reading)
              setTaskVersion(assignment.version)
              edit()
              setError('')
            }}
          >
            {t('Đã đọc hướng dẫn mới', 'I have read the new instructions')}
          </button>
        </div>
      )}
      {changedDraft && (
        <div className="mis-panel mis-stack">
          <p role="alert">
            {t(
              'Bản nháp trên máy chủ đã thay đổi. Nội dung đang nhập vẫn được giữ. Bạn có thể sao chép nội dung trước khi tải bản mới.',
              'The server draft changed. Your input is preserved. Copy your work before loading the newer draft.',
            )}
          </p>
          <button
            className="mis-button"
            disabled={busy || uploading || recordingBusy || unsavedClip}
            onClick={() => {
              if (dirty && !replaceDraft) {
                setReplaceDraft(true)
                return
              }
              setAnswer(remoteDraft?.answer ?? '')
              setNotes(remoteDraft?.notes ?? '')
              setAttachments(remoteDraft?.attachmentIds ?? [])
              setReadingAnswers(remoteDraft?.readingAnswers ?? {})
              setReadingDefinition(remoteDraft?.reading ?? assignment.reading)
              setTaskVersion(remoteDraft?.assignmentVersion ?? assignment.version)
              setDraftVersion(remoteDraft?.version ?? 0)
              setSaved(
                JSON.stringify([
                  remoteDraft?.answer ?? '',
                  remoteDraft?.notes ?? '',
                  remoteDraft?.attachmentIds ?? [],
                  remoteDraft?.readingAnswers ?? {},
                  remoteDraft?.assignmentVersion ?? assignment.version,
                ]),
              )
              edit()
              setError('')
            }}
          >
            {replaceDraft
              ? t('Bỏ thay đổi và tải bản nháp máy chủ', 'Discard edits and load server draft')
              : t('Tải bản nháp trên máy chủ', 'Load server draft')}
          </button>
          {replaceDraft && (
            <button className="study-text-button" onClick={() => setReplaceDraft(false)}>
              {t('Giữ nội dung đang nhập', 'Keep my input')}
            </button>
          )}
        </div>
      )}
      {preservedReading.map((item, index) => (
        <details key={index} className="reading-preserved">
          <summary>
            {t('Câu trả lời trước khi đổi đề', 'Answers before the prompt changed')} {index + 1}
          </summary>
          <p className="live-help">
            {t(
              'Giữ tại đây để bạn đối chiếu và sao chép trong lần mở này.',
              'Kept here for comparison and copying during this visit.',
            )}
          </p>
          <ReadingResponseSummary
            definition={item.definition}
            answers={item.answers}
            locale={locale}
          />
        </details>
      ))}
      <StudyWorkbench
        state={state}
        locale={locale}
        run={run}
        refresh={refresh}
        assignment={assignment}
        available={available}
        onDirtyChange={setStudyDirty}
        onPromptVersionChange={setPromptVersion}
      >
        <section className="mis-panel mis-stack">
          {!readingDefinition && <h2>{t('Bài làm của bạn', 'Your response')}</h2>}
          {readingDefinition && (
            <ReadingQuestions
              definition={readingDefinition}
              answers={readingAnswers}
              locale={locale}
              disabled={(busy && !autoSaving) || changedTask || !available}
              onChange={(value) => {
                setReadingAnswers(value)
                edit()
              }}
            />
          )}
          {assignment.skill === 'speaking' && (
            <SpeakingPractice
              key={`${state.user.id}:${assignment.id}`}
              assignment={assignment}
              locale={locale}
              files={[...state.files, ...voiceFiles].filter(
                (file, index, all) =>
                  attachments.includes(file.id) &&
                  all.findIndex((item) => item.id === file.id) === index,
              )}
              disabled={
                busy || uploading || recordingBusy || unsavedClip || !available || changedTask
              }
            >
              {attachments.length < 5 && (
                <VoiceRecorder
                  classId={assignment.classId}
                  locale={locale}
                  disabled={busy || uploading || !available || changedTask}
                  onBusyChange={setRecordingBusy}
                  onUnsavedChange={setUnsavedClip}
                  onUploaded={(file) => {
                    setVoiceFiles((files) => [...files, file])
                    setAttachments((ids) => [...ids, file.id])
                    edit()
                  }}
                />
              )}
            </SpeakingPractice>
          )}
          <fieldset
            className="live-fieldset mis-stack"
            disabled={(busy && !autoSaving) || uploading || recordingBusy}
          >
            <label className="mis-field">
              {readingDefinition
                ? t('Giải thích thêm (không bắt buộc)', 'Additional explanation (optional)')
                : t('Câu trả lời', 'Answer')}
              <textarea
                rows={assignment.skill === 'writing' ? 16 : readingDefinition ? 3 : 9}
                maxLength={100000}
                value={answer}
                aria-describedby={pasteRestricted ? 'writing-input-policy' : undefined}
                onPaste={(event) => {
                  if (!pasteRestricted) return
                  event.preventDefault()
                  setStatus(
                    t(
                      'Bài này yêu cầu tự gõ câu trả lời. Dán nội dung đã được tắt.',
                      'This task requires a typed response. Pasting is disabled.',
                    ),
                  )
                }}
                onDrop={(event) => {
                  if (!pasteRestricted) return
                  event.preventDefault()
                  setStatus(
                    t(
                      'Hãy tự gõ câu trả lời; kéo thả nội dung vào bài viết đã được tắt.',
                      'Type your response; dropping content into the essay is disabled.',
                    ),
                  )
                }}
                onChange={(event) => {
                  setAnswer(event.target.value)
                  edit()
                }}
              />
            </label>
            {pasteRestricted && (
              <p id="writing-input-policy" className="live-help">
                {t(
                  'Giáo viên yêu cầu tự gõ bài viết: không dán hoặc kéo thả nội dung vào ô trả lời. Ghi chú riêng vẫn dùng bình thường.',
                  'Your teacher requires a typed essay: paste and drop are disabled in the answer field. Private notes work normally.',
                )}
              </p>
            )}
            <p className="live-help">
              {answer.trim() ? answer.trim().split(/\s+/).length : 0} {t('từ', 'words')} ·{' '}
              {t(
                'Bạn có thể nộp văn bản hoặc tệp bài làm.',
                'Submit text or an attached response.',
              )}
            </p>
            <Attachments
              state={{ ...state, files: [...state.files, ...voiceFiles] }}
              locale={locale}
              classId={assignment.classId}
              purpose="submission"
              value={attachments}
              onBusyChange={setUploading}
              onChange={(ids) => {
                setAttachments(ids)
                edit()
              }}
            />
            <label className="mis-field">
              {t('Ghi chú riêng', 'Private notes')}
              <textarea
                rows={4}
                maxLength={50000}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                  edit()
                }}
              />
              <small>
                {t(
                  'Chỉ bạn xem được. Ghi chú không gửi kèm bài nộp.',
                  'Only you can see these notes. They are excluded from submissions.',
                )}
              </small>
            </label>
          </fieldset>
          <div className="live-actions">
            <button
              className="mis-button"
              disabled={
                busy ||
                uploading ||
                recordingBusy ||
                unsavedClip ||
                !available ||
                changedTask ||
                changedDraft
              }
              onClick={() => void save(false)}
            >
              <FloppyDisk size={18} aria-hidden="true" />
              {t('Lưu bản nháp', 'Save draft')}
            </button>
            <button
              className="mis-button mis-primary"
              disabled={
                busy ||
                uploading ||
                recordingBusy ||
                unsavedClip ||
                !available ||
                changedTask ||
                changedDraft ||
                (readingDefinition
                  ? !isReadingComplete(readingDefinition, readingAnswers)
                  : !answer.trim() && !attachments.length)
              }
              onClick={() => {
                if (readingDefinition) setConfirmSubmission(true)
                else void save(true)
              }}
            >
              <PaperPlaneTilt size={18} aria-hidden="true" />
              {busy
                ? t('Đang lưu…', 'Saving…')
                : previous.length
                  ? t('Nộp phiên bản mới', 'Submit new version')
                  : t('Nộp bài', 'Submit response')}
            </button>
            <span className="live-help" role="status">
              {autoSaving
                ? t('Đang tự lưu…', 'Autosaving…')
                : dirty
                  ? error ||
                    changedTask ||
                    changedDraft ||
                    !available ||
                    uploading ||
                    recordingBusy ||
                    unsavedClip
                    ? t(
                        'Tự lưu đã dừng. Nội dung đang nhập được giữ.',
                        'Autosave paused. Your input is kept.',
                      )
                    : t('Chưa lưu · tự lưu sau 5 giây', 'Unsaved · autosaves after 5 seconds')
                  : t('Bản nháp đã đồng bộ', 'Draft is up to date')}
            </span>
          </div>
          {readingDefinition && !isReadingComplete(readingDefinition, readingAnswers) && (
            <p className="live-help">
              {t(
                'Hoàn tất tất cả câu hỏi để nộp bài. Bạn có thể lưu nháp bất kỳ lúc nào.',
                'Complete all questions to submit. You can save a partial draft at any time.',
              )}
            </p>
          )}
          {confirmSubmission && (
            <div
              className="reading-submit-confirm"
              role="group"
              aria-label={t('Xác nhận nộp bài', 'Confirm submission')}
            >
              <strong>{t('Nộp các câu trả lời hiện tại?', 'Submit these answers?')}</strong>
              <p>
                {t(
                  'Bản nộp này được lưu để giáo viên chấm. Highlight, ghi chú và sổ từ vẫn riêng tư.',
                  'This revision is saved for teacher review. Highlights, notes and vocabulary remain private.',
                )}
              </p>
              <div className="live-actions">
                <button
                  type="button"
                  className="mis-button mis-primary"
                  disabled={
                    busy ||
                    uploading ||
                    recordingBusy ||
                    unsavedClip ||
                    !available ||
                    changedTask ||
                    changedDraft ||
                    !readingDefinition ||
                    !isReadingComplete(readingDefinition, readingAnswers)
                  }
                  onClick={() => {
                    setConfirmSubmission(false)
                    void save(true)
                  }}
                >
                  {t('Xác nhận nộp bài', 'Confirm submission')}
                </button>
                <button
                  type="button"
                  className="mis-button"
                  onClick={() => setConfirmSubmission(false)}
                >
                  {t('Kiểm tra lại', 'Keep reviewing')}
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="mis-stack">
              <p className="mis-error" role="alert">
                {error}
              </p>
              <button
                className="mis-button"
                onClick={() =>
                  void refresh().catch((failure) => setError(errorMessage(failure, locale)))
                }
              >
                {t('Kiểm tra dữ liệu mới', 'Check for updates')}
              </button>
            </div>
          )}
          {status && (
            <p className="live-success" role="status">
              {status}
            </p>
          )}
        </section>
      </StudyWorkbench>
      {previous[0] && (
        <section className="mis-panel mis-stack">
          <h2>
            {t('Bài nộp gần nhất', 'Latest submission')} · #{previous[0].revision}
          </h2>
          <p>
            {new Date(previous[0].submittedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            ·{' '}
            {previous[0].review
              ? t('Đã có nhận xét', 'Reviewed')
              : t('Chờ giáo viên nhận xét', 'Awaiting teacher review')}
          </p>
          {previous[0].reading && (
            <details>
              <summary>{t('Xem câu trả lời đã nộp', 'View submitted answers')}</summary>
              <ReadingResponseSummary
                definition={previous[0].reading}
                answers={previous[0].readingAnswers ?? {}}
                locale={locale}
              />
            </details>
          )}
          {previous[0].review && (
            <>
              <strong>{previous[0].review.score}/9</strong>
              <p className="live-prose">{previous[0].review.feedback}</p>
            </>
          )}
          <a href="#reports">{t('Xem lịch sử bài nộp', 'View submission history')}</a>
        </section>
      )}
    </div>
  )
}
