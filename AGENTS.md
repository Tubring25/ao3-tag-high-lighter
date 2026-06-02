# AGENTS.md

## Project

AO3 Tag Highlighter — a Chrome extension (Manifest V3) for AO3 tag-based highlighting, warning, and work collapsing. Desktop Chrome only.

## Current Phase

Initial implementation in progress (V1).
Core logic, renderer, and storage modules are implemented and tested.
Next: content script entry wiring, background message forwarding, page interaction, popup/options UI.

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript (strict)
- Vanilla DOM + CSS for all UI (no React / Vue / framework in MVP)
- Bundler: Vite
- Storage: `chrome.storage.local`

## In Scope (MVP)

- Desktop Chrome only
- AO3 listing pages + single work page tag recognition
- Tag categories: relationship / character / freeform
- Match modes: exact / contains / wildcard
- Rule actions: highlight / warn / hideWork
- Page-level hover button → quick-add rule menu
- Popup: current page hit summary + global toggle
- Options page: full rule CRUD + enable/disable
- Local-only storage, no login, no network

## Out of Scope

Do **not** implement unless explicitly requested:

- Mobile interaction design
- Cloud sync / login / account system
- AI recommendation
- Automatic multi-page scraping or batch analysis
- Complex boolean rule expressions
- Rule sharing / template marketplace
- React or any UI framework
- Cross-browser support (Firefox / Safari)

## Read First

When starting any task, read relevant docs in this order:

1. `docs/00-overview/project-brief.md` — one-page project summary
2. `docs/00-overview/repo-map.md` — directory layout & conventions
3. `docs/10-product/prd.md` — product requirements & user stories
4. `docs/10-product/mvp.md` — MVP scope, what's in / what's out
5. `docs/20-architecture/system-overview.md` — architecture, modules, data models
6. `docs/30-planning/backlog.md` — task list with priorities
7. `docs/40-quality/definition-of-done.md` — acceptance criteria

## Active Task

Current sprint folder:

    docs/30-planning/active/2026-04-ao3-plugin-mvp/

Key files to keep updated when making meaningful progress:

- `checklist.md` — task status (todo / in-progress / done / blocked)
- `handoff.md` — what was done, where to continue, what to read first
- `decisions.md` — any design or tech decisions made during work

## Source Layout (planned)

```
src/
  background/        # service worker
  content/           # AO3 page injection: parser, renderer, hover menu
  core/              # pure logic: types, ruleEngine, wildcard, priority
  storage/           # chrome.storage wrappers
  popup/             # extension popup UI
  options/           # full rule management UI
  shared/            # constants, message types, utils
  styles/            # content script CSS
```

Core data types are defined in `src/core/types.ts`.
The rule engine lives in `src/core/ruleEngine.ts`.

## Architecture Constraints

1. **Rule model ↔ interaction decoupled** — rules must not depend on hover; the interaction layer can be swapped later.
2. **Match engine ↔ render decoupled** — hit detection is pure logic; rendering is a separate pass.
3. **Content script ↔ management UI decoupled** — content script reads rules and renders; popup/options write rules.

## Common Commands

```sh
npm install
npm run dev          # watch + rebuild
npm run build        # production build
npm run lint
npm run test
```

All commands are functional. Tests use Vitest with jsdom environment.

## Working Rules

- Keep root-level files concise; long-lived docs go under `docs/`.
- Product docs → `docs/10-product/`.
- Architecture & data model docs → `docs/20-architecture/`.
- Active task progress **only** under `docs/30-planning/active/<task>/`.
- Do not create duplicate planning files at the repo root.
- Prefer updating existing files over creating new ones.
- When writing code, follow the directory structure above; do not invent new top-level directories without an ADR.
- UI design / implementation must not use gradient backgrounds; use solid fills, borders, spacing, and typography instead.
- Hover / focus states must not add outer outline borders around components; distinguish states with controlled color, opacity, or tonal changes instead.

## Definition of Done

A task is considered complete only when:

1. Relevant docs are updated.
2. Checklist items in the active task folder are checked.
3. Code compiles and passes lint + tests (when applicable).
4. `handoff.md` reflects current state and the next step.
