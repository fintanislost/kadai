# Post-MVP

What's deferred from kadai's MVP, in roughly the order it should ship. Update this doc as items move (in-progress / shipped / scope-changed). When a feature ships, also update its sibling page in this wiki (`cli-reference.md`, `concepts.md`, etc).

## Verification approach

For anything touching hooks, MCP, the bundled skill, or change-capture: run the **`kadai-dogfood-test` skill** against a fresh temp dir to verify end-to-end after the unit tests pass. The skill spawns a real `claude -p` session in a temp project — same approach as Path A in [the dogfood acceptance test](../dogfood-acceptance-test.md).

For pure CLI/web/docs changes: `bun test` + `bun run typecheck` + targeted smoke is sufficient.

## Shipping plan (proposed)

🎉 **All planned post-MVP work is shipped.** Only one-shot release-publishing user actions remain (publish GitHub Releases, submit Homebrew formula PR, npm publish).

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

### Plan 15 — Multi-project switcher (shipped 2026-05-06)

- `~/.kadai/known-projects.json` registry + `core/projects.ts` helpers
- `kadai serve register [path] [--slug] [--name] / list / unregister <slug>` subcommands
- Multi-project server mode: per-slug `EventBus` + `startWatcher` + path-prefixed routing
- `GET /api/projects` + `/api/p/<slug>/<rest>` API surface
- `/projects` picker page + `/p/$slug/...` SPA routes
- Header shows active project name + "← Switch" link in multi-mode
- Single-project mode unchanged (backward compat — no break)
- 18 new unit tests + 4 new E2E flows (18 total)
- Plugin version bumped to **1.1.0** — kadai post-MVP backlog **fully drained**

### Plan 14 — Stretch features (shipped 2026-05-06)

- MCP `record_change` tool — agents append `note`-shaped annotations to the picked story's changelog
- `kadai init --markdown-only` — spine + README only; skip MCP/hooks/CLAUDE.md integration
- `GET /api/activity` + `/activity` page — flat reverse-chronological feed across the spine
- `GET /api/compare?a=&b=` + `/compare` page — side-by-side phase comparison with common-title overlap
- 6 new Playwright E2E flows (14 total) — illegal-transition error, search→detail click, plan attach, Activity, Compare ×2
- 20 new unit tests (4 record_change + 3 markdown-only + 4 activity + 4 compare + 5 api: activity/compare)
- Plugin version bumped to **1.0.0** — post-MVP backlog drained except multi-project + release publishing

### Plan 13 — Developer ergonomics (shipped 2026-05-06)

- `nextId` writes the counter file via `writeFileAtomic` (on top of the existing `proper-lockfile` advisory lock)
- `core/item-helpers.ts` — typed `getPhase` / `getParent` / `getOrder` etc. accessors; CLI files migrated off `(item.data as any)` casts
- `init.ts` — `// @ts-ignore` removed; `runAdd` is a static top-of-file import
- `kadai uninstall [--keep-spine] [--yes]` — reverse of `init`
- `kadai phases rename` migrates referencing items; `kadai phases remove --move-to <slug>` migrates before removing (refuses without --move-to when items would be orphaned)
- `@tailwindcss/typography` — markdown content renders with `prose prose-invert prose-sm` styling
- 19 new tests (1 ids + 7 helpers + 6 uninstall + 5 phase-migration)
- Plugin version bumped to 0.9.0

### Plan 12 — Distribution polish (shipped 2026-05-06)

- Asset-embedding generator (`scripts/embed-assets.ts`) — SPA shipped inside the binary
- `bun run build` chains build:web → embed → compile → produces a self-contained `dist/kadai` (~63MB)
- `scripts/build-all.sh` cross-compiles for darwin/linux/windows × x64/arm64 — all 5 targets working (60-112MB each)
- `scripts/install.sh` — curl install with OS/arch detection (template; configurable `INSTALL_URL`)
- `scripts/Formula/kadai.rb` — Homebrew formula template
- `package.json` — `files`, `engines.bun`, `keywords`, `pack:check` (81 files in tarball, no node_modules/tests)
- `scripts/smoke-binary.sh` — verifies the binary actually runs end-to-end (init/add/list/pick/serve + embedded SPA)
- `docs/wiki/installation.md` covers all 4 install paths
- 7 new tests (4 server-embedded + 3 install-script logic)
- Plugin version bumped to 0.8.0

### Plan 11 — Hook polish (shipped 2026-05-06)

- `kadai hook user-prompt-submit` — injects `[kadai-active-story]` block (id, title, phase, status, spec/plan/AC) into prompt context when a story is picked
- `kadai hook stop` — reminds via `{"reason":"..."}` when a turn ended with the picked story still in_progress + recent changelog activity (30-min window)
- `kadai init` now lays down all four hook entries (idempotent re-run)
- 16 new tests (7 user-prompt-submit + 7 stop + 2 init regression)
- Plugin version bumped to 0.7.0

### Plan 10 — Git integration (shipped 2026-05-06)

- `kadai sync [--since <ref>] [--branch <name>] [--dry-run]` — scrapes git log for item ID refs and appends to `changelog.md`
- `src/core/git.ts` — `listCommits()` shells out to `git log` with ASCII record separators
- `src/core/sync.ts` — `syncChangelogs()` + `extractIdRefs()`; idempotent via short-SHA dedup
- Auto-transition stories to `done` on `Merge pull request` commits when `auto_transitions.pr_merge_marks_story_done = true`
- 22 new tests (7 git + 12 sync + 3 CLI)
- Plugin version bumped to 0.6.0

### Plan 9 — Search (shipped 2026-05-06)

- `GET /api/search?q=...` returning `SearchResult[]` (id, kind, title, phase, status, matchType, snippet + match offsets)
- `src/core/search.ts` — `searchSpine()` + `makeSnippet()`; title matches sort before acceptance + body
- MCP `search` tool refactored to delegate to core (preserves `Item[]` return contract)
- SearchBox in the top bar; `/search?q=...` results page with `<mark>` highlighting
- 1 new Playwright E2E flow (8 total now)
- Plugin version bumped to 0.5.0

### Plan 8 — Live updates (SSE) (shipped 2026-05-06)

- `GET /api/events` — text/event-stream powered by an in-process EventBus
- `src/web/events.ts` — bus + scope inference + recursive fs.watch with per-scope debounce
- `src/web/server.ts` — owns watcher lifecycle, injects bus into handleApi
- `LiveUpdatesProvider` + `useLiveKey()` on the client; all 4 pages refetch on spine events
- 1 new Playwright E2E (status mutation → kanban column update without page.reload)
- All 7 E2E tests adapted from `networkidle` → `load` (SSE prevents networkidle from ever firing)
- Plugin version bumped to 0.4.0

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
