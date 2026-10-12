import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react'
import type { Locale, Text } from '../../../shared/portal'
import type { ReadingDefinition, ReadingGroup, ReadingQuestion } from '../../../shared/reading'
import '@/styles/reading-authoring.css'
import { enumerateReadingQuestions } from '@/features/live/reading-helpers'

import {
  newReadingOption as option,
  newReadingQuestion as question,
  newReadingGroup as group,
  readingQuestionSlots as slots,
} from '@/features/live/reading-authoring'

function BilingualField({
  value,
  onChange,
  label,
  maxLength,
  multiline = false,
  required = false,
}: {
  value: Text
  onChange: (value: Text) => void
  label: string
  maxLength: number
  multiline?: boolean
  required?: boolean
}) {
  return (
    <div className="reading-bilingual">
      {(['vi', 'en'] as const).map((language) => (
        <label className="mis-field" key={language}>
          {label} · {language === 'vi' ? 'VI' : 'EN'}
          {multiline ? (
            <textarea
              lang={language}
              rows={3}
              maxLength={maxLength}
              required={required}
              value={value[language]}
              onChange={(event) => onChange({ ...value, [language]: event.target.value })}
            />
          ) : (
            <input
              lang={language}
              maxLength={maxLength}
              required={required}
              value={value[language]}
              onChange={(event) => onChange({ ...value, [language]: event.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  )
}

export function ReadingEditor({
  value,
  onChange,
  locale,
}: {
  value: ReadingDefinition
  onChange: (value: ReadingDefinition) => void
  locale: Locale
}) {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const total = value.groups.reduce(
    (sum, group) => sum + group.questions.reduce((count, item) => count + slots(item), 0),
    0,
  )
  const updateGroup = (id: string, patch: Partial<ReadingGroup>) =>
    onChange({
      ...value,
      groups: value.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)),
    })
  const updateQuestion = (group: ReadingGroup, next: ReadingQuestion) =>
    updateGroup(group.id, {
      questions: group.questions.map((question) => (question.id === next.id ? next : question)),
    })
  const confirmRemove = () =>
    window.confirm(
      t(
        'Xóa nội dung này khỏi bản đang chỉnh sửa? Các bản nộp trước vẫn được giữ.',
        'Remove this content from the draft? Earlier submission snapshots are preserved.',
      ),
    )
  const move = <T,>(items: T[], index: number, direction: number) => {
    const next = [...items]
    const target = index + direction
    if (target < 0 || target >= next.length) return next
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    return next
  }
  const setKind = (
    group: ReadingGroup,
    current: ReadingQuestion,
    kind: ReadingQuestion['kind'],
  ) => {
    if (current.kind === kind) return
    if (
      current.kind !== 'short' &&
      kind === 'short' &&
      current.options.some((option) => option.label.vi || option.label.en) &&
      !confirmRemove()
    )
      return
    const base = { id: current.id, prompt: current.prompt }
    const options = current.kind === 'short' ? [option(), option(), option()] : current.options
    updateQuestion(
      group,
      kind === 'short'
        ? { ...base, kind, maxWords: 1 }
        : kind === 'single'
          ? { ...base, kind, options }
          : { ...base, kind, options, selectCount: Math.min(2, options.length) },
    )
  }
  const numbered = new Map(enumerateReadingQuestions(value).map((item) => [item.question.id, item]))
  return (
    <section className="reading-editor" aria-label={t('Soạn câu hỏi', 'Question authoring')}>
      <div className="live-heading">
        <div>
          <h3>{t('Câu hỏi', 'Questions')}</h3>
          <p className="live-help">
            {t(
              'Thứ tự nhóm và câu quyết định số câu. Chọn nhiều đáp án dùng nhiều số liên tiếp; giáo viên vẫn chấm điểm 0–9.',
              'Group and question order determine numbering. Multiple selections use consecutive numbers; teachers still review on the 0–9 scale.',
            )}
          </p>
        </div>
        <span className="mis-status">
          {total}/40 {t('vị trí trả lời', 'answer slots')}
        </span>
      </div>
      <label className="mis-field reading-number-field">
        {t('Số câu bắt đầu', 'Starting question number')}
        <input
          type="number"
          min={1}
          max={1000}
          step={1}
          required
          value={value.startNumber || ''}
          onChange={(event) => onChange({ ...value, startNumber: Number(event.target.value) })}
        />
      </label>
      {value.groups.map((group, groupIndex) => (
        <fieldset className="reading-author-group" key={group.id}>
          <legend>
            {t('Nhóm', 'Group')} {groupIndex + 1}
          </legend>
          <div className="live-actions reading-order-actions">
            <button
              className="mis-button"
              type="button"
              disabled={groupIndex === 0}
              onClick={() => onChange({ ...value, groups: move(value.groups, groupIndex, -1) })}
              aria-label={t(`Đưa nhóm ${groupIndex + 1} lên`, `Move group ${groupIndex + 1} up`)}
            >
              <ArrowUp size={16} />
              {t('Lên', 'Up')}
            </button>
            <button
              className="mis-button"
              type="button"
              disabled={groupIndex === value.groups.length - 1}
              onClick={() => onChange({ ...value, groups: move(value.groups, groupIndex, 1) })}
              aria-label={t(
                `Đưa nhóm ${groupIndex + 1} xuống`,
                `Move group ${groupIndex + 1} down`,
              )}
            >
              <ArrowDown size={16} />
              {t('Xuống', 'Down')}
            </button>
            <button
              className="mis-button"
              type="button"
              onClick={() => {
                if (confirmRemove())
                  onChange({
                    ...value,
                    groups: value.groups.filter((item) => item.id !== group.id),
                  })
              }}
            >
              <Trash size={16} />
              {t('Xóa nhóm', 'Remove group')}
            </button>
          </div>
          <BilingualField
            value={group.title}
            onChange={(title) => updateGroup(group.id, { title })}
            label={t('Tiêu đề nhóm', 'Group title')}
            required
            maxLength={300}
          />
          <BilingualField
            value={group.instructions}
            onChange={(instructions) => updateGroup(group.id, { instructions })}
            label={t('Hướng dẫn nhóm (không bắt buộc)', 'Group instructions (optional)')}
            multiline
            maxLength={3000}
          />
          {group.questions.map((current, questionIndex) => {
            const numberedQuestion = numbered.get(current.id)!
            const start = numberedQuestion.number
            const end = numberedQuestion.endNumber
            const label = start === end ? `${start}` : `${start}–${end}`
            return (
              <fieldset className="reading-author-question" key={current.id}>
                <legend>
                  {t('Câu', 'Question')} {label}
                </legend>
                <div className="reading-question-controls">
                  <label className="mis-field">
                    {t('Dạng câu hỏi', 'Question format')}
                    <select
                      value={current.kind}
                      onChange={(event) =>
                        setKind(group, current, event.target.value as ReadingQuestion['kind'])
                      }
                    >
                      <option value="single">
                        {t('Chọn một / Nối đoạn', 'Single choice / Matching')}
                      </option>
                      <option value="multiple">
                        {t('Chọn nhiều đáp án', 'Multiple selections')}
                      </option>
                      <option value="short">
                        {t('Câu trả lời ngắn / Điền từ', 'Short answer / Summary gap')}
                      </option>
                    </select>
                  </label>
                  {current.kind === 'multiple' && (
                    <label className="mis-field reading-number-field">
                      {t('Số đáp án cần chọn', 'Selections required')}
                      <input
                        type="number"
                        min={1}
                        max={current.options.length}
                        step={1}
                        required
                        value={current.selectCount || ''}
                        onChange={(event) =>
                          updateQuestion(group, {
                            ...current,
                            selectCount: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                  {current.kind === 'short' && (
                    <label className="mis-field reading-number-field">
                      {t('Số từ tối đa', 'Maximum words')}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        required
                        value={current.maxWords || ''}
                        onChange={(event) =>
                          updateQuestion(group, {
                            ...current,
                            maxWords: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
                <BilingualField
                  value={current.prompt}
                  onChange={(prompt) => updateQuestion(group, { ...current, prompt })}
                  label={t(
                    'Nội dung câu hỏi / câu có chỗ trống',
                    'Question prompt / sentence with gap',
                  )}
                  multiline
                  required
                  maxLength={3000}
                />
                {current.kind !== 'short' && (
                  <div className="reading-author-options">
                    {current.options.map((item, index) => (
                      <div className="reading-author-option" key={item.id}>
                        <BilingualField
                          value={item.label}
                          onChange={(label) =>
                            updateQuestion(group, {
                              ...current,
                              options: current.options.map((entry) =>
                                entry.id === item.id ? { ...entry, label } : entry,
                              ),
                            })
                          }
                          label={`${t('Lựa chọn', 'Option')} ${index + 1}`}
                          required
                          maxLength={500}
                        />
                        <button
                          className="mis-button"
                          type="button"
                          disabled={current.options.length <= 2}
                          aria-label={t(
                            `Xóa lựa chọn ${index + 1} của câu ${start}`,
                            `Remove option ${index + 1} for question ${start}`,
                          )}
                          onClick={() => {
                            if (!(item.label.vi || item.label.en) || confirmRemove())
                              updateQuestion(group, {
                                ...current,
                                options: current.options.filter((entry) => entry.id !== item.id),
                              })
                          }}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}
                    <div className="live-actions">
                      <button
                        className="mis-button"
                        type="button"
                        disabled={current.options.length >= 26}
                        onClick={() =>
                          updateQuestion(group, {
                            ...current,
                            options: [...current.options, option()],
                          })
                        }
                      >
                        <Plus size={16} />
                        {t('Thêm lựa chọn', 'Add option')}
                      </button>
                      {current.kind === 'single' && (
                        <button
                          className="mis-button"
                          type="button"
                          onClick={() => {
                            if (
                              current.options.some((item) => item.label.vi || item.label.en) &&
                              !confirmRemove()
                            )
                              return
                            updateQuestion(group, {
                              ...current,
                              options: Array.from('ABCDEFG', (letter) => ({
                                id: crypto.randomUUID(),
                                label: { vi: letter, en: letter },
                              })),
                            })
                          }}
                        >
                          {t('Dùng nhãn đoạn A–G', 'Use paragraph labels A–G')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="live-actions reading-order-actions">
                  <button
                    type="button"
                    className="mis-button"
                    disabled={questionIndex === 0}
                    onClick={() =>
                      updateGroup(group.id, { questions: move(group.questions, questionIndex, -1) })
                    }
                    aria-label={t(`Đưa câu ${label} lên`, `Move question ${label} up`)}
                  >
                    <ArrowUp size={16} />
                    {t('Lên', 'Up')}
                  </button>
                  <button
                    type="button"
                    className="mis-button"
                    disabled={questionIndex === group.questions.length - 1}
                    onClick={() =>
                      updateGroup(group.id, { questions: move(group.questions, questionIndex, 1) })
                    }
                    aria-label={t(`Đưa câu ${label} xuống`, `Move question ${label} down`)}
                  >
                    <ArrowDown size={16} />
                    {t('Xuống', 'Down')}
                  </button>
                  <button
                    type="button"
                    className="mis-button"
                    onClick={() => {
                      if (confirmRemove())
                        updateGroup(group.id, {
                          questions: group.questions.filter((item) => item.id !== current.id),
                        })
                    }}
                  >
                    <Trash size={16} />
                    {t('Xóa câu', 'Remove question')}
                  </button>
                </div>
              </fieldset>
            )
          })}
          {!group.questions.length && (
            <p className="live-help">
              {t(
                'Nhóm chưa có câu hỏi. Thêm câu trước khi lưu.',
                'This group has no questions. Add a question before saving.',
              )}
            </p>
          )}
          <button
            type="button"
            className="mis-button"
            disabled={total >= 40}
            onClick={() => updateGroup(group.id, { questions: [...group.questions, question()] })}
          >
            <Plus size={16} />
            {t('Thêm câu hỏi', 'Add question')}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="mis-button"
        disabled={value.groups.length >= 20 || total >= 40}
        onClick={() => onChange({ ...value, groups: [...value.groups, group()] })}
      >
        <Plus size={17} />
        {t('Thêm nhóm câu hỏi', 'Add question group')}
      </button>
    </section>
  )
}
