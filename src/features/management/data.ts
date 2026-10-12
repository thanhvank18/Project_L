import { portalDemoData } from '../learning/data.ts'
import type { ManagementState } from './types.ts'

export const managementDemoData: ManagementState = {
  version: 1,
  courses: [
    {
      id: 'ielts-foundation',
      title: 'IELTS Foundation',
      level: 'B1–B2',
      teacher: 'Demo teacher 01',
      status: 'active',
    },
    {
      id: 'ielts-speaking',
      title: 'IELTS Speaking Practice',
      level: 'B2',
      teacher: 'Demo teacher 02',
      status: 'draft',
    },
  ],
  learners: Array.from({ length: 6 }, (_, index) => ({
    id: `learner-0${index + 1}`,
    name: `Learner 0${index + 1}`,
    email: `learner0${index + 1}@example.test`,
    courseId: index < 4 ? 'ielts-foundation' : 'ielts-speaking',
    status: index === 5 ? 'paused' : 'active',
  })),
  attendance: Array.from({ length: 6 }, (_, index) => ({
    id: `attendance-0${index + 1}`,
    learnerId: `learner-0${index + 1}`,
    courseId: index < 4 ? 'ielts-foundation' : 'ielts-speaking',
    date: '2026-10-12',
    status: 'unmarked',
  })),
  tasks: portalDemoData.assignments.map(({ id, title, description, courseId, skill, due }) => ({
    id,
    title: { ...title },
    instructions: { ...description },
    courseId,
    skill,
    due: due.slice(0, 10),
    published: true,
  })),
  grades: [
    {
      id: 'grade-01',
      taskId: 'writing-01',
      learnerId: 'learner-01',
      score: null,
      feedback: '',
      reviewed: false,
    },
    {
      id: 'grade-02',
      taskId: 'reading-01',
      learnerId: 'learner-02',
      score: 6,
      feedback: 'Sample feedback: explain the evidence in your answer.',
      reviewed: true,
    },
    {
      id: 'grade-03',
      taskId: 'writing-01',
      learnerId: 'learner-03',
      score: null,
      feedback: '',
      reviewed: false,
    },
  ],
  submissions: [],
  materials: [
    {
      id: 'material-01',
      title: 'Learning strategies · Reading',
      courseId: 'ielts-foundation',
      content:
        'Learning a new language takes regular practice. Short, focused sessions can help learners notice new words and use them in context. After reading a paragraph, pause and explain its main idea in your own words. This is sample teaching content for the local preview.',
      published: true,
    },
    {
      id: 'material-02',
      title: 'Planning an essay · Writing',
      courseId: 'ielts-foundation',
      content:
        'Start with a clear position. Choose two supporting ideas, then add an example for each idea. Check that each paragraph develops one point. This sample handout demonstrates how course materials are organized.',
      published: true,
    },
    {
      id: 'material-03',
      title: 'Speaking practice outline',
      courseId: 'ielts-speaking',
      content:
        'Describe a skill you would like to learn. Explain why it interests you and how you would practice. Draft sample content, awaiting publication.',
      published: false,
    },
  ],
  units: [
    {
      id: 'unit-01',
      courseId: 'ielts-foundation',
      title: { vi: 'Tuần 1 · Xây dựng thói quen học', en: 'Week 1 · Building study habits' },
      done: true,
    },
    {
      id: 'unit-02',
      courseId: 'ielts-foundation',
      title: { vi: 'Tuần 2 · Ý tưởng và dẫn chứng', en: 'Week 2 · Ideas and evidence' },
      done: true,
    },
    {
      id: 'unit-03',
      courseId: 'ielts-foundation',
      title: { vi: 'Tuần 3 · Giáo dục và học tập', en: 'Week 3 · Education and learning' },
      done: false,
    },
    {
      id: 'unit-04',
      courseId: 'ielts-speaking',
      title: { vi: 'Tuần 1 · Kể chuyện cá nhân', en: 'Week 1 · Personal stories' },
      done: false,
    },
  ],
  users: [
    {
      id: 'user-student',
      name: 'Demo student',
      email: 'student@example.test',
      role: 'student',
      active: true,
    },
    {
      id: 'user-teacher',
      name: 'Demo teacher',
      email: 'teacher@example.test',
      role: 'teacher',
      active: true,
    },
    {
      id: 'user-assistant',
      name: 'Demo teaching assistant',
      email: 'assistant@example.test',
      role: 'assistant',
      active: true,
    },
    {
      id: 'user-admin',
      name: 'Demo administrator',
      email: 'admin@example.test',
      role: 'admin',
      active: true,
    },
  ],
  notifications: [
    {
      id: 'notification-01',
      title: 'Sample week · Tuần học mẫu',
      body: 'October 12–18, 2026 · 12–18/10/2026. Check assignments and the local consultation schedule. Xem bài tập và lịch hỗ trợ mẫu.',
      date: '2026-10-10',
      recipient: 'all',
      read: false,
    },
    {
      id: 'notification-02',
      title: 'Preparation · Chuẩn bị buổi học',
      body: 'Complete the sample Reading and Writing tasks before consultation access. Hoàn thành bài Reading và Writing mẫu để kiểm tra trạng thái chuẩn bị.',
      date: '2026-10-10',
      recipient: 'student',
      read: false,
    },
  ],
}

export function createManagementState(): ManagementState {
  return structuredClone(managementDemoData)
}
