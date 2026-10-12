---
version: 1
slug: 'src-pages-coursespage-tsx'
primary_target: 'src/pages/CoursesPage.tsx'
related_targets: ['src/features/courses/CourseCard.tsx', 'src/styles/courses.css']
---

## Direction contract

THESIS: A language-course catalog that helps a learner compare subject, level,
and time commitment, then keep a shortlist. Search and course content lead;
there is no marketing hero or invented social proof.

OWN-WORLD: Extend the existing Project L paper, ink, blue action color, Be Vietnam
Pro and Phosphor controls. Course covers are typographic lesson vocabulary in
subdued subject colors, not new brand tokens. Fixed type sizes and native filters.

STORY: Choose a language, find a suitable level, inspect a short syllabus, and
save a course. All authored course data is explicitly demonstration content.
The user confirmed foreign languages and future lessons through MS Teams;
meeting links and lesson implementation are deferred.

FIRST VIEWPORT: Compact brand/navigation header, left-aligned 36px catalog title,
search and level filter, a narrow language sidebar, then a three-column course
catalog on a wide desktop. Mobile has scrollable language choices and one column.

FORM: Precisely scoped catalog inside the incumbent visual system, code-led
extension; no new visual-world selection or standing workflow preference.
Inline syllabus disclosures and bookmark controls are the main interactions.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implementation notes

The catalog extends the incumbent paper, ink, blue action color, Be Vietnam Pro,
and Phosphor system. These notes describe this surface only; they do not establish
an approved brand system or change the root DESIGN.md or its existing sidecar.
Course content remains labeled as demonstration data. Covers use live typography
and CSS color fields; no raster assets ship on this surface.

- **Type:** The catalog title is semibold (36px, line height 1.35), reducing to
  30px at 780px and 27px at 520px. Intro copy is 14px, reducing to 13px at 520px.
  Course titles are semibold (17px, line height 1.5), increasing to 18px in the
  single-column view. Descriptions use 12px with line height 1.8, increasing to
  13px at 520px. Navigation and search text use 13px; filters use 12px; supporting
  metadata and disclosure labels use 10–11px, with course metadata and disclosure
  text increasing to 12px at 520px. Cover vocabulary is semibold (46px); cover
  labels and notes use 10px and 9px respectively.
- **Layout:** The container caps at 1280px with 96px total horizontal clearance.
  Desktop uses a 180px language sidebar, a 38px gutter, and three course columns
  with 25px row and 22px column gaps. At 1180px, clearance becomes 64px, the
  sidebar becomes 165px, the gutter becomes 25px, and the catalog becomes two
  columns. At 780px, navigation wraps beneath the brand, search occupies its own
  row, and languages become a horizontally scrollable row above the results. At
  520px, clearance becomes 40px, the level field fills its row, and cards form one
  column with 23px gaps. Covers are 164px high, increasing to 170px at 520px.
- **Illustrative cover palettes:** Each pair is a local background and text color:
  pale blue/navy (#e2ebf8 / #244577), peach/brown for Japanese (#f3e5df / #7b4537),
  sage/green for Korean (#e4ebe5 / #355b46), sand/brown for Chinese (#eee7d8 /
  #675331), lavender/slate for workplace English (#e5e7f0 / #454d78), and pale
  teal/deep teal for IELTS foundations (#e0eded / #2c5d5c). These distinguish demo
  subjects and courses, and are not additional site-wide brand accents.
- **Controls and surfaces:** White cards use a fine divider border, 10px corners,
  and no shadow. Search and native select controls use white surfaces and 7px
  corners; search is at least 52px high and shows an accent border and 1px accent
  ring on focus within. Active catalog navigation has blue text and a blue lower
  border. Selected language filters pair blue text with a pale blue background
  (#eff2fe); hover uses a neutral background (#f0f1f2). Recovery buttons use blue
  with white text and the incumbent deep-blue hover. Keyboard focus remains
  visible, including an inset outline for card disclosure controls.
- **States and interaction:** Search, language and level filters, and native
  sorting controls update the local catalog and announced result count. A clear
  search action restores input focus. Separate empty views cover an empty saved
  list and unmatched filters, each with its appropriate recovery action. Inline
  curriculum disclosures expose expanded state and retain content in a hidden
  region when closed. Their chevrons rotate over 180ms; reduced-motion preference
  removes the transition. Course data is synchronous and local, so there is no
  network loading or server-error presentation.
- **VI/EN and bookmarks:** Both interface modes cover controls, course text,
  document title and language, empty states, and accessible announcements. The
  shared locale choice persists in local storage. Bookmark buttons expose pressed
  state, switch from outlined to filled Phosphor icons, and announce save/removal
  with the course title. Saved identifiers persist locally and populate the saved
  view and count; unavailable storage falls back to the current in-memory state.
  These are local bookmarks, with no account or backend persistence. Teams appears
  only in the deferred lesson-format explanation; no meeting links ship.
