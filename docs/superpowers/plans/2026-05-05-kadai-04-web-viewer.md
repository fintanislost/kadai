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

**Plan(s) shipped:** Plans 1, 2, 3 — and the mid-build dogfood transition has happened (kadai is installed against this project).

**Specifically, these inputs:**

- All Plan 1 core modules (read-only access to spine)
- Plan 2's MCP server is irrelevant here — the web viewer reads files directly via the core modules; no MCP coupling
- Plan 3's `.kadai/.picked` is read for the active-story badge

## Outputs — what ships at the end of this plan

- `kadai serve` launches localhost UI; opens browser
- Roadmap home renders all epics across phases
- Story detail renders spec/plan/changelog/tasks tabs
- Static SPA bundled into the kadai binary (no runtime deps on Vite or node_modules)
- Playwright E2E tests pass for the listed views

## Spec sections covered

- §6 — entire web viewer section

## When to write this plan

After Plan 3 ships and kadai is installed against this project. **This plan is itself executed under kadai's own guardrails** — the agent writing it will need to `kadai pick <story-id>` first.

## Compaction recovery note

If a fresh Claude lands here:
1. Verify Plans 1–3 are `DONE` per [`README.md`](README.md).
2. Verify kadai is installed against this project (`.kadai/` exists with epics/features/stories — this is the mid-build dogfood state).
3. Read spec §6.
4. **You're now operating under kadai's own guardrails** — the PreToolUse hook will block edits unless you've picked a story. Run `kadai status` to see what's picked.
5. Run `/writing-plans` and reference this file.
