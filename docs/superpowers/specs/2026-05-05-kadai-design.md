# Kadai — Design

**Status:** Draft (brainstormed 2026-05-05)
**Author:** Fintan + Claude (brainstorming session)
**Topic:** Local-first product spine for projects driven by agentic coding

---

## 1. Goals & shape

Kadai is a local-first, files-first product spine for projects whose code is written largely by agents. It does three things:

1. **Source of truth** — a hierarchical, version-controlled record of *what the product should do*, sliced into MVP / v1 / future phases. Lives as markdown in `.kadai/` inside each project repo.
2. **Archive** — generated specs (from `/brainstorming`) and plans (from `/writing-plans`) are filed into the spine and linked to the feature/story they describe. Every story carries its own paper trail: spec (intent) → plan (approach) → changelog (changes).
3. **Guardrails** — agents read/write the spine through a typed MCP interface, hooks block off-spine work, and a bundled skill teaches agents the conventions. Agents can't invent work that doesn't map to a story.

A single binary (`kadai`) provides the CLI, MCP server, and web viewer. `kadai serve` opens the **roadmap-primary** visualization on localhost.

### Audience & distribution
- Personal tool first (solo workflow)
- Built clean enough to install on other machines or be adopted by others if interesting
- No auth, no SaaS, no multi-user sync — local files + git only

---

## 2. Data model & storage layout

### File tree

```
.kadai/
├── config.toml                          # phases, auto-transition flags, hook settings
├── README.md                            # human-readable index of the spine (auto-regenerated)
├── .gitignore                           # ignores .index.json
├── .index.json                          # MCP-managed cache of all items (rebuildable)
└── epics/
    └── EPIC-001-auth/
        ├── epic.md                      # frontmatter + description
        └── features/
            └── FEAT-001-login/
                ├── feature.md
                ├── spec.md              # archived from /brainstorming output
                └── stories/
                    └── STORY-042-email-login/
                        ├── story.md
                        ├── plan.md      # archived from /writing-plans output
                        ├── changelog.md # auto-built: edits + commits + PRs
                        └── tasks/
                            ├── TASK-001-bcrypt-hashing.md
                            └── TASK-002-form-to-api.md
```

### Hierarchy semantics

| Level | Purpose | Example | Lifespan |
|---|---|---|---|
| **Epic** | Major capability area | "Authentication" | Months |
| **Feature** | Discrete user-facing function | "User login", "Password reset" | Weeks |
| **Story** | Testable user value, fits ~1 PR | "User can log in with email + password" | Days |
| **Task** | Atomic dev work | "Add bcrypt hashing" | Hours |

### Strictness

All four levels are required for everything. A task must have a parent story; a story must have a parent feature; a feature must have a parent epic. The MCP server rejects orphan creation.

For ad-hoc work that doesn't fit cleanly, the convention is an `EPIC-MISC` epic with a `FEAT-MISC` feature for the loose stories. Explicit, not implicit.

### ID scheme

Prefix + zero-padded 3-digit counter, scoped per type:
- `EPIC-001`, `FEAT-001`, `STORY-001`, `TASK-001`
- Counters are global per type — `STORY-042` is unique across the entire spine, not per-feature
- Directory names embed both: `STORY-042-email-login` (id + slug). ID is canonical; slug is for humans skimming `ls`.

### Frontmatter — story.md (representative example)

```yaml
---
id: STORY-042
parent: FEAT-001
title: User can log in with email and password
phase: mvp
order: 10
status: in_progress
spec: ../../spec.md          # inherited from parent feature
plan: plan.md                # set when /writing-plans completes and is attached
acceptance_criteria:
  - Form submits email+password to /api/login
  - Success redirects to /dashboard
  - Failure shows inline error
created: 2026-05-05
updated: 2026-05-05
---

## Description
...

## Notes
...
```

Other levels follow the same shape with appropriate fields:
- **epic.md** — no `parent`; outcomes list instead of acceptance criteria
- **feature.md** — `parent` is epic id; `spec` field set when spec attached
- **task.md** — `parent` is story id; `plan_step` field references the plan step it implements; no phase/order (inherited from story)

### Sparse ordering

`order:` uses sparse defaults (10, 20, 30, …) so insertions don't require renumbering. New items are inserted at midpoints (15, 25). When midpoints get tight, kadai re-densifies the band on the next write.

---

## 3. Phase / scope model

Items at epic, feature, and story levels carry `phase:` and `order:` fields. Tasks inherit from their parent story.

### Default phases (configurable per project)

| Phase | Meaning |
|---|---|
| `mvp` | Must ship for the product to launch |
| `v1` | First post-MVP release |
| `future` | Wanted; no commitment yet |
| `parking-lot` | Considered and explicitly deferred |

Phases are configured in `.kadai/config.toml`:

```toml
[[phases]]
slug = "mvp"
display = "MVP"
color = "#22c55e"

[[phases]]
slug = "v1"
display = "v1.0"
color = "#3b82f6"

# ... etc
```

Adding/removing/renaming phases is a config edit + items in deleted phases are flagged for reassignment.

### Path allowlist & change capture toggle (other config)

```toml
[guardrail]
# Paths outside .kadai/ where edits are allowed without a picked story
allowed_paths = ["docs/", "scripts/", "README.md", ".gitignore"]

[change_capture]
enabled = true   # if false, the PostToolUse hook becomes a no-op
```

### Within-phase ordering

`order:` is an integer; lower = earlier. The roadmap view sorts items within each phase band by `order:`. Reordering = editing `order:` values (sparse, see above).

---

## 4. State machine & transitions

```
backlog ───► ready ───► in_progress ───► done
                │            │              ▲
                │            ├── blocked ───┘
                │            └── review (story-only) ──┘
                └────────► cancelled
```

| State | Meaning |
|---|---|
| `backlog` | Exists but not yet specced/planned |
| `ready` | Has spec (feature) or plan (story); ready to be picked up |
| `in_progress` | Actively being worked |
| `blocked` | Stuck, needs human intervention |
| `review` | (story only) Tasks done, awaiting PR review/merge |
| `done` | Shipped/merged |
| `cancelled` | Explicitly killed (with required reason) |

### Default behavior: manual transitions

All transitions are triggered by an explicit `kadai.set_status(id, status, reason?)` MCP call. The MCP server validates the transition is legal (graph edge exists, required artifacts present, etc.) and rejects illegal ones with a clear message.

### Auto-transitions (off by default, opt-in via config)

```toml
[auto_transitions]
spec_attached_marks_ready = false
plan_attached_marks_ready = false
plan_step_completion_marks_task_done = false
all_tasks_done_marks_story_review = false
pr_merge_marks_story_done = false
```

Each flag enables one specific automation. Users can crank up automation as confidence grows.

### Picking vs. status

These are orthogonal:
- **Status** is the state machine value on the item (e.g., `in_progress`). Mutated only via `kadai.set_status(...)`.
- **Picked** is a project-wide flag for "this is the story I'm currently editing code for" — at most one story is picked at a time. Mutated via `kadai.pick_story(id)` / `kadai.unpick()`. The picked story is what the change-capture hook writes against.

Typically you do both at once. The `/kadai-pick` slash command sets the story as picked **and** calls `set_status(in_progress)`. The underlying MCP tools are separate so you can pick without changing state (e.g., to record a quick changelog entry on a story already done).

### Change capture (changelog.md)

Auto-by-default (toggleable via `change_capture.enabled` in config). When a story is picked, the `PostToolUse(Edit, Write)` hook appends entries to that story's `changelog.md` with timestamp, file paths, and a one-line summary. Git commits referencing the story ID get scraped in too via `kadai sync`.

---

## 5. Agent integration

Four collaborating mechanisms keep agents honest to the spine.

### 5.1 MCP server

Spawned by Claude Code via `.mcp.json` (`kadai mcp` runs the stdio server). Tool surface:

```
# Reads
kadai.list_phases()
kadai.list_epics(phase?, status?)
kadai.list_features(epic_id?, phase?, status?)
kadai.list_stories(feature_id?, phase?, status?)
kadai.list_tasks(story_id?, status?)
kadai.get(id)                              # any-level fetch
kadai.get_active_story()                   # what's currently picked
kadai.search(query)                        # full-text across spine

# Writes — all validated against schema + state machine
kadai.create_epic(title, phase, order, description)
kadai.create_feature(parent_epic, ...)
kadai.create_story(parent_feature, acceptance_criteria, ...)
kadai.create_task(parent_story, plan_step?, ...)
kadai.set_status(id, status, reason?)
kadai.set_phase(id, phase, order?)
kadai.attach_spec(feature_id, source_path)   # moves spec into .kadai/, sets frontmatter
kadai.attach_plan(story_id, source_path)     # moves plan into .kadai/, sets frontmatter
kadai.pick_story(story_id)
kadai.unpick()
kadai.record_change(story_id, files, summary, commit?)  # also called by hooks

# Sync
kadai.sync_git()                           # scrape commits/PRs, update changelogs
```

### 5.2 Hooks (installed into `.claude/settings.json` by `kadai init`)

| Hook | What it does | Default |
|---|---|---|
| `PreToolUse(Edit, Write)` | Blocks edits outside `.kadai/` and the `[guardrail.allowed_paths]` allowlist in config (e.g., `docs/`) unless a story is picked | **on** — the core guardrail |
| `PostToolUse(Edit, Write)` | If a story is picked, appends edit summary to its `changelog.md` | on (toggleable) |
| `UserPromptSubmit` | If story is picked, injects "Active: STORY-042 — title. Spec: …. Plan step: …" | on |
| `Stop` | If story picked and turn ended without status update, reminds | on |

The `PreToolUse` block is the teeth. Agents physically can't edit code without first checking out a story. To start something new, they either (a) pick an existing story or (b) create one via `kadai.create_*`. Both routes go through the spine.

Bypass: setting `KADAI_BYPASS=1` in the Claude Code session's environment disables the block for that session — every bypassed edit is appended to `.kadai/bypass.log` (path, timestamp, reason if provided via `KADAI_BYPASS_REASON`).

### 5.3 Bundled `kadai` skill

Auto-triggers on planning/scoping language (*plan, implement, build, design, story, feature, epic, scope, MVP*).

Skill description teaches Claude:

> "This project uses kadai for the product spine. Before planning, check `kadai.get_active_story()` — if none, list ready stories and ask the user to pick. Spec → feature, plan → story. Tasks come from plan steps and are created via `kadai.create_task(parent_story=…, plan_step=…)`. After completing work, call `kadai.set_status(…)`."

### 5.4 Slash commands

- `/kadai-pick <story-id>` — picks the story (sets active for change capture) **and** transitions its status to `in_progress`
- `/kadai-status` — print active story + queue + recent changelog
- `/kadai-sync` — git scrape + state reconciliation
- `/kadai-add <type>` — guided creation flow

### 5.5 Thin CLAUDE.md addition

`kadai init` appends:

```markdown
## Kadai
This project uses kadai for product/feature/story tracking (spine in `.kadai/`).
Use the `kadai` MCP tools — don't edit `.kadai/` files directly.
Run `kadai serve` for the visual roadmap.
```

---

## 6. Web viewer

`kadai serve` starts the Bun HTTP server and opens the React SPA at `localhost:<port>`. Everything served from the single binary; no separate frontend deployment.

### Routes

| Route | View |
|---|---|
| `/` | **Roadmap (home)** — phase swim lanes, ordered items as cards with progress bars |
| `/phases/:phase` | Same layout, filtered to one phase |
| `/epics/:id` | Epic detail — its features in a sub-roadmap |
| `/features/:id` | Feature detail — kanban of stories (columns = states) + spec preview |
| `/stories/:id` | **Story detail** — spec / plan / changelog / tasks (tabs) |
| `/search?q=…` | Full-text results across spine |
| `/settings` | Phase config, auto-transition flags, hook toggles |

### Roadmap home (default view)

- Phase bands stacked vertically: `MVP`, `v1`, `future`, `parking-lot` (collapsible)
- Within each band: epics rendered as wide cards with embedded feature progress dots, ordered by `order:`
- Each epic card shows: title, % done, status pill, count of in-progress/blocked items
- Click an epic → `/epics/:id`. Hover → tooltip with description.
- Top bar: phase filter chips, search, **active story badge** (always visible)

### Story detail (workhorse view)

- Header: title, status, parent breadcrumb (Epic → Feature → Story), phase pill
- Left pane: **task checklist** — checkboxes for each task with state, click to expand
- Center: **tabs**
  - `Spec` — rendered markdown of `spec.md` (inherited from feature)
  - `Plan` — rendered markdown of `plan.md`
  - `Changelog` — chronological list: edits, commits (with diff stats), PR links
  - `Story` — story.md content (description, acceptance criteria)
- Right rail: status changer, phase changer, "pick this story" button, links to spec/plan source files

### Feature detail

- Top: spec preview (collapsible)
- Body: kanban columns (`backlog | ready | in_progress | blocked | review | done`), story cards drag-droppable to change state (calls MCP `set_status`)
- Cards show: title, task progress, who picked it (if checked out)

### Live updates

- `/api/events` SSE endpoint
- Filesystem watcher on `.kadai/` triggers reload events
- React app re-fetches affected data — no manual refresh

### Styling

Tailwind, dark-mode-default, mono-leaning typography for IDs and code, generous whitespace. **No D3** — roadmap and kanban are CSS grid + flex.

---

## 7. CLI surface

```
kadai init                    # bootstrap a project
kadai mcp                     # MCP server (stdio); spawned by Claude Code
kadai serve [--port N]        # web viewer + HTTP API; opens browser
kadai status                  # quick terminal status
kadai add <type>              # interactive create (epic|feature|story|task)
kadai list <type> [--phase] [--status] [--parent]
kadai pick <story-id>
kadai unpick
kadai sync                    # scrape git, update changelogs
kadai phases                  # list/edit phase config
kadai config [key] [=value]
kadai uninstall               # removes hooks/MCP/CLAUDE.md section; leaves .kadai/ data
```

The MCP server (`kadai mcp`) and web viewer (`kadai serve`) are **separate processes** — they don't share memory. The filesystem (`.kadai/`) is the coordination point; both processes use atomic writes (`rename(2)`) and a filesystem watcher to react to each other's changes. You can run the web viewer alongside any number of agent sessions safely.

---

## 8. Bootstrapping (`kadai init`)

| File | Action |
|---|---|
| `.kadai/config.toml` | Created with default phases and all auto-transition flags = `false` |
| `.kadai/README.md` | Created — human-readable index, regenerated on each spine change |
| `.kadai/.gitignore` | Created — ignores `.index.json` |
| `.kadai/epics/` | Empty directory created |
| `.claude/settings.json` | Hooks added (PreToolUse/PostToolUse Edit+Write, UserPromptSubmit, Stop) — **merged**, not overwritten |
| `.mcp.json` | Adds `"kadai": { "command": "kadai", "args": ["mcp"] }` — merged |
| `CLAUDE.md` | Appends thin kadai section — created if missing |

After file changes, runs interactive wizard:
1. *"What's the product you're tracking?"* — one-liner → `.kadai/README.md`
2. *"Want to create your first epic now? (Y/n)"* → `kadai add epic` flow
3. *"Open the web viewer? (Y/n)"* → starts `kadai serve` and opens browser

Re-running `kadai init` does a **safe sync**: re-installs missing hooks, re-registers MCP, fixes drift in CLAUDE.md, never deletes existing items or config.

---

## 9. Tech stack

- **Language:** TypeScript
- **Runtime:** Bun (HTTP server, bundling, single-executable compilation)
- **MCP SDK:** `@modelcontextprotocol/sdk` (TypeScript)
- **Frontend:** Vite + React + TypeScript
- **Routing:** TanStack Router
- **Styling:** Tailwind CSS (v4 if stable enough; v3 fallback)
- **Markdown rendering:** `unified` + `remark` + `rehype` for `spec.md`/`plan.md`/`story.md` content in the viewer
- **Frontmatter:** YAML via `gray-matter`
- **Filesystem watcher:** `chokidar`
- **Testing:** Bun's built-in test runner + Playwright for E2E

Single language across MCP server, web backend, CLI, and frontend.

---

## 10. Testing

### Conventional testing layers
- **Unit tests** — schema validation, state machine transitions, frontmatter parse/serialize, ID generation, sparse ordering, slug generation, atomic write helpers. Pure logic; lots of cases.
- **Integration tests** — MCP tool surface end-to-end (each tool, happy + error cases), hook behaviors, git sync. Tests use temp dirs as the spine root via a `withTempSpine()` fixture helper.
- **E2E tests with Playwright** — web viewer flows (roadmap renders, drill into story, status change reflects in MCP, live update over SSE).
- **Test fixture helper** — `buildSampleSpine({ epics, features, stories, tasks })` for exercising views and tools.

### Dogfood / agent acceptance testing (primary acceptance test)

The strongest acceptance test for kadai is whether agents stay honest to it. We dogfood **via subagents in isolated working directories** within this build session — the kadai project repo itself stays clean of `.kadai/`, hooks, and MCP registration until Plan 5.

**Approach:**

For Plans 3 and 4, integration tests spawn fresh subagents (via the Agent tool) or use temp-dir fixtures where kadai is initialized and exercised. The agent-facing parts (hooks, MCP) are verified against these isolated environments — we get the same observation power without polluting the kadai repo with self-tracking state.

For **Plan 5** (the formal subagent acceptance test), we spawn a fresh subagent and assign it a kadai-managed story in a working directory where kadai has been freshly initialized. We observe whether the subagent stays within the guardrails. Optionally, Plan 5 also wraps by installing kadai against the kadai repo itself, so post-MVP work (the items in §13) is tracked in kadai going forward.

**Subagent acceptance test:**

Spawn a fresh subagent (via the Agent tool) in a working directory where kadai is initialized. Assign it a kadai-managed story (e.g., "STORY-N: implement the SSE endpoint for live updates"). Observe in sequence:

1. Subagent calls `kadai.get_active_story()` or `kadai.list_stories(status="ready")` before planning — *driven by the bundled skill's auto-trigger.*
2. `PreToolUse` hook blocks the subagent's first `Edit`/`Write` because nothing is picked — *the guardrail fires.*
3. Subagent picks the story via `kadai.pick_story(...)` and `kadai.set_status(..., "in_progress")` and proceeds — *recovers correctly from the block.*
4. `PostToolUse` hook captures each edit into the story's `changelog.md` — *change capture works.*
5. Subagent calls `kadai.set_status(..., "review")` after task completion — *the skill's exit-flow guidance lands.*
6. The web viewer (running in our terminal session) reflects the status change live — *cross-process coordination works.*

If any step fails, the failure point reveals what to fix in kadai's guardrails, MCP surface, skill description, or hook configuration. This test acts as the true integration validation for the agent-facing parts of the system — the parts that conventional unit/integration tests cannot exercise.

**This is the gating test for declaring kadai's MVP "done."** Conventional tests verify code correctness; the subagent acceptance test verifies the *product works as designed* against the audience it's built for.

---

## 11. Distribution

- `bun build --compile` produces single executables for `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`
- Primary: **GitHub releases** (binaries) + **npm package** (`npm i -g kadai`)
- Curl install script (`curl … | sh`) — fetches latest release binary for platform, drops in `~/.local/bin/`
- Brew formula deferred (post-MVP)

---

## 12. Build sequencing — Kadai's own MVP

The slice we'd build first; everything else is post-MVP.

1. **Core data layer** — types, frontmatter parse/write, file reader/writer, ID gen, schema validation, state machine. Pure logic, fully unit-tested.
2. **CLI scaffold** — `init`, `add`, `list`, `status`, `pick`, `unpick`, `phases`. Manual smoke-testable.
3. **MCP server** — `kadai mcp` exposes read tools + create tools + `set_status` + `pick_story` + `attach_spec/plan`. Skip `record_change` and `sync_git` for MVP.
4. **Core hooks** — `PreToolUse(Edit, Write)` (the guardrail) and `PostToolUse(Edit, Write)` (changelog capture). Skip `UserPromptSubmit` and `Stop` for MVP.
5. **Read-only web viewer** — Bun HTTP + React SPA, roadmap home + epic/feature/story detail. No drag-drop, no status mutations from UI. Status changes via CLI/MCP/agent.
6. **Bundled skill + minimal slash commands** — `/kadai-pick`, `/kadai-status`. Skill description tuned for triggering on planning language.
7. **Dogfood validation** — spawn a fresh subagent in a working directory where kadai has been freshly initialized (with the post-MVP backlog from §13 seeded as the spine), then run the subagent acceptance test (Section 10). MVP is "done" only after the subagent test passes end-to-end. As an optional final wrap, install kadai against the kadai repo itself so post-MVP work is self-tracked going forward.

> **Note on testing approach.** Throughout Plans 3, 4, and 5, kadai's behavior is verified via subagents and temp-dir fixtures — the kadai project repo itself stays clean of `.kadai/`, hooks, and MCP registration until step 7 (and even then, only optionally). This keeps the build environment uncluttered and ensures the dogfood test exercises a fresh-install path.

---

## 13. Post-MVP backlog

These are the items deferred from MVP. **First action after kadai's own MVP ships: create kadai items for these in the kadai spine itself, under a `kadai-self` epic.** This is the dogfood loop.

### Web viewer
- **Interactive web viewer** — status changes from UI (right-rail mutations), drag-drop kanban, attach spec/plan from UI
- **Live updates via SSE** — filesystem watcher → SSE → React invalidation
- **Search across spine** — full-text search bar + `/search` route
- **Settings page** — phase config editor, auto-transition flag toggles, hook toggles

### Git integration
- **`kadai sync`** — git log scraping, commit→story attribution (commits with `STORY-042` in message), PR→story attribution
- **PR merge → story done auto-transition** (when flag enabled)

### Hooks
- **`UserPromptSubmit` hook** — context injection of active story snippet
- **`Stop` hook** — reminder to update status when turn ends with story picked

### Slash commands
- **`/kadai-add <type>`** — guided creation flow
- **`/kadai-sync`** — git scrape + state reconciliation
- **`/kadai-unpick`**

### Polish & infrastructure
- **Brew formula**
- **Curl install script**
- **`.index.json` rebuild command** (`kadai reindex`)
- **`kadai uninstall`** (in MVP CLI list but implementation deferred)
- **Phase config migration** when phases renamed/removed (flag affected items for reassignment)
- **Re-densification logic** for sparse ordering when midpoints get tight

### Stretch / explorations
- **Per-phase comparison view** in web viewer (side-by-side scope diffing)
- **Activity feed** (global stream of changes across all epics)
- **Multi-project switcher** in web viewer (browse multiple kadai-managed projects)
- **Markdown-only mode** (run kadai without MCP/hooks for users who just want the file format and viewer)

---

## 14. Open detail decisions

To resolve during planning/implementation:

- **`record_change` exposure**: hook-only, or also user-callable as a CLI/MCP tool? (Lean: also user-callable — useful for manual annotations)
- **Tailwind v4 vs v3**: depends on stability at build time
- **Vite vs Bun-only frontend bundling**: Bun's built-in bundler may suffice; Vite gives better dev DX. (Lean: Vite for dev, Bun-compiled for production)
- **Bundled plugin distribution**: published to `claude-plugins-official`, or hosted in the kadai repo? (Lean: hosted in kadai repo for v1; submit upstream later)

---

## 15. Out of scope

- Multi-user collaboration / sync (no SaaS, no auth, no shared cloud DB)
- Real-time collaborative editing of items
- Time tracking, sprint planning, velocity charts (not the audience)
- Issue triage workflows (kadai is the spec spine, not a bug tracker)
- Cross-project rollups / portfolio views (post-MVP "multi-project switcher" is the closest)
- Email/Slack/notification integrations
- Custom field types beyond what frontmatter naturally supports
