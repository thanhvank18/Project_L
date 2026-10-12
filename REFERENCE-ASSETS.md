# Elite Pathway reference inventory

Retrieved 2026-10-09 for the user's requested local reproduction of
https://elitepathwayeducation.com/vi and https://elitepathwayeducation.com/en.
The files remain attributable to the source website; this record does not assert
new ownership or a redistribution license.

## Source snapshots and content

- `vi.html`, `en.html`: public HTML responses, including Next flight dictionaries.
- `vi-messages.json`, `en-messages.json`: the exact source dictionaries extracted
  by parsing JSON, without executing the website's JavaScript.
- `vi-text.txt`: visible Vietnamese source text for quick comparison.
- `site.css`: source CSS from `/_next/static/chunks/0aykm.~nkj7_t.css`.
- `page.js`: fetched public chunk; it is a polyfill and was not used for content.
- `src/i18n/elite.ts` exports those dictionaries as typed `eliteMessages`.

The names, academic credentials, statistics, quotes and course claims were copied
from the requested reference. They have not been independently verified.

## Order and visual system

Header navigation; hero `#home`; instructor `#about`; five IELTS course tabs
`#courses`; classroom images `#gallery`; testimonials `#testimonials`; contact
`#contact`; footer. The default course tab is CoreDevelopment, band 5.0–6.5.

Observed CSS variables: background/surface `#f8f9fa`, foreground `#191c1d`,
primary `#775a19`, primary-container `#c5a059`, on-primary-container `#4e3700`,
secondary `#6b5b52`, tertiary `#516072`, outline `#7f7667`, outline-variant
`#d1c5b4`. Body uses Inter, headings Playfair Display. The source loads these
fonts through local woff2 assets; copied Vietnamese, Latin and Latin Extended
subsets preserve both languages. `fonts-local.css` contains ready-to-use local
font-face declarations. Source has Inter weights 400/600 and Playfair 600/700.

## Local images

All paths below are under `/elite-reference/` in `public`.

| Local file                | Original source path                                            | Delivery                                            |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| logo.svg                  | /logo.svg                                                       | Original SVG (contains source's embedded mark)      |
| liz-portrait.jpeg         | /liz-image.jpeg                                                 | Original 800×800, 32 KB                             |
| classroom-teaching.jpg    | /Pics%20for%20web/IMG-20250530-WA0001.jpg                       | Source Next image optimizer, width 1200, quality 75 |
| classroom-interaction.jpg | /Pics%20for%20web/IMG_20250817_090424_615.jpg                   | Original 585×439, 20 KB                             |
| online-lecture.jpg        | /Pics%20for%20web/VideoCapture_20250822-145624.jpg              | Source optimizer, width 750, quality 75             |
| academic-workshop.jpeg    | /Pics%20for%20web/tmp_2a203207-9a1f-4e2d-91ba-bf4948661c9d.jpeg | Source optimizer, width 750, quality 75             |
| academic-success.jpeg     | /Pics%20for%20web/tmp_5fb03476-82eb-4eb4-a729-b3597f914cf2.jpeg | Source optimizer, width 750, quality 75             |
| student-progress.jpeg     | /Pics%20for%20web/tmp_877a465b-cb45-4986-b992-e85fe5ee0e8a.jpeg | Source optimizer, width 750, quality 75             |
| student-guidance.jpeg     | /Pics%20for%20web/tmp_8a85e6b4-4f39-492a-95a0-9df8b7fea831.jpeg | Source optimizer, width 750, quality 75             |

Base source URL: `https://elitepathwayeducation.com`.
Optimizer format: `/_next/image?url=<encoded original path>&w=<width>&q=75`.
These exact supported widths were present in the source HTML srcset.
Some initially fetched full-size originals are retained only in ignored
`.local/elite-reference/originals`, not in public delivery.

## Existing links and integration notes

- Email: `liz@elitepathwayeducation.com`.
- Phone shown: `+44 7543159881`.
- Teaching hours shown: `09:00 - 15:00 & 19:00 - 22:00`, Vietnam time.
- Facebook: `https://www.facebook.com/profile.php?id=100015290293334`.
- Messenger: `https://m.me/100015290293334`.
- Source form dictionary describes an email draft, not successful server delivery.
- New login action should target the already-running local MIS login
  `http://127.0.0.1:3001/login` per the user's request.
- Preserve the Project_L course catalog at `/courses`; the reference's `#courses`
  is an in-page IELTS overview and can coexist with that path.
- Keep persistent VI/EN state consistent with existing
  `getInitialLanguage` and `languageStorageKey` from `src/i18n/messages.ts`.

No forms were submitted, no external messages sent, and no backend services copied.
