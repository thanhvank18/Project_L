# Project_L

## Scope

This project will contain the frontend of a website. The product purpose, audience,
routes, backend, and hosting target are not decided yet.
The selected foundation is React + Vite + TypeScript, Tailwind CSS, and pnpm.
Read PRODUCT.md before implementation. Keep open decisions explicit.

## Design workflow

- Use design-taste-frontend to establish direction when a landing page, portfolio,
  or redesign brief exists. State the design read before writing UI code.
- Use impeccable for interface review and refinement. Follow its context command
  and relevant references. For product UI and dashboards, use impeccable's
  Operate guidance rather than forcing a landing-page aesthetic.
- Decide the visual direction from the confirmed brief and real assets. Do not
  invent brand colors, testimonials, customer names, pricing, or product claims.
- Record a confirmed design system in DESIGN.md when actual design begins.
  No visual system has been approved yet.
- The comp-first/code-first preference is undecided. Follow the skill's question
  flow before saving a default. Do not treat silence as a saved preference.

## Implementation conventions

- Use TypeScript with strict checking and the `@/` alias for imports within src.
- Use pnpm and preserve pnpm-lock.yaml. Run `pnpm check` before handoff.
- Keep pages, reusable components, styles, and API integration responsibilities
  distinct; introduce directories only when they contain real implementation.
- Check installed dependencies before importing libraries. Use one component
  foundation and one icon family consistently.
- Centralize design tokens once a visual system is established.
- Use semantic HTML, accessible labels, keyboard navigation, visible focus,
  adequate contrast, responsive layouts, and reduced-motion support.
- Implement loading, empty, error, and success states where applicable.
- Keep credentials out of frontend code and version control. Only expose public
  client configuration. Add a safe .env.example when actual variables exist.
- Preserve existing content and behavior in refinements unless the user requests
  a change. Do not add dependencies or build backend features without a need.

## Verification and handoff

- Run the configured type check, lint, and production build after substantive
  implementation. Report checks that could not run.
- Review changed UI at desktop and mobile sizes and exercise key interactions.
  Follow impeccable's bounded review workflow and detector instructions.
- Add meaningful behavior tests when justified by complexity; avoid tests that
  only duplicate implementation or assert incidental markup.
- Keep README.md accurate with install, development, and validation commands.
- Keep project settings local. Do not change global Codex settings for this project.
