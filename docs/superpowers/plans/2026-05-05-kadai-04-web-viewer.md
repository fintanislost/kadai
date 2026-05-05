# Plan 4 — Web viewer (read-only)

> **Status:** STUB — implementation plan not yet written.
> **To draft this plan:** run `/writing-plans` against this file (after Plan 3 has shipped).

## Position in the build

| | |
|---|---|
| **This is plan** | 4 of 5 |
| **Prior plan** | [Plan 3 — Hooks (guardrails)](2026-05-05-kadai-03-hooks.md) — must be `DONE` |
| **Next plan** | [Plan 5 — Plugin + dogfood](2026-05-05-kadai-05-plugin-and-dogfood.md) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) |

## Goal

Implement `kadai serve` — a Bun HTTP server + React SPA at localhost that renders the spine in the roadmap-primary view, with drill-down detail views.

## Scope

- Bun HTTP server in-process with the kadai binary
- React SPA built with Vite + TypeScript + Tailwind + TanStack Router, bundled into the binary as static assets
- Routes:
  - `/` — roadmap home (phase swim lanes, ordered epic cards with progress)
  - `/phases/:phase` — same layout, filtered to one phase
  - `/epics/:id` — epic detail with sub-roadmap of features
  - `/features/:id` — feature detail with kanban of stories + spec preview
  - `/stories/:id` — story detail with spec/plan/changelog/tasks tabs
- Read-only: no mutations from UI in this plan (status changes happen via CLI/MCP/agent only)
- Markdown rendering for `story.md`, `spec.md`, `plan.md` content via `unified` + `remark` + `rehype`
- Top bar: phase filter chips, search box (placeholder, no impl), active story badge
- Auto-open browser on `kadai serve`
- Tests: Playwright E2E for roadmap render, drill-into-story, breadcrumb navigation

## Out of scope (deferred)

- SSE live updates — post-MVP
- Search across spine (text input wired but no impl) — post-MVP
- Settings page — post-MVP
- Interactive mutations from UI (drag-drop kanban, status changers, attach UI) — post-MVP

## Dependencies — what must exist before writing this plan

**Plan(s) shipped:** Plans 1, 2, 3.

**Specifically, these inputs:**

- All Plan 1 core modules (read-only access to spine)
- Plan 2's MCP server is irrelevant here — the web viewer reads files directly via the core modules; no MCP coupling
- Plan 3's `.kadai/.picked` is read for the active-story badge

**Note:** kadai is NOT yet installed against the kadai repo (that happens optionally in Plan 5). Web viewer testing uses temp-dir spines (created via `runInit({ rootDir: tmp, ... })`) — same pattern as Plan 1's CLI integration tests.

## Outputs — what ships at the end of this plan

- `kadai serve` launches localhost UI; opens browser
- Roadmap home renders all epics across phases
- Story detail renders spec/plan/changelog/tasks tabs
- Static SPA bundled into the kadai binary (no runtime deps on Vite or node_modules)
- Playwright E2E tests pass for the listed views

## Spec sections covered

- §6 — entire web viewer section

## When to write this plan

After Plan 3 ships. The kadai repo is still uninstalled at this stage — testing uses temp-dir spines (Playwright launches `kadai serve` against a temp project where `runInit` has been called).

## Compaction recovery note

If a fresh Claude lands here:
1. Verify Plans 1–3 are `DONE` per [`README.md`](README.md).
2. Confirm `.kadai/` does NOT exist in the kadai repo (it shouldn't — install only happens in Plan 5).
3. Read spec §6.
4. Run `/writing-plans` and reference this file. Web viewer tests should follow the existing temp-dir pattern from Plan 1's CLI tests.
