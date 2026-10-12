/** Only explicit answers belong in a submission; personal Reading notes stay in drafts. */
export function submissionAnswer(taskId: string, draft: string | undefined): string {
  if (!draft) return ''
  if (taskId !== 'reading-01') return draft
  try {
    const value: unknown = JSON.parse(draft)
    if (
      !value ||
      typeof value !== 'object' ||
      !('answerOne' in value) ||
      !('answerTwo' in value) ||
      typeof value.answerOne !== 'string' ||
      typeof value.answerTwo !== 'string' ||
      !value.answerOne.trim() ||
      !value.answerTwo.trim()
    )
      return ''
    return JSON.stringify({ answerOne: value.answerOne, answerTwo: value.answerTwo })
  } catch {
    return ''
  }
}
