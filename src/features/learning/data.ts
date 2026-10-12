import type { PortalData, VocabularyWord } from './types.ts'

// All content and dates below are synthetic fixtures for the local preview.
export const portalDemoData: PortalData = {
  courses: [
    {
      id: 'ielts-foundation',
      title: { vi: 'IELTS Foundation', en: 'IELTS Foundation' },
      subtitle: { vi: 'Lớp học minh họa · Tuần 3', en: 'Sample classroom · Week 3' },
      level: 'Foundation',
      topic: { vi: 'Giáo dục và học tập', en: 'Education and learning' },
      description: {
        vi: 'Nội dung mẫu để trải nghiệm bài tập, lịch học và sổ từ vựng. Đây không phải khóa học đang tuyển sinh.',
        en: 'Sample content for exploring assignments, the schedule and vocabulary. This is not a course open for enrollment.',
      },
      weeks: 8,
      currentWeek: 3,
    },
  ],
  assignments: [
    {
      id: 'reading-01',
      courseId: 'ielts-foundation',
      title: { vi: 'Đọc hiểu: Thói quen học tập', en: 'Reading: Learning habits' },
      description: {
        vi: 'Đọc đoạn văn mẫu và trả lời câu hỏi bằng lời của bạn.',
        en: 'Read the sample passage and answer the questions in your own words.',
      },
      skill: 'reading',
      minutes: 20,
      due: '2026-10-13T18:00:00+07:00',
      required: true,
    },
    {
      id: 'writing-01',
      courseId: 'ielts-foundation',
      title: { vi: 'Viết: Không gian học tập', en: 'Writing: A place to learn' },
      description: {
        vi: 'Viết một đoạn văn về không gian giúp bạn tập trung học tập.',
        en: 'Write a paragraph about a place that helps you focus on learning.',
      },
      skill: 'writing',
      minutes: 30,
      due: '2026-10-15T18:00:00+07:00',
      required: true,
    },
    {
      id: 'listening-01',
      courseId: 'ielts-foundation',
      title: { vi: 'Nghe: Một buổi học', en: 'Listening: A study session' },
      description: {
        vi: 'Xem trước yêu cầu bài nghe. Bản mẫu chưa có âm thanh hoặc chức năng nộp bài.',
        en: 'Preview the listening task. Audio and submission are not available in this demo.',
      },
      skill: 'listening',
      minutes: 15,
      due: '2026-10-16T18:00:00+07:00',
      required: false,
    },
    {
      id: 'speaking-01',
      courseId: 'ielts-foundation',
      title: { vi: 'Nói: Một điều bạn muốn học', en: 'Speaking: Something you want to learn' },
      description: {
        vi: 'Xem trước câu hỏi luyện nói. Ghi âm và phản hồi AI chưa được kết nối.',
        en: 'Preview a speaking prompt. Recording and AI feedback are not connected yet.',
      },
      skill: 'speaking',
      minutes: 10,
      due: '2026-10-18T18:00:00+07:00',
      required: false,
    },
  ],
  sessions: [
    {
      id: 'class-01',
      courseId: 'ielts-foundation',
      title: { vi: 'Lớp chính: Đọc và từ vựng', en: 'Main class: Reading and vocabulary' },
      start: '2026-10-12T19:00:00+07:00',
      end: '2026-10-12T20:30:00+07:00',
      type: 'class',
    },
    {
      id: 'class-02',
      courseId: 'ielts-foundation',
      title: {
        vi: 'Lớp chính: Viết và phát triển ý',
        en: 'Main class: Writing and developing ideas',
      },
      start: '2026-10-14T19:00:00+07:00',
      end: '2026-10-14T20:30:00+07:00',
      type: 'class',
    },
    {
      id: 'class-03',
      courseId: 'ielts-foundation',
      title: { vi: 'Lớp chính: Nghe và nói', en: 'Main class: Listening and speaking' },
      start: '2026-10-17T09:00:00+07:00',
      end: '2026-10-17T10:30:00+07:00',
      type: 'class',
    },
  ],
  slots: [
    {
      id: 'slot-01',
      start: '2026-10-13T18:30:00+07:00',
      end: '2026-10-13T19:00:00+07:00',
      host: { vi: 'Giáo viên mẫu', en: 'Demo teacher' },
    },
    {
      id: 'slot-02',
      start: '2026-10-13T19:15:00+07:00',
      end: '2026-10-13T19:45:00+07:00',
      host: { vi: 'Giáo viên mẫu', en: 'Demo teacher' },
    },
    {
      id: 'slot-03',
      start: '2026-10-15T18:30:00+07:00',
      end: '2026-10-15T19:00:00+07:00',
      host: { vi: 'Giáo viên mẫu', en: 'Demo teacher' },
    },
    {
      id: 'slot-04',
      start: '2026-10-18T10:00:00+07:00',
      end: '2026-10-18T10:30:00+07:00',
      host: { vi: 'Giáo viên mẫu', en: 'Demo teacher' },
    },
  ],
  learners: [
    {
      id: 'learner-01',
      name: { vi: 'Học viên mẫu 01', en: 'Demo learner 01' },
      status: 'ready',
      submitted: 2,
    },
    {
      id: 'learner-02',
      name: { vi: 'Học viên mẫu 02', en: 'Demo learner 02' },
      status: 'review',
      submitted: 2,
    },
    {
      id: 'learner-03',
      name: { vi: 'Học viên mẫu 03', en: 'Demo learner 03' },
      status: 'missing',
      submitted: 1,
    },
    {
      id: 'learner-04',
      name: { vi: 'Học viên mẫu 04', en: 'Demo learner 04' },
      status: 'ready',
      submitted: 2,
    },
    {
      id: 'learner-05',
      name: { vi: 'Học viên mẫu 05', en: 'Demo learner 05' },
      status: 'missing',
      submitted: 0,
    },
    {
      id: 'learner-06',
      name: { vi: 'Học viên mẫu 06', en: 'Demo learner 06' },
      status: 'review',
      submitted: 2,
    },
  ],
}

export const demoVocabulary: VocabularyWord[] = [
  {
    id: 'word-curriculum',
    word: 'curriculum',
    meaning: { vi: 'chương trình học', en: 'the subjects and content taught in a course' },
    example: 'The curriculum includes reading and writing activities.',
    topic: { vi: 'Giáo dục và học tập', en: 'Education and learning' },
  },
  {
    id: 'word-concentrate',
    word: 'concentrate',
    meaning: { vi: 'tập trung', en: 'to give your attention to one activity' },
    example: 'I concentrate better when I study in a quiet room.',
    topic: { vi: 'Giáo dục và học tập', en: 'Education and learning' },
  },
]

export function loadPortalData(): Promise<PortalData> {
  return Promise.resolve(structuredClone(portalDemoData))
}
