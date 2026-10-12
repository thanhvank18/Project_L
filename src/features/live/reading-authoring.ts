import type { Locale, Text } from '../../../shared/portal'
import {
  readingLimits,
  type ReadingDefinition,
  type ReadingGroup,
  type ReadingQuestion,
} from '../../../shared/reading'

const blankText = (): Text => ({ vi: '', en: '' })
export const newReadingOption = () => ({ id: crypto.randomUUID(), label: blankText() })
export const newReadingQuestion = (): ReadingQuestion => ({
  id: crypto.randomUUID(),
  prompt: blankText(),
  kind: 'single',
  options: [newReadingOption(), newReadingOption()],
})
export const newReadingGroup = (): ReadingGroup => ({
  id: crypto.randomUUID(),
  title: blankText(),
  instructions: blankText(),
  questions: [newReadingQuestion()],
})
export const newReadingDefinition = (): ReadingDefinition => ({
  startNumber: 1,
  groups: [newReadingGroup()],
})
export const readingQuestionSlots = (question: ReadingQuestion) =>
  question.kind === 'multiple' ? question.selectCount : 1

/** Author-facing checks provide a useful location; server validation remains authoritative. */
export function readingEditorError(value: ReadingDefinition, locale: Locale): string {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en)
  const complete = (text: Text) => Boolean(text.vi.trim() && text.en.trim())
  if (!Number.isInteger(value.startNumber) || value.startNumber < 1 || value.startNumber > 1000)
    return t(
      'Số câu bắt đầu phải từ 1 đến 1000.',
      'The starting number must be between 1 and 1000.',
    )
  if (!value.groups.length || value.groups.length > 20)
    return t('Thêm từ 1 đến 20 nhóm câu hỏi.', 'Add between 1 and 20 question groups.')
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > readingLimits.definitionBytes)
    return t(
      'Nội dung câu hỏi vượt giới hạn lưu. Rút gọn hoặc tách thành bài tập khác; phần đang nhập vẫn được giữ.',
      'The question definition exceeds the save limit. Shorten it or split it into another assignment; your input is kept.',
    )
  let number = value.startNumber
  for (const [index, group] of value.groups.entries()) {
    if (!complete(group.title) || !group.questions.length)
      return t(
        `Nhóm ${index + 1}: nhập tiêu đề Việt/Anh và thêm ít nhất một câu.`,
        `Group ${index + 1}: enter both titles and add at least one question.`,
      )
    for (const question of group.questions) {
      const prefix = t(`Câu ${number}`, `Question ${number}`)
      if (!complete(question.prompt))
        return `${prefix}: ${t('nhập nội dung Việt/Anh.', 'enter both Vietnamese and English prompts.')}`
      if (question.kind === 'short') {
        if (!Number.isInteger(question.maxWords) || question.maxWords < 1 || question.maxWords > 20)
          return `${prefix}: ${t('giới hạn từ phải từ 1 đến 20.', 'the word limit must be between 1 and 20.')}`
      } else {
        if (
          question.options.length < 2 ||
          question.options.length > 26 ||
          question.options.some((option) => !complete(option.label))
        )
          return `${prefix}: ${t('cần 2–26 lựa chọn, mỗi lựa chọn có nội dung Việt/Anh.', 'provide 2–26 options with both Vietnamese and English labels.')}`
        if (
          question.kind === 'multiple' &&
          (!Number.isInteger(question.selectCount) ||
            question.selectCount < 1 ||
            question.selectCount > question.options.length)
        )
          return `${prefix}: ${t('số đáp án cần chọn phải từ 1 đến số lựa chọn.', 'the required selection count must be between 1 and the option count.')}`
      }
      number += readingQuestionSlots(question)
    }
  }
  return number - value.startNumber > 40
    ? t(
        'Một bài hỗ trợ tối đa 40 vị trí trả lời; câu chọn nhiều chiếm số vị trí tương ứng.',
        'An assignment supports up to 40 answer slots; multiple-choice selections each count as one slot.',
      )
    : ''
}
