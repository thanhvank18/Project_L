---
name: Project_L Demo
description: Provisional extraction of the current trial landing page; no approved brand system.
colors:
  primary: '#2249e8'
  primary-hover: '#1938b8'
  paper: '#fafaf8'
  ink: '#202326'
  muted: '#62686f'
  line: '#dfe1e3'
  white: '#ffffff'
  preview-stage: '#e9ecf1'
typography:
  display:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: 'clamp(42px, 5.2vw, 74px)'
    fontWeight: 600
    lineHeight: 1.23
    letterSpacing: '-0.04em'
  headline:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: 'clamp(26px, 2.7vw, 38px)'
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: '-0.04em'
  body:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.9
  label:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: '13px'
    fontWeight: 500
rounded:
  field: '6px'
  button: '7px'
  menu: '8px'
  browser: '9px'
  stage: '12px'
spacing:
  compact: '12px'
  standard: '24px'
  wide: '36px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.white}'
    typography: '{typography.label}'
    rounded: '{rounded.button}'
    padding: '14px 22px'
    height: '54px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-light:
    backgroundColor: '{colors.white}'
    textColor: '{colors.primary}'
    rounded: '{rounded.button}'
    padding: '14px 22px'
  field:
    textColor: '{colors.white}'
    rounded: '{rounded.field}'
    padding: '14px'
---

# Design System: Project_L Demo

## Overview

**Creative North Star: "Provisional studio sample"**

This is a descriptive record of the current fictional digital-studio demo, extracted from the implementation. It is provisional and does not establish an approved identity for the future website. The descriptive North Star is a documentation label, not a user-selected creative commitment.

The observed sample pairs spacious light surfaces with strong Vietnamese typography and a vivid blue accent. Its interactive miniature website adds a contained illustration and color experiment. The page was implemented as a code-led sample; no comp or standing comp-first/code-first preference has been approved. Product purpose, audience, brand, routes, backend, hosting, and browser support remain open in PRODUCT.md.

**Key Characteristics:**

- Large Vietnamese headline and restrained supporting copy.
- Light paper, dark ink, muted text, and a single page accent.
- Desktop split details with a wide interactive preview; one-column mobile sections.
- Phosphor icons and a clearly labeled local-only form.

## Colors

The demo uses bright blue against warm light paper and neutral ink.

### Primary

- **Vivid Blue:** Main CTA, headline emphasis, brand mark, decorative asterisk, and contact section; uses the primary token.
- **Deep Blue:** Primary-button hover treatment; uses the primary-hover token.

### Neutral

- **Light Paper:** Page canvas and mobile navigation.
- **Dark Ink:** Main text and selected preview control outline.
- **Muted Slate:** Supporting text and captions.
- **Soft Divider:** Header and article separators.
- **White:** Text on the accent surface, light button, and miniature browser.
- **Cool Stage:** The preview's surrounding surface.

**The Preview Scope Rule.** Blue, orange, and green theme choices affect only the miniature preview. They are not alternative site-wide brand palettes.

The preview pairs blue (#2249e8) with pale blue (#e8edff), orange (#bd431b) with pale orange (#fff0e8), and green (#21674d) with pale green (#e5f3eb). These remain local concept values.

## Typography

**Display Font:** Be Vietnam Pro (sans-serif fallback).
**Body Font:** Be Vietnam Pro (sans-serif fallback).

The font is self-hosted through Fontsource, with regular, medium, semibold, and bold weights (400, 500, 600, 700). The same family carries Vietnamese headlines, paragraphs, and controls.

### Hierarchy

- **Display:** The frontmatter display role drives the hero; mobile uses a smaller responsive size (clamp(30px, 7.5vw, 46px)) and more open line height (1.35).
- **Headline:** Section headings use the headline role; contact headings are larger (clamp(32px, 3.2vw, 45px)).
- **Title:** Approach titles use medium weight (500) and a compact size (16px desktop, 14px mobile).
- **Body:** Hero copy uses the body role with a constrained width (435px); secondary paragraphs use smaller sizes (13–14px).
- **Label:** Navigation and buttons use medium weight; form labels and captions are smaller (10–12px).

## Layout

The desktop container caps at 1200px with total horizontal clearance of 96px. At widths up to 1000px, clearance becomes 64px; up to 640px, it becomes 40px. The body supports widths from 320px.

Hero typography leads the page, followed by a wide preview. Approach and contact sections use equal columns with generous gaps (90px desktop, 45px at the intermediate breakpoint). Mobile stacks these sections and the preview stage into one column. The miniature site's internal illustration retains its compact two-column composition.

The sample uses generous section spacing: hero top padding (85px desktop), approach padding (110px top, 100px bottom), and contact padding (75px top, 50px bottom). Mobile reduces these values rather than compressing text into desktop columns.

## Elevation & Depth

Most page surfaces are flat, separated with whitespace, fine lines, and contrasting color fields. Depth is concentrated in the miniature browser and its CSS sculpture. The mobile menu has a modest overlay shadow.

### Shadow Vocabulary

- **Preview browser:** Ambient lift (`0 24px 54px #3443661f`) within the concept stage.
- **Mobile menu:** Overlay separation (`0 12px 28px #20232615`).
- **Concept sculpture:** Inset shading (`inset -18px -16px 25px #0002, inset 10px 10px 20px #fff4`) and a blurred grounding ellipse.

## Shapes

Controls and surfaces have gently curved corners using the frontmatter radius roles. The miniature browser clips its contents; the stage is broader and softer. The demo brand mark is a compact rounded square. Circular preview controls and a rotated square above a circle form the illustrative sculpture.

Phosphor is the observed icon family. Arrows support links and CTAs; menu, close, and check icons communicate state.

## Components

### Buttons

Compact, clear action controls use the button radius, medium-weight labels, and arrow icons. Primary buttons use the blue accent with white text; contact buttons invert that assignment. Hover shifts the button upward (2px) with background and transform transitions (0.2s). Visible focus uses an offset outline (3px, 5px offset); focus on the contact surface is white.

### Cards / Containers

The wide cool preview stage contains a white browser frame, rather than a repeating card grid. The browser rotates slightly (−2deg desktop, −1deg mobile) and carries the preview shadow.

### Inputs / Fields

The contact form uses white text, translucent white backgrounds, fine translucent borders, and field radii. Fields have visible labels, native required validation, and character limits. Submission only changes an in-memory status message; it sends and stores nothing. Editing either field resets that success state. No network loading or server error state exists in this sample.

### Navigation

Desktop links run horizontally with an outlined separation before the contact link. At the mobile breakpoint, a labeled menu button opens a vertical panel, exposes expanded state, and closes the menu when an anchor is selected. Links and CTAs target sections within the page.

### Interactive Preview

Three circular controls expose selected state with a check icon, outline, and aria-pressed. The miniature website and CSS sculpture update their local foreground and background colors. Its concept caption identifies it as illustration rather than client work.

### Motion and Access

Smooth anchor scrolling, subtle button movement, and color transitions are the observed motion vocabulary. Reduced-motion preference disables transitions, hover movement, and smooth scrolling. A skip link, semantic landmarks, visible focus, and labeled controls support navigation.

## Do's and Don'ts

### Do:

- **Do** treat these tokens as the current demo's provisional implementation record.
- **Do** preserve Vietnamese font support, visible focus, responsive stacking, and reduced-motion behavior.
- **Do** retain the concept caption and local-only form disclosure while these demo features remain.

### Don't:

- **Don't** interpret preview theme options as alternative site-wide accents.
- **Don't** promote the fictional studio content into approved product claims or client evidence.
- **Don't** treat this code-led sample as a saved workflow preference or approved permanent brand.
