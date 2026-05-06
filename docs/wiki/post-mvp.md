# Post-MVP

What's deferred from kadai's MVP, in roughly the order it should ship. Update this doc as items move (in-progress / shipped / scope-changed). When a feature ships, also update its sibling page in this wiki (`cli-reference.md`, `concepts.md`, etc).

## Verification approach

For anything touching hooks, MCP, the bundled skill, or change-capture: run the **`kadai-dogfood-test` skill** against a fresh temp dir to verify end-to-end after the unit tests pass. The skill spawns a real `claude -p` session in a temp project — same approach as Path A in [the dogfood acceptance test](../dogfood-acceptance-test.md).

For pure CLI/web/docs changes: `bun test` + `bun run typecheck` + targeted smoke is sufficient.

## Shipping plan (proposed)

The post-MVP work is organized as a series of focused plans, each ending in something visibly more useful. Order is by user-felt impact, not implementation complexity.

### Plan 8 — Live updates (SSE) 🟢 **next**

The web viewer auto-refreshes when the spine changes (CLI, MCP, or another browser tab).

- Filesystem watcher on `.kadai/` (chokidar) → SSE event stream
- React hooks subscribe and invalidate on relevant changes
- Replaces manual page reloads

Estimate: small-medium. Mostly server-side SSE infra + a React hook.

### Plan 9 — Search

Spine-wide full-text search.

- API endpoint backed by the existing MCP `search` tool
- Search box in the web viewer top bar that's currently a placeholder
- Result page (`/search?q=...`)

Estimate: small. The MCP `search` tool already does the heavy lifting.

### Plan 10 — Git integration (`kadai sync`)

Closes the loop on the "archive" promise — kadai records what was changed, when, and by which commit.

- `kadai sync` CLI scrapes git log for `STORY-NNN` references in commit messages
- Auto-appends matching commits to that story's `changelog.md` with SHA + date + message
- (Optional flag) auto-transitions story to `done` on PR merge
- Idempotent — re-running adds only new commits

Estimate: medium. Needs git plumbing + dedup logic + tests against a real git repo fixture.

### Plan 11 — Hook polish

The two remaining hooks from spec §5.2.

- **`UserPromptSubmit` hook** — injects "Active: STORY-042 — title. Spec: …. Plan step: …" into the prompt context when a story is picked.
- **`Stop` hook** — if a story was picked and the turn ended without a status update, reminds.

Estimate: small. Same shape as the existing two hooks.

### Plan 12 — Distribution polish

- `bun build --compile` actually exercised — single-binary distribution tested
- Asset embedding into the binary (currently `kadai serve` reads `src/web/dist/` at runtime; would let the binary ship standalone)
- Curl install script (`curl … | sh`)
- Brew formula
- npm package publish

Estimate: medium. Build pipeline + distribution channels.

### Plan 13 — Developer ergonomics

The "minor but real" gaps surfaced during MVP build.

- ID counter writes via `writeFileAtomic` (one of the few non-atomic writes in the codebase)
- Tailwind typography plugin (so markdown content renders with `prose` styling)
- Replace `as any` casts in CLI with typed discriminated-union narrowing helpers
- Replace `@ts-ignore` on dynamic `import('./add')` in `init.ts` with proper static import
- `kadai uninstall` — implementation (currently in CLI listing but not built)
- `kadai reindex` — rebuild `.index.json` cache (post-MVP per spec)
- Phase config migration when phases renamed/removed
- Sparse-ordering re-densification when midpoints tighten (`needsRedensify` exists but isn't called)

Estimate: small per item; medium-large if done together. Could be cherry-picked individually.

### Plan 14 — Multi-project + stretch

Lower-priority but interesting.

- Multi-project switcher in web viewer (browse multiple kadai-managed projects from one UI)
- Activity feed (global stream of changes across all epics)
- Per-phase comparison view (side-by-side scope diffing — "MVP vs full")
- Markdown-only mode (run kadai without MCP/hooks for users who just want files + viewer)
- `record_change` MCP tool (currently the PostToolUse hook writes directly to changelog; a tool would let agents add manual annotations)
- Comprehensive Playwright E2E (currently one smoke test)

Estimate: large. Skip until earlier plans are solid.

---

## Backlog (categorized, not yet sequenced)

This is the canonical list. New items get added here as they're discovered. Items move into the shipping plans above as they're scheduled.

### Surfaced from real use

- `kadai status` ascii output column alignment is loose

### From spec §13 (the original list)

See above sections — Plans 7-14 cover all of spec §13.

### Adapted during build (technical debt)

- `as any` casts in CLI for union fields
- `@ts-ignore` on dynamic import in init.ts
- ID counter writes not atomic
- Tailwind typography not installed
- Asset embedding into compiled binary deferred
- `bun build --compile` never exercised end-to-end

---

## Recently shipped (as items move out of this list)

### Plan 7 — Web viewer interactivity (shipped 2026-05-05)

- `POST /api/items/:id/status` — status mutations from the web
- `GET /api/items/:id/transitions` — exposes legal next states
- `POST /api/items/:id/attach` — multipart upload for spec.md / plan.md
- `core/attach.ts` — extracted from MCP handlers; shared by web + MCP
- StatusPanel right rail on the story page (optimistic UI)
- Drag-drop kanban via @dnd-kit on the feature page
- AttachButton on empty spec/plan tabs
- 3 new Playwright E2E flows
- Plugin version bumped to 0.3.0

### Plan 6 — Workflow completion (shipped 2026-05-05)

- `kadai set-status <id> <status> [--reason]` — arbitrary status mutations from CLI
- `kadai init -y` now creates EPIC-001 "Project setup" so the spine is usable immediately
- `/kadai-add <kind>` — guided creation slash command
- `/kadai-set-status <id> <status>` — slash companion to the new CLI
- `/kadai-unpick` — slash companion to `kadai unpick`
- Plugin version bumped to 0.2.0
