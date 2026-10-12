import { readFileSync } from 'node:fs'
import type {
  Account,
  Assignment,
  AuditEntry,
  Classroom,
  FileRecord,
  Material,
  Skill,
  Text,
  Unit,
} from '../shared/portal.ts'
import type {
  StarterCurriculumImportResult,
  StarterCurriculumStatus,
  StarterTeacherGuide,
  StarterTeacherGuideSource,
} from '../shared/curriculum.ts'
import {
  authenticated,
  bilingual,
  classroom,
  fail,
  get,
  id,
  now,
  put,
  role,
  transaction,
  type Database,
} from './domain-store.ts'
import { persistFileRecord, validateFileUpload } from './domain.ts'
import { readingDefinition } from './reading.ts'
import { starterMetadata, starterUnits } from './starter-curriculum-content.ts'

interface ImportRecord {
  id: string
  classId: string
  importedAt: string
  assignmentCount: number
  unitCount: number
  audioCount: number
}
interface StoredGuide extends StarterTeacherGuideSource {
  id: string
}
const t = (vi: string, en: string): Text => ({ vi, en })
const admin = (db: Database, suppliedActor: Account) => {
  const actor = authenticated(db, suppliedActor)
  role(actor, ['admin'])
  return actor
}

export function starterCurriculumStatus(
  db: Database,
  suppliedActor: Account,
): StarterCurriculumStatus {
  admin(db, suppliedActor)
  const record = get<ImportRecord>(db, 'curriculumImport', starterMetadata.id)
  return {
    ...starterMetadata,
    imported: record ? { classId: record.classId, importedAt: record.importedAt } : null,
  }
}

/** One explicit admin command, not a bootstrap fixture or a client-supplied database snapshot. */
export function importStarterCurriculum(
  db: Database,
  suppliedActor: Account,
): StarterCurriculumImportResult {
  return transaction(db, () => {
    const actor = admin(db, suppliedActor)
    const previous = get<ImportRecord>(db, 'curriculumImport', starterMetadata.id)
    if (previous) {
      if (!get<Classroom>(db, 'class', previous.classId))
        fail(
          409,
          'curriculum_missing_class',
          'The imported class is unavailable. Existing coursework has not been replaced.',
        )
      return {
        classId: previous.classId,
        created: false,
        assignmentCount: previous.assignmentCount,
        unitCount: previous.unitCount,
        audioCount: previous.audioCount,
      }
    }
    const classId = id()
    const createdAt = now()
    put<Classroom>(db, 'class', {
      id: classId,
      title: 'English Foundations · Starter 01',
      level: 'B1 / pre-IELTS · teacher review pending',
      description: `${starterMetadata.description.vi}\n\n${starterMetadata.description.en}`,
      teacherIds: [],
      assistantIds: [],
      studentIds: [],
      active: true,
      listed: false,
      enrollmentOpen: false,
      version: 1,
    })
    const guide: StoredGuide = {
      id: classId,
      classId,
      title: t('Hướng dẫn giáo viên · English Foundations', 'Teacher guide · English Foundations'),
      notice: t(
        'Học liệu gốc bản đầu, cần giáo viên duyệt trước khi công bố. Đáp án tham khảo dùng để giáo viên đánh giá; chưa có chấm tự động. Audio dùng giọng tổng hợp ngoại tuyến Microsoft Zira, không phải hội thoại người thật. Bản hướng dẫn cố định này đi cùng lần nhập đầu; nếu sửa đề, giáo viên phải cập nhật hướng dẫn riêng.',
        'Original first-edition practice for teacher review before publication. Answer keys support teacher review; automatic grading is not enabled. Audio uses the offline synthetic Microsoft Zira voice, not a human conversation. This fixed guide accompanies the initial import; teachers must maintain their own updated guide if they change a task.',
      ),
      units: [],
    }
    for (const unit of starterUnits) {
      put<Unit>(db, 'unit', { id: id(), classId, title: unit.title, completed: false, version: 1 })
      put<Material>(db, 'material', {
        id: id(),
        classId,
        title: `${unit.title.vi} / ${unit.title.en}`,
        content: `MỤC TIÊU / OBJECTIVES\n${unit.objectives.vi}\n${unit.objectives.en}\n\nTỪ VỰNG / VOCABULARY\n${unit.vocabulary.vi}\n${unit.vocabulary.en}\n\nHọc liệu gốc — giáo viên duyệt trước khi công bố. / Original material — teacher review required before publication.`,
        attachmentIds: [],
        published: false,
        version: 1,
      })
      // Assets are repository-owned and never resolved from request input.
      let bytes: Buffer
      try {
        bytes = readFileSync(new URL(`../content/starter/${unit.key}.wav`, import.meta.url))
      } catch {
        return fail(
          503,
          'curriculum_audio_unavailable',
          'Starter audio is unavailable. No class or coursework was imported.',
        )
      }
      const audio: FileRecord = {
        ...validateFileUpload(
          db,
          actor,
          { name: `${unit.key}.wav`, mime: 'audio/wav', classId, purpose: 'material' },
          bytes,
        ),
        id: id(),
        createdAt,
      }
      db.prepare('INSERT INTO file_blobs(id,bytes) VALUES(?,?)').run(audio.id, bytes)
      persistFileRecord(db, actor, audio)
      const assignmentIds = {} as Record<Skill, string>
      for (const skill of ['reading', 'listening', 'writing', 'speaking'] as const) {
        const taskId = id()
        assignmentIds[skill] = taskId
        const instructions =
          skill === 'reading'
            ? t(
                `Đọc văn bản tiếng Anh và trả lời câu hỏi. Có thể đánh dấu, ghi chú riêng và lưu từ mới.\n\n${unit.passage}`,
                `Read the English passage and answer the questions. You may highlight, make private notes and save vocabulary.\n\n${unit.passage}`,
              )
            : skill === 'listening'
              ? t(
                  'Nghe tệp audio đính kèm rồi trả lời câu hỏi. Đọc câu hỏi trước lần nghe đầu; có thể nghe lại để tự luyện. Chú ý thông tin được sửa hoặc thay đổi trong lời nói. Audio thực hành dùng giọng tổng hợp ngoại tuyến; bản chép lời nằm trong hướng dẫn riêng của giáo viên.',
                  'Listen to the attached audio and answer the questions. Read the questions before your first listen; you may replay the recording for practice. Notice information that is corrected or changed by the speaker. This practice audio uses offline synthetic speech; the transcript is in the separate teacher guide.',
                )
              : unit[skill]
        const questionDefinition =
          skill === 'reading' || skill === 'listening' ? readingDefinition(unit[skill]) : undefined
        put<Assignment>(db, 'assignment', {
          id: taskId,
          classId,
          skill,
          title: bilingual(
            {
              title: t(
                `${unit.title.vi} · ${skill[0]!.toUpperCase()}${skill.slice(1)}`,
                `${unit.title.en} · ${skill[0]!.toUpperCase()}${skill.slice(1)}`,
              ),
            },
            'title',
            200,
          ),
          instructions: bilingual({ instructions }, 'instructions'),
          ...(questionDefinition ? { reading: questionDefinition } : {}),
          ...(skill === 'writing' ? { pasteRestricted: false } : {}),
          dueAt: '',
          published: false,
          required: true,
          attachmentIds: skill === 'listening' ? [audio.id] : [],
          version: 1,
          createdAt,
          updatedAt: createdAt,
        })
      }
      guide.units.push({
        title: unit.title,
        assignmentIds,
        readingAnswers: unit.readingAnswers,
        readingRationale: unit.readingRationale,
        listeningTranscript: unit.transcript,
        listeningAnswers: unit.listeningAnswers,
        listeningRationale: unit.listeningRationale,
        writingReview: unit.writingReview,
        speakingReview: unit.speakingReview,
        consultationReview: unit.consultationReview,
      })
    }
    put(db, 'curriculumTeacherGuide', guide)
    put<ImportRecord>(db, 'curriculumImport', {
      id: starterMetadata.id,
      classId,
      importedAt: createdAt,
      assignmentCount: starterMetadata.assignmentCount,
      unitCount: starterMetadata.unitCount,
      audioCount: starterMetadata.audioCount,
    })
    put<AuditEntry>(db, 'audit', {
      id: id(),
      actorId: actor.id,
      action: 'curriculum.import',
      targetId: classId,
      createdAt,
    })
    return {
      classId,
      created: true,
      assignmentCount: starterMetadata.assignmentCount,
      unitCount: starterMetadata.unitCount,
      audioCount: starterMetadata.audioCount,
    }
  })
}

/** Teacher keys/transcripts never enter general state, public assets or the client bundle. */
export function getStarterTeacherGuide(
  db: Database,
  suppliedActor: Account,
  classId: string,
): StarterTeacherGuide {
  const actor = authenticated(db, suppliedActor)
  role(actor, ['admin', 'teacher'])
  classroom(db, actor, classId, true)
  const guide =
    get<StoredGuide>(db, 'curriculumTeacherGuide', classId) ??
    fail(404, 'not_found', 'This class has no starter curriculum guide.')
  const lines = [
    `# ${guide.title.vi} / ${guide.title.en}`,
    '',
    guide.notice.vi,
    '',
    guide.notice.en,
    '',
  ]
  const bilingualSection = (title: string, value: Text) =>
    lines.push(`### ${title}`, '', value.vi, '', value.en, '')
  for (const unit of guide.units) {
    lines.push(`## ${unit.title.vi} / ${unit.title.en}`, '')
    lines.push(
      '### Assignment IDs / Mã bài tập',
      '',
      ...Object.entries(unit.assignmentIds).map(([skill, key]) => `- ${skill}: ${key}`),
      '',
    )
    for (const skill of ['reading', 'listening'] as const) {
      lines.push(
        `### ${skill === 'reading' ? 'Reading' : 'Listening'} · Answer key / Đáp án`,
        '',
        ...Object.entries(unit[`${skill}Answers`]).map(
          ([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`,
        ),
        '',
      )
      bilingualSection('Explanation / Giải thích', unit[`${skill}Rationale`])
    }
    lines.push('### Listening transcript / Bản chép lời', '', unit.listeningTranscript, '')
    bilingualSection('Writing review / Nhận xét viết', unit.writingReview)
    bilingualSection('Speaking review / Nhận xét nói', unit.speakingReview)
    bilingualSection('1:1 review / Ôn tập 1:1', unit.consultationReview)
  }
  return {
    title: guide.title,
    notice: guide.notice,
    // Project explicitly so internal assignment identifiers never enter the reading view.
    units: guide.units.map((unit) => ({
      title: unit.title,
      readingAnswers: unit.readingAnswers,
      readingRationale: unit.readingRationale,
      listeningTranscript: unit.listeningTranscript,
      listeningAnswers: unit.listeningAnswers,
      listeningRationale: unit.listeningRationale,
      writingReview: unit.writingReview,
      speakingReview: unit.speakingReview,
      consultationReview: unit.consultationReview,
    })),
    markdown: lines.join('\n'),
  }
}
