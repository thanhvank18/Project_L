# English Foundations — original starter learning pack

Created on 11 October 2026 at the user's request. This is original practice
material, intended for B1 / pre-IELTS teaching and awaiting a teacher's content
and difficulty review. It is not copied from YouPass, an official examination,
a certified placement test or a promised band-score improvement.

The three units are **Study habits**, **Shared spaces** and **Everyday decisions**.
Each has an original English passage, five structured Reading questions, an
original Listening recording with five structured questions, a Writing task,
a Speaking prompt, bilingual instructions, vocabulary and objectives.

Source text and the separate answer/transcript guide are in
`server/starter-curriculum-content.ts`. They are server-owned, never imported into
the frontend bundle. The admin import creates one private class, three syllabus
units, three draft learning resources and twelve draft assignments. It does not
create learners, enrollment, grades, dates, reservations or Zoom links. Repeating
the import returns the original class without changing teacher edits.

## Listening audio

The WAV files contain actual synthetic speech of the original English scripts,
created offline with the installed Microsoft Zira Desktop voice through Windows
System.Speech, rate −1, 16 kHz, 16-bit mono PCM. They are approximately 79–84 seconds
each. No OpenAI or other paid network service was used. A teacher should listen
and review pronunciation/pacing before publication. They are narrated announcements,
not recordings of human speakers or multi-speaker conversations.

On explicit import, the API stores bytes as normal private teaching attachments
in SQLite. They become student-readable only through the authenticated file API
after the corresponding assignment is published and current enrollment is valid.
There is no public asset route for these files. The centre's Drive integration is
for learner submission files; these teaching attachments retain existing local storage.

## Teacher preparation

1. Import once using the administrator's starter curriculum control.
2. Assign an actual teacher and review the tasks, audio and private teacher guide.
3. Set real deadlines and schedule actual main lessons and consultation slots.
   The first main lesson is exempt from 1:1 review. Later main lessons require a
   teacher-confirmed review of the previous lesson under the agreed join policy.
4. Publish only the tasks/resources intended for the current stage, then enroll
   actual learners. Do not treat the imported class as automatically listed or
   open for public enrollment.
5. Use the private teacher guide for suggested answers and feedback. Automatic
   Reading/Listening correctness grading is not implemented. The guide is tied to
   the original import; update a separate teaching guide if questions are changed.
   Assigned teachers open **Syllabus** or **Learning materials**, select the class
   in the existing class filter, then choose **Open teacher guide**. Loading and
   downloading both recheck current server permissions. Administrators can also
   open it from the starter curriculum control in Settings. Assistants and students
   do not receive the guide or its answer keys.

These are authored curriculum records created by an explicit administrator action,
not a simulated class history. Importing them never creates attendance, completed
reviews, learner submissions or assessment results. Such learning records must
come from actual later account activity.

The original English source passages stay in English in both interface languages
so learners practise the target language. Navigation, task instructions, objectives,
feedback guidance and explanations are available in Vietnamese and English.
