import { useId, useState } from 'react'
import {
  ArrowLeft,
  BookBookmark,
  Check,
  FloppyDisk,
  Headphones,
  Microphone,
  Plus,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import type {
  LearningActions,
  LearningAssignment,
  PortalLocale,
  PortalState,
  VocabularyWord,
} from '@/features/learning/types'
import type { ManagementSubmission } from '@/features/management/types'
import { submissionAnswer } from '@/features/learning/submission'

interface WorkspaceProps {
  assignment: LearningAssignment
  locale: PortalLocale
  state: PortalState
  actions: LearningActions
  onBack: () => void
  onSubmit: (answer: string) => boolean
  submission?: ManagementSubmission
  sharedPreview: boolean
}

type SaveStatus = 'idle' | 'saved' | 'error' | 'invalid' | 'submitted'

const copy = {
  vi: {
    back: 'Quay lại bài tập',
    demo: 'Bài tập minh họa',
    reading: 'Đọc',
    writing: 'Viết',
    listening: 'Nghe',
    speaking: 'Nói',
    minutes: 'phút dự kiến',
    local: 'Bản nháp được lưu trong trình duyệt này. Đây là bài tập mẫu để thử giao diện.',
    saved: 'Đã lưu bản nháp trong trình duyệt này.',
    error: 'Chưa lưu được trong trình duyệt. Giữ trang này mở và thử lưu lại.',
    save: 'Lưu bản nháp',
    submit: 'Nộp thử',
    invalid: 'Hãy hoàn thành câu trả lời trước khi nộp thử.',
    submitted: 'Đã lưu bài nộp mẫu. Mở Kết quả học tập để theo dõi nhận xét.',
    confirmTitle: 'Ghi nhận bài nộp thử?',
    confirm: 'Xác nhận nộp thử',
    cancel: 'Tiếp tục làm bài',
    confirmBody:
      'Lưu một bản bài làm để chấm thử trên trình duyệt này. Nộp lại sẽ tạo phiên bản mới và giữ lịch sử nhận xét. Ghi chú riêng không được nộp.',
    priorSubmission: 'Đã có lượt nộp thử',
    editHint: 'Bạn vẫn có thể chỉnh sửa và lưu bản nháp.',
    draftState: 'Bản nháp',
    draftHint: 'Nộp thử để cập nhật tiến độ mẫu sau khi chỉnh sửa.',
    passage: 'Bài đọc mẫu',
    passageTitle: 'Small habits, steady progress',
    original: 'Nội dung học mẫu bằng tiếng Anh',
    readingIntro: 'Đọc đoạn văn, trả lời hai câu hỏi và ghi lại điều bạn muốn thảo luận.',
    questions: 'Câu hỏi đọc hiểu',
    questionOne: 'Mina đã thay đổi thói quen học như thế nào?',
    questionTwo: 'Vì sao Mina ghi lại những câu hỏi của mình?',
    answerOne: 'Ví dụ: Mina chia thời gian học...',
    answerTwo: 'Dựa vào đoạn văn để trả lời...',
    notes: 'Ghi chú riêng',
    notesHint: 'Ý chính hoặc câu hỏi bạn muốn hỏi giáo viên...',
    vocabulary: 'Từ vựng trong bài',
    vocabularyHint: 'Chọn một từ mẫu để xem nghĩa và lưu vào sổ từ vựng.',
    dictionary: 'Từ điển mẫu',
    dictionaryHint: 'Tra cứu trong 4 từ mẫu: habit, consistent, reflect, progress.',
    lookup: 'Tra từ',
    searchLabel: 'Từ cần tra',
    searchPlaceholder: 'Ví dụ: consistent',
    noWord: 'Chưa có từ này trong bộ từ mẫu. Hãy thử habit, consistent, reflect hoặc progress.',
    wordSaved: 'Đã thêm từ vào sổ từ vựng.',
    wordError: 'Chưa lưu được từ. Vui lòng thử lại.',
    addWord: 'Lưu từ',
    inNotebook: 'Đã có trong sổ',
    prompt: 'Đề bài',
    writingPrompt:
      'Describe a place that helps you focus on learning. Explain what it is like, why it works well for you, and how you use your time there.',
    writingGuide:
      'Viết khoảng 120–180 từ bằng tiếng Anh. Đây là gợi ý luyện tập, không phải tiêu chí chấm điểm.',
    plan: 'Gợi ý triển khai',
    planItems: [
      'Giới thiệu không gian bạn thường chọn để học.',
      'Mô tả những yếu tố giúp bạn tập trung.',
      'Đưa ra một ví dụ về cách bạn học tại đó.',
    ],
    essay: 'Bài viết của bạn',
    essayPlaceholder: 'Bắt đầu bài viết bằng tiếng Anh...',
    words: 'từ',
    suggested: 'Gợi ý: 120–180 từ',
    mindMap: 'Về sơ đồ tư duy',
    mindMapBody:
      'Sơ đồ tư duy chưa có trong bản giao diện này. Hình thức vẽ tự do hoặc sơ đồ có cấu trúc và thời điểm triển khai cần được xác nhận.',
    unavailable: 'Chưa kết nối',
    listeningTitle: 'Bài nghe chưa có tệp âm thanh',
    listeningBody:
      'Bản xem trước chưa kết nối nguồn âm thanh và bộ câu hỏi nghe. Khi học liệu được cung cấp, bạn sẽ có thể nghe, trả lời và lưu từ ngay tại đây.',
    speakingTitle: 'Ghi âm và phản hồi AI chưa được kết nối',
    speakingBody:
      'Bản xem trước chưa ghi âm, chuyển lời nói thành văn bản hoặc chấm điểm. Luồng đầy đủ sẽ cần quyền dùng micro và dịch vụ xử lý âm thanh được cấu hình.',
    speakingPrompt:
      'Describe a skill you learned recently. How did you practise, and what would you do differently next time?',
    preparation: 'Chủ đề luyện tập mẫu',
    planned: 'Luồng học dự kiến',
    speakingSteps: [
      'Nghe câu hỏi và ghi âm câu trả lời.',
      'Xem bản chép lời và phản hồi theo bốn tiêu chí.',
      'Tham khảo hai câu trả lời cải thiện và lưu từ mới.',
    ],
    listeningSteps: [
      'Nghe học liệu do giáo viên cung cấp.',
      'Trả lời câu hỏi và ghi chú trong bài.',
      'Lưu từ mới theo chủ đề.',
    ],
  },
  en: {
    back: 'Back to assignments',
    demo: 'Sample assignment',
    reading: 'Reading',
    writing: 'Writing',
    listening: 'Listening',
    speaking: 'Speaking',
    minutes: 'estimated minutes',
    local: 'Drafts are saved in this browser. This sample assignment lets you try the interface.',
    saved: 'Draft saved in this browser.',
    error: 'Could not save in this browser. Keep this page open and try saving again.',
    save: 'Save draft',
    submit: 'Submit demo',
    invalid: 'Complete your answers before submitting the demo.',
    submitted: 'Demo work submitted. Open Report cards to follow your feedback.',
    confirmTitle: 'Record a demo submission?',
    confirm: 'Confirm demo submission',
    cancel: 'Keep working',
    confirmBody:
      'Save a snapshot for a local demo review. Resubmitting creates a new revision and keeps earlier feedback. Personal notes are not submitted.',
    priorSubmission: 'Demo submitted',
    editHint: 'You can still edit and save your draft.',
    draftState: 'Draft',
    draftHint: 'Submit the demo to update sample progress after editing.',
    passage: 'Sample passage',
    passageTitle: 'Small habits, steady progress',
    original: 'Sample learning content in English',
    readingIntro:
      'Read the passage, answer two questions, and note anything you would like to discuss.',
    questions: 'Reading questions',
    questionOne: 'How did Mina change her study routine?',
    questionTwo: 'Why does Mina write down her questions?',
    answerOne: 'For example: Mina divides her study time...',
    answerTwo: 'Use the passage to support your answer...',
    notes: 'Personal notes',
    notesHint: 'Key ideas or questions for your teacher...',
    vocabulary: 'Words from the passage',
    vocabularyHint: 'Choose a sample word to see its meaning and save it to your notebook.',
    dictionary: 'Sample dictionary',
    dictionaryHint: 'Look up one of 4 sample words: habit, consistent, reflect, progress.',
    lookup: 'Look up',
    searchLabel: 'Word to look up',
    searchPlaceholder: 'For example: consistent',
    noWord:
      'This word is not in the sample dictionary. Try habit, consistent, reflect, or progress.',
    wordSaved: 'Word added to your vocabulary notebook.',
    wordError: 'Could not save this word. Please try again.',
    addWord: 'Save word',
    inNotebook: 'In your notebook',
    prompt: 'Writing prompt',
    writingPrompt:
      'Describe a place that helps you focus on learning. Explain what it is like, why it works well for you, and how you use your time there.',
    writingGuide:
      'Write about 120–180 words in English. This is a practice suggestion, not a grading criterion.',
    plan: 'Points to consider',
    planItems: [
      'Introduce the place you choose for studying.',
      'Describe the features that help you focus.',
      'Give an example of how you study there.',
    ],
    essay: 'Your writing',
    essayPlaceholder: 'Start writing in English...',
    words: 'words',
    suggested: 'Suggested: 120–180 words',
    mindMap: 'About mind maps',
    mindMapBody:
      'Mind maps are not included in this interface preview. Freehand or structured mapping and its release timing still need to be confirmed.',
    unavailable: 'Not connected',
    listeningTitle: 'This listening assignment needs its audio',
    listeningBody:
      'Audio and listening questions are not connected in this preview. Once learning materials are supplied, you will be able to listen, answer, and save words here.',
    speakingTitle: 'Recording and AI feedback are not connected',
    speakingBody:
      'This preview does not record audio, create transcripts, or score answers. The full workflow will require microphone permission and a configured audio processing service.',
    speakingPrompt:
      'Describe a skill you learned recently. How did you practise, and what would you do differently next time?',
    preparation: 'Sample practice topic',
    planned: 'Planned learning flow',
    speakingSteps: [
      'Listen to the question and record your answer.',
      'Review a transcript and feedback across four criteria.',
      'Explore two improved sample answers and save new words.',
    ],
    listeningSteps: [
      'Listen to learning material supplied by your teacher.',
      'Answer questions and make notes as you work.',
      'Save new words by topic.',
    ],
  },
}

const sampleWords: VocabularyWord[] = [
  {
    id: 'learning-habit',
    word: 'habit',
    meaning: { vi: 'thói quen', en: 'something you do regularly' },
    example: 'Reading every morning is a useful habit.',
    topic: { vi: 'Thói quen học tập', en: 'Learning habits' },
  },
  {
    id: 'learning-consistent',
    word: 'consistent',
    meaning: { vi: 'đều đặn, nhất quán', en: 'regular and steady over time' },
    example: 'Consistent practice helps Mina remember new words.',
    topic: { vi: 'Thói quen học tập', en: 'Learning habits' },
  },
  {
    id: 'learning-reflect',
    word: 'reflect',
    meaning: { vi: 'suy ngẫm, nhìn lại', en: 'to think carefully about an experience' },
    example: 'She takes time to reflect on what she has learned.',
    topic: { vi: 'Thói quen học tập', en: 'Learning habits' },
  },
  {
    id: 'learning-progress',
    word: 'progress',
    meaning: { vi: 'sự tiến bộ', en: 'improvement or movement towards a goal' },
    example: 'Small steps can lead to steady progress.',
    topic: { vi: 'Thói quen học tập', en: 'Learning habits' },
  },
]

interface DraftControlsProps {
  locale: PortalLocale
  status: SaveStatus
  submitted: boolean
  onSave: () => boolean
  onSubmit: () => void
  valid: boolean
  onInvalid: () => void
}

function DraftControls({
  locale,
  status,
  submitted,
  onSave,
  onSubmit,
  valid,
  onInvalid,
}: DraftControlsProps) {
  const t = copy[locale]
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="lw-draft-controls">
      <p className="lw-attempt-state">
        <span className="lp-status">{submitted ? t.priorSubmission : t.draftState}</span>
        <span>{submitted ? t.editHint : t.draftHint}</span>
      </p>
      <div className="lw-action-row">
        <button type="button" className="lp-button" onClick={() => onSave()}>
          <FloppyDisk size={18} aria-hidden="true" />
          {t.save}
        </button>
        <button
          type="button"
          className="lp-button lp-primary"
          onClick={() => {
            if (!valid) {
              onInvalid()
              return
            }
            setConfirming(true)
          }}
        >
          {t.submit}
        </button>
      </div>
      <p
        className={`lw-save-status${status === 'error' || status === 'invalid' ? ' lw-error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {status !== 'idle'
          ? t[status]
          : submitted
            ? `${t.priorSubmission}. ${t.editHint}`
            : t.local}
      </p>
      {confirming && (
        <div className="lw-confirm" role="group" aria-label={t.confirmTitle}>
          <h3>{t.confirmTitle}</h3>
          <p>{t.confirmBody}</p>
          <div className="lw-action-row">
            <button
              type="button"
              className="lp-button lp-primary"
              onClick={() => {
                if (!valid) {
                  onInvalid()
                  setConfirming(false)
                  return
                }
                if (onSave()) {
                  onSubmit()
                  setConfirming(false)
                }
              }}
            >
              {t.confirm}
            </button>
            <button type="button" className="lp-button" onClick={() => setConfirming(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SampleDictionary({
  locale,
  state,
  actions,
  passage = false,
}: Pick<WorkspaceProps, 'locale' | 'state' | 'actions'> & { passage?: boolean }) {
  const t = copy[locale]
  const fieldId = useId()
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const result = sampleWords.find((word) => word.word === lookup)
  const hasWord = result
    ? state.words.some(
        (word) => word.id === result.id || word.word.toLowerCase() === result.word.toLowerCase(),
      )
    : false
  function findWord(word: string) {
    setLookup(word.trim().toLowerCase())
    setSaveStatus('idle')
  }
  return (
    <section className="lw-dictionary" aria-labelledby={`${fieldId}-title`}>
      <h3 id={`${fieldId}-title`}>
        <BookBookmark size={19} aria-hidden="true" />
        {passage ? t.vocabulary : t.dictionary}
      </h3>
      <p className="lw-hint">{passage ? t.vocabularyHint : t.dictionaryHint}</p>
      {passage ? (
        <div className="lw-word-options">
          {sampleWords.map((word) => (
            <button
              className="lw-word-option"
              type="button"
              key={word.id}
              aria-pressed={lookup === word.word}
              onClick={() => findWord(word.word)}
              lang="en"
            >
              {word.word}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            findWord(query)
          }}
        >
          <label className="lw-field-label" htmlFor={fieldId}>
            {t.searchLabel}
          </label>
          <div className="lw-lookup">
            <input
              id={fieldId}
              className="lp-field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              autoComplete="off"
            />
            <button type="submit" className="lp-button" aria-label={t.lookup} title={t.lookup}>
              <MagnifyingGlass size={19} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
      {lookup !== null && (
        <div className="lw-dictionary-result" aria-live="polite">
          {result ? (
            <>
              <h4 lang="en">{result.word}</h4>
              <p>{result.meaning[locale]}</p>
              <p className="lw-example" lang="en">
                {result.example}
              </p>
              {hasWord ? (
                <p className="lw-word-saved">
                  <Check size={17} aria-hidden="true" />
                  {t.inNotebook}
                </p>
              ) : (
                <button
                  type="button"
                  className="lp-button"
                  onClick={() => setSaveStatus(actions.addWord(result) ? 'saved' : 'error')}
                >
                  <Plus size={17} aria-hidden="true" />
                  {t.addWord}
                </button>
              )}
            </>
          ) : (
            <p className="lw-hint">{t.noWord}</p>
          )}
        </div>
      )}
      {saveStatus !== 'idle' && (
        <p className={`lw-save-status${saveStatus === 'error' ? ' lw-error' : ''}`} role="status">
          {saveStatus === 'saved' ? t.wordSaved : t.wordError}
        </p>
      )}
    </section>
  )
}

interface ReadingDraft {
  answerOne: string
  answerTwo: string
  notes: string
}
function readDraft(raw: string | undefined): ReadingDraft {
  const empty = { answerOne: '', answerTwo: '', notes: '' }
  if (!raw) return empty
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null) {
      const item = value as Record<string, unknown>
      return {
        answerOne: typeof item.answerOne === 'string' ? item.answerOne : '',
        answerTwo: typeof item.answerTwo === 'string' ? item.answerTwo : '',
        notes: typeof item.notes === 'string' ? item.notes : '',
      }
    }
  } catch {
    return { ...empty, notes: raw }
  }
  return empty
}

function ReadingWorkspace({ assignment, locale, state, actions, onSubmit }: WorkspaceProps) {
  const t = copy[locale]
  const id = useId()
  const [draft, setDraft] = useState(() => readDraft(state.drafts[assignment.id]))
  const [status, setStatus] = useState<SaveStatus>('idle')
  function updateDraft(field: keyof ReadingDraft, value: string) {
    const next = { ...draft, [field]: value }
    setDraft(next)
    setStatus(actions.saveDraft(assignment.id, JSON.stringify(next)) ? 'saved' : 'error')
  }
  function saveDraft() {
    const saved = actions.saveDraft(assignment.id, JSON.stringify(draft))
    setStatus(saved ? 'saved' : 'error')
    return saved
  }
  return (
    <div className="lw-reading-layout">
      <div className="lw-reading-source">
        <article className="lw-passage" aria-labelledby={`${id}-passage`}>
          <h2 id={`${id}-passage`}>{t.passageTitle}</h2>
          <p className="lw-hint">{t.original}</p>
          <div lang="en">
            <p>
              Mina used to study English for two hours every Sunday. She often felt tired by the end
              of a session, and by Friday she had forgotten many of the new words.
            </p>
            <p>
              Now, she practises for fifteen minutes each morning. She reads a short article,
              chooses two useful words, and writes a sentence with each one. This small habit fits
              around her work, so it is easier to stay consistent.
            </p>
            <p>
              At the end of the week, Mina takes a few minutes to reflect. She reads her sentences
              again and writes down questions to discuss with her teacher. She does not understand
              everything yet, but she can see steady progress.
            </p>
          </div>
        </article>
        <SampleDictionary locale={locale} state={state} actions={actions} passage />
      </div>
      <section className="lw-answer-panel" aria-labelledby={`${id}-questions`}>
        <h2 id={`${id}-questions`}>{t.questions}</h2>
        <p className="lw-hint">{t.readingIntro}</p>
        <label className="lw-field-label" htmlFor={`${id}-one`}>
          1. {t.questionOne}
        </label>
        <textarea
          className="lp-field"
          id={`${id}-one`}
          rows={4}
          maxLength={6000}
          value={draft.answerOne}
          onChange={(event) => updateDraft('answerOne', event.target.value)}
          placeholder={t.answerOne}
        />
        <label className="lw-field-label" htmlFor={`${id}-two`}>
          2. {t.questionTwo}
        </label>
        <textarea
          className="lp-field"
          id={`${id}-two`}
          rows={4}
          maxLength={6000}
          value={draft.answerTwo}
          onChange={(event) => updateDraft('answerTwo', event.target.value)}
          placeholder={t.answerTwo}
        />
        <label className="lw-field-label" htmlFor={`${id}-notes`}>
          {t.notes}
        </label>
        <textarea
          className="lp-field"
          id={`${id}-notes`}
          rows={3}
          maxLength={4000}
          value={draft.notes}
          onChange={(event) => updateDraft('notes', event.target.value)}
          placeholder={t.notesHint}
        />
        <DraftControls
          locale={locale}
          status={status}
          submitted={state.submittedIds.includes(assignment.id)}
          onSave={saveDraft}
          valid={Boolean(draft.answerOne.trim() && draft.answerTwo.trim())}
          onInvalid={() => setStatus('invalid')}
          onSubmit={() =>
            setStatus(
              onSubmit(submissionAnswer(assignment.id, JSON.stringify(draft)))
                ? 'submitted'
                : 'error',
            )
          }
        />
      </section>
    </div>
  )
}

function WritingWorkspace({ assignment, locale, state, actions, onSubmit }: WorkspaceProps) {
  const t = copy[locale]
  const id = useId()
  const [draft, setDraft] = useState(() => state.drafts[assignment.id] ?? '')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const words = draft.trim() ? draft.trim().split(/\s+/u).length : 0
  function saveDraft() {
    const saved = actions.saveDraft(assignment.id, draft)
    setStatus(saved ? 'saved' : 'error')
    return saved
  }
  return (
    <div className="lw-writing-layout">
      <section className="lw-writing-prompt" aria-labelledby={`${id}-prompt`}>
        <h2 id={`${id}-prompt`}>{t.prompt}</h2>
        <p className="lw-prompt-text" lang="en">
          {t.writingPrompt}
        </p>
        <p className="lw-hint">{t.writingGuide}</p>
        <h3>{t.plan}</h3>
        <ul className="lw-prompt-list">
          {t.planItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details className="lw-details">
          <summary>{t.mindMap}</summary>
          <p>{t.mindMapBody}</p>
        </details>
      </section>
      <section className="lw-writing-editor" aria-labelledby={`${id}-editor`}>
        <div className="lw-editor-heading">
          <h2 id={`${id}-editor`}>
            <label htmlFor={`${id}-draft`}>{t.essay}</label>
          </h2>
          <span className="lw-word-count">
            {words} {t.words}
          </span>
        </div>
        <textarea
          id={`${id}-draft`}
          className="lp-field lw-essay"
          rows={18}
          maxLength={20000}
          value={draft}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            setStatus(actions.saveDraft(assignment.id, next) ? 'saved' : 'error')
          }}
          placeholder={t.essayPlaceholder}
          aria-describedby={`${id}-suggested`}
          lang="en"
        />
        <p className="lw-hint" id={`${id}-suggested`}>
          {t.suggested}
        </p>
        <DraftControls
          locale={locale}
          status={status}
          submitted={state.submittedIds.includes(assignment.id)}
          onSave={saveDraft}
          valid={Boolean(draft.trim())}
          onInvalid={() => setStatus('invalid')}
          onSubmit={() => setStatus(onSubmit(draft) ? 'submitted' : 'error')}
        />
      </section>
      <SampleDictionary locale={locale} state={state} actions={actions} />
    </div>
  )
}

function TextWorkspace({ assignment, locale, state, actions, onSubmit }: WorkspaceProps) {
  const t = copy[locale]
  const id = useId()
  const [draft, setDraft] = useState(state.drafts[assignment.id] ?? '')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const speaking = assignment.skill === 'speaking'
  const audio = speaking || assignment.skill === 'listening'
  const Icon = speaking ? Microphone : Headphones
  const save = () => {
    const saved = actions.saveDraft(assignment.id, draft)
    setStatus(saved ? 'saved' : 'error')
    return saved
  }
  return (
    <section className="mis-panel lw-text-workspace">
      {audio && (
        <div className="mis-notice lw-audio-note">
          <Icon size={22} aria-hidden="true" />
          <p>
            {locale === 'vi'
              ? 'Bản dùng thử nhận phần chuẩn bị bằng văn bản. Âm thanh, ghi âm và chấm AI chưa kết nối.'
              : 'This demo accepts written preparation. Audio, recording and AI grading are not connected.'}
          </p>
        </div>
      )}
      {assignment.id === 'speaking-01' && <p lang="en">{t.speakingPrompt}</p>}
      <label className="lw-field-label" htmlFor={`${id}-response`}>
        {audio
          ? locale === 'vi'
            ? 'Phần chuẩn bị bằng văn bản'
            : 'Written preparation'
          : locale === 'vi'
            ? 'Câu trả lời của bạn'
            : 'Your response'}
      </label>
      <textarea
        className="lp-field"
        id={`${id}-response`}
        rows={12}
        maxLength={20000}
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          setStatus(actions.saveDraft(assignment.id, next) ? 'saved' : 'error')
        }}
      />
      <DraftControls
        locale={locale}
        status={status}
        submitted={state.submittedIds.includes(assignment.id)}
        onSave={save}
        valid={Boolean(draft.trim())}
        onInvalid={() => setStatus('invalid')}
        onSubmit={() => setStatus(onSubmit(draft) ? 'submitted' : 'error')}
      />
      {audio && (
        <details className="lw-details">
          <summary>{t.planned}</summary>
          <ol className="lw-prompt-list">
            {(speaking ? t.speakingSteps : t.listeningSteps).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

export function LearningWorkspace(props: WorkspaceProps) {
  const { assignment, locale, onBack, submission, sharedPreview } = props
  const t = copy[locale]
  return (
    <div className="lw-workspace">
      <button type="button" className="lp-text-link lw-back" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t.back}
      </button>
      <header className="lw-header">
        <div>
          <h2>
            {assignment.id === 'reading-01' || assignment.id === 'writing-01'
              ? locale === 'vi'
                ? 'Hướng dẫn bổ sung'
                : 'Additional guidance'
              : locale === 'vi'
                ? 'Hướng dẫn làm bài'
                : 'Assignment instructions'}
          </h2>
          <p className="lw-instructions">{assignment.description[locale]}</p>
        </div>
        <div className="lw-meta">
          <span className="lp-status">{t[assignment.skill]}</span>
          <span>
            {assignment.minutes} {t.minutes}
          </span>
        </div>
      </header>
      <p className="lw-preview-note">
        {sharedPreview
          ? locale === 'vi'
            ? 'Bài nộp xuất hiện ở vai trò Giáo viên mẫu trên cùng trình duyệt. Bản nháp và ghi chú riêng chỉ nằm trong không gian học viên.'
            : 'Submitted work appears in the Teacher preview in this browser. Drafts and personal notes remain in the student workspace.'
          : locale === 'vi'
            ? 'Bài làm được lưu riêng cho tài khoản này trên trình duyệt, chưa gửi tới tài khoản giáo viên thật.'
            : 'Work is saved for this account in this browser. It is not sent to a real teacher account.'}
      </p>
      {submission && (
        <section
          className="mis-panel lw-submission-summary"
          aria-label={locale === 'vi' ? 'Bài đã nộp' : 'Submitted work'}
        >
          <div className="mis-toolbar">
            <strong>
              {locale === 'vi' ? 'Lần nộp' : 'Revision'} {submission.revision}
            </strong>
            <span className="mis-status">
              {submission.review
                ? locale === 'vi'
                  ? 'Đã trả bài'
                  : 'Reviewed'
                : locale === 'vi'
                  ? 'Chờ nhận xét'
                  : 'Awaiting review'}
            </span>
            <a className="mis-button" href="#reports">
              {locale === 'vi' ? 'Xem bài nộp và lịch sử' : 'View submission and history'}
            </a>
          </div>
          {submission.review && (
            <div className="lw-returned-feedback">
              <h3>
                {locale === 'vi' ? 'Nhận xét của giáo viên' : 'Teacher feedback'} ·{' '}
                {submission.review.score} / 9
              </h3>
              <p>{submission.review.feedback}</p>
            </div>
          )}
          <p className="lw-hint">
            {locale === 'vi'
              ? 'Chỉnh sửa bản nháp không thay đổi bài đã nộp. Nộp lại để gửi phiên bản mới.'
              : 'Editing your draft does not change the submitted snapshot. Submit again to send a new revision.'}
          </p>
        </section>
      )}
      {assignment.id === 'reading-01' ? (
        <ReadingWorkspace key={assignment.id} {...props} />
      ) : assignment.id === 'writing-01' ? (
        <WritingWorkspace key={assignment.id} {...props} />
      ) : (
        <TextWorkspace key={assignment.id} {...props} />
      )}
    </div>
  )
}
