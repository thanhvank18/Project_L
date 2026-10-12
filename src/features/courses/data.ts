export type CourseLanguage = 'english' | 'japanese' | 'korean' | 'chinese'

export type CourseLevel = 'beginner' | 'intermediate'

type LocalizedText = { vi: string; en: string }

export type Course = {
  id: string
  language: CourseLanguage
  level: CourseLevel
  sessions: number
  minutes: number
  coverWord: string
  coverNote: LocalizedText
  title: LocalizedText
  description: LocalizedText
  outcomes: { vi: string[]; en: string[] }
}

// Demonstration content only. Topics and durations illustrate the catalog UI;
// these are not available classes or promises of learning results.
export const courses: Course[] = [
  {
    id: 'english-everyday',
    language: 'english',
    level: 'beginner',
    sessions: 12,
    minutes: 60,
    coverWord: 'Hello.',
    coverNote: { vi: 'Giao tiếp mỗi ngày · A1–A2', en: 'Everyday conversations · A1–A2' },
    title: { vi: 'Tiếng Anh giao tiếp', en: 'Everyday English' },
    description: {
      vi: 'Bắt đầu từ những cuộc trò chuyện gần gũi: giới thiệu bản thân, hỏi đường và chia sẻ về một ngày của bạn.',
      en: 'Start with familiar conversations: introduce yourself, ask for directions, and talk about your day.',
    },
    outcomes: {
      vi: [
        'Giới thiệu bản thân và đặt câu hỏi cơ bản',
        'Luyện nghe và phản hồi trong tình huống thường ngày',
        'Thực hành phát âm qua hội thoại ngắn',
      ],
      en: [
        'Introduce yourself and ask simple questions',
        'Practice listening and responding in everyday situations',
        'Explore pronunciation through short conversations',
      ],
    },
  },
  {
    id: 'english-workplace',
    language: 'english',
    level: 'intermediate',
    sessions: 16,
    minutes: 75,
    coverWord: 'Let’s talk.',
    coverNote: { vi: 'Giao tiếp công việc · B1', en: 'English at work · B1' },
    title: { vi: 'Tiếng Anh nơi công sở', en: 'Workplace English' },
    description: {
      vi: 'Thực hành diễn đạt ý tưởng, trao đổi với đồng nghiệp và viết những email rõ ràng trong công việc.',
      en: 'Practice sharing ideas, talking with colleagues, and writing clear emails for everyday work.',
    },
    outcomes: {
      vi: [
        'Đóng góp ý kiến và đặt câu hỏi trong cuộc họp',
        'Viết email với mục đích và giọng điệu phù hợp',
        'Trình bày ngắn về công việc hoặc một ý tưởng',
      ],
      en: [
        'Share opinions and ask questions in meetings',
        'Write emails with an appropriate purpose and tone',
        'Give a short presentation about your work or an idea',
      ],
    },
  },
  {
    id: 'ielts-foundations',
    language: 'english',
    level: 'intermediate',
    sessions: 18,
    minutes: 90,
    coverWord: 'IELTS',
    coverNote: { vi: 'Làm quen bài thi · B1–B2', en: 'Explore the exam · B1–B2' },
    title: { vi: 'Luyện thi IELTS nền tảng', en: 'IELTS Preparation' },
    description: {
      vi: 'Tìm hiểu cấu trúc bài thi và cách tiếp cận bốn kỹ năng qua các dạng bài thực hành có hướng dẫn.',
      en: 'Explore the exam structure and approaches to all four skills through guided practice activities.',
    },
    outcomes: {
      vi: [
        'Làm quen với các dạng bài nghe và đọc',
        'Lập dàn ý và phát triển ý tưởng cho bài viết',
        'Thực hành trả lời và mở rộng ý trong phần nói',
      ],
      en: [
        'Explore common listening and reading task types',
        'Plan and develop ideas for writing tasks',
        'Practice answering and expanding ideas in speaking tasks',
      ],
    },
  },
  {
    id: 'japanese-n5',
    language: 'japanese',
    level: 'beginner',
    sessions: 16,
    minutes: 75,
    coverWord: 'あ',
    coverNote: { vi: 'Những bước đầu tiên · N5', en: 'Your first steps · N5' },
    title: { vi: 'Tiếng Nhật sơ cấp N5', en: 'Japanese N5 Foundations' },
    description: {
      vi: 'Khám phá hiragana, katakana và những mẫu câu đầu tiên để bắt đầu làm quen với tiếng Nhật.',
      en: 'Explore hiragana, katakana, and your first sentence patterns as you begin learning Japanese.',
    },
    outcomes: {
      vi: [
        'Luyện đọc và viết hiragana, katakana',
        'Làm quen với từ vựng và mẫu câu sơ cấp',
        'Thực hành chào hỏi và giới thiệu bản thân',
      ],
      en: [
        'Practice reading and writing hiragana and katakana',
        'Explore beginner vocabulary and sentence patterns',
        'Practice greetings and self-introductions',
      ],
    },
  },
  {
    id: 'korean-beginner',
    language: 'korean',
    level: 'beginner',
    sessions: 12,
    minutes: 60,
    coverWord: '한글',
    coverNote: { vi: 'Bắt đầu từ Hangul', en: 'Begin with Hangul' },
    title: { vi: 'Tiếng Hàn cho người mới', en: 'Korean for Beginners' },
    description: {
      vi: 'Bắt đầu với bảng chữ cái Hangul, cách ghép âm và những câu nói đơn giản trong cuộc sống hằng ngày.',
      en: 'Begin with the Hangul alphabet, syllable building, and simple expressions for everyday life.',
    },
    outcomes: {
      vi: [
        'Làm quen với Hangul và quy tắc ghép âm',
        'Thực hành chào hỏi và cách xưng hô cơ bản',
        'Luyện hội thoại ngắn về các chủ đề quen thuộc',
      ],
      en: [
        'Explore Hangul and how syllables are formed',
        'Practice greetings and basic forms of address',
        'Try short conversations about familiar topics',
      ],
    },
  },
  {
    id: 'chinese-hsk1',
    language: 'chinese',
    level: 'beginner',
    sessions: 12,
    minutes: 60,
    coverWord: '你好',
    coverNote: { vi: 'Những lời chào đầu tiên · HSK 1', en: 'Your first words · HSK 1' },
    title: { vi: 'Tiếng Trung nền tảng HSK 1', en: 'Chinese HSK 1 Foundations' },
    description: {
      vi: 'Làm quen với pinyin, thanh điệu và các mẫu câu cơ bản qua những tình huống giao tiếp gần gũi.',
      en: 'Explore pinyin, tones, and basic sentence patterns through familiar everyday situations.',
    },
    outcomes: {
      vi: [
        'Luyện pinyin và phân biệt các thanh điệu',
        'Làm quen với chữ Hán và từ vựng cơ bản',
        'Thực hành hỏi đáp về bản thân và sinh hoạt hằng ngày',
      ],
      en: [
        'Practice pinyin and distinguish the tones',
        'Explore basic Chinese characters and vocabulary',
        'Practice questions and answers about yourself and daily life',
      ],
    },
  },
]
