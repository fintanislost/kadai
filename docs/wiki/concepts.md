# Concepts

## The four levels

| Level | Purpose | Example | Lifespan |
|---|---|---|---|
| **Epic** | Major capability area | "Authentication" | Months |
| **Feature** | Discrete user-facing function | "User login" | Weeks |
| **Story** | Testable user value, fits ~1 PR | "User can log in with email" | Days |
| **Task** | Atomic dev work | "Add bcrypt hashing" | Hours |

All four levels are required: a task must have a parent story; a story must have a parent feature; a feature must have a parent epic. The MCP server rejects orphan creation.

For ad-hoc work that doesn't fit, the convention is an `EPIC-MISC` epic with a `FEAT-MISC` feature for loose stories.

## IDs

Format: prefix + zero-padded 3-digit counter, scoped per type. Counters live in `.kadai/.counters.json` (committed).

- `EPIC-001`, `EPIC-002`, `FEAT-001`, `STORY-042`, `TASK-003`
- IDs are **global per type** — `STORY-042` is unique across the whole spine, not per feature.
- Directory names embed both: `STORY-042-email-login` (id + slug).

## Phases

Phases are scope tiers. Defaults: `mvp`, `v1`, `future`, `parking-lot`. Configurable per project via `kadai phases` or by editing `.kadai/config.toml`.

Each epic, feature, and story has a `phase:` and an `order:` (sparse — 10, 20, 30 — so insertions don't require renumbering). Tasks inherit from their parent story.

The roadmap-primary web view (`kadai serve` → `/`) groups items by phase, ordered within each phase band.

### Phase migration

Phases live in `.kadai/config.toml` and are referenced by every epic / feature / story via the `phase:` frontmatter field. When you `kadai phases rename mvp v1 V1` or `kadai phases remove mvp --move-to v1`, kadai walks the spine and rewrites every affected item's frontmatter so no item is ever orphaned with a phase slug that no longer exists. Removing a phase that has items without `--move-to` is refused.

## State machine

```
backlog → ready → in_progress → done
                     │              ▲
                     ├── blocked ───┘
                     └── review (story-only) ──┘
backlog/ready/in_progress/blocked/review → cancelled
```

| State | Meaning |
|---|---|
| `backlog` | Exists but not yet specced/planned |
| `ready` | Has spec/plan, ready to be picked up |
| `in_progress` | Being worked |
| `blocked` | Stuck, needs human intervention |
| `review` | (story-only) tasks done, awaiting PR review/merge |
| `done` | Shipped |
| `cancelled` | Explicitly killed (with reason) |

All transitions are validated by the state machine. Illegal transitions (e.g., `ready → done`) are rejected with a clear error.

## Picked vs status

These are **orthogonal**:

- **Status** is the state machine value on the item (e.g., `in_progress`).
- **Picked** is a project-wide flag for "this is the story I'm currently editing code against." At most one story is picked at a time. The picked story is what the change-capture hook writes against.

`kadai pick <id>` does both: sets picked AND transitions status to `in_progress`. `kadai unpick` clears picked but does NOT change status — useful when you want to step away from a story without "un-starting" it.

## The guardrail

The `PreToolUse(Edit, Write)` hook is the teeth: any `Edit` or `Write` to a path outside `.kadai/` and the configured allowlist is **blocked when no story is picked**. The agent can either:

1. Pick a story (`kadai pick STORY-XXX`) — preferred
2. Add the path to `[guardrail.allowed_paths]` in `.kadai/config.toml`
3. Bypass for one session (`KADAI_BYPASS=1` env var; logged to `.kadai/bypass.log`)

### Hook touchpoints

Kadai integrates with Claude Code through four hook events, all dispatched through the `kadai hook <subcommand>` CLI:

- **`PreToolUse`** (Edit | Write) — blocks edits outside the spine when no story is picked.
- **`PostToolUse`** (Edit | Write) — captures every edit into the picked story's `changelog.md`.
- **`UserPromptSubmit`** — injects active-story context (id, title, status, attached spec/plan, acceptance criteria) into every prompt while a story is picked.
- **`Stop`** — reminds the agent to update status when a turn ended with the story still `in_progress` and recent changelog activity.

The first two are gating / capture (always-on while change_capture is enabled). The latter two are observability — they shape what Claude sees but never block work. All are registered automatically by `kadai init` in `.claude/settings.json`.

## Spec → feature, plan → story

Kadai is also an **archive**. When you run `/brainstorming` (writes a spec) or `/writing-plans` (writes a plan):

- `kadai.attach_spec(feature_id, source_path)` — moves the spec into the feature's directory as `spec.md`
- `kadai.attach_plan(story_id, source_path)` — moves the plan into the story's directory as `plan.md`

Each story directory ends up with: `story.md` + `spec.md` (inherited from feature) + `plan.md` + `changelog.md` (auto-built) + `tasks/`. That's the full intent → approach → execution trail.

## Storage layout (single source of truth)

```
.kadai/
├── config.toml
├── .counters.json
├── README.md
└── epics/
    └── EPIC-001-auth/
        ├── epic.md
        └── features/
            └── FEAT-001-login/
                ├── feature.md
                ├── spec.md
                └── stories/
                    └── STORY-042-email-login/
                        ├── story.md
                        ├── plan.md
                        ├── changelog.md
                        └── tasks/
                            ├── TASK-001-bcrypt.md
                            └── TASK-002-form-to-api.md
```

Markdown with YAML frontmatter. Read with `cat`, diff with `git`, edit with any editor — but use `kadai add` for new items so the schema and ID counter stay correct.

### Changelog dual-source

Each story's `changelog.md` is appended to from two sources:

- **PostToolUse hook** — every `Edit`/`Write` while a story is picked. Format: `` `- 2026-05-06T... `Write` src/foo.md` ``
- **`kadai sync`** — git commits whose message references the item's ID. Format: `` `- 2026-05-06T... `commit` <sha7> <subject>` ``

The shapes are distinct on purpose so a single `changelog.md` can mix both without confusion. `kadai sync` dedups by short SHA, so re-running is safe.

### Markdown-only mode

`kadai init --markdown-only` creates the spine (`/.kadai/`) without installing the integration touch-points: no kadai entry in `.mcp.json`, no hooks in `.claude/settings.json`, no `## Kadai` section in `CLAUDE.md`. The CLI, web viewer, and `record_change` MCP tool still work; the agent guardrails (PreToolUse blocking, PostToolUse changelog capture) just don't fire because they aren't installed. Useful for human-only spine tracking or pre-staging a project for evaluation.

### record_change

The MCP `record_change(message)` tool appends a `note`-shaped line to the picked story's `changelog.md`. Three sources can write to a changelog, each with a distinct line shape:

- `` `Write` <path> `` — PostToolUse hook
- `` `commit` <sha> <subject> `` — `kadai sync`
- `` `note` <free text> `` — MCP `record_change`

The Activity page (`/activity` in the web viewer) renders all three uniformly with kind badges.

### Multi-project mode

`kadai serve` operates in one of two modes, decided at startup based on the `~/.kadai/known-projects.json` registry:

- **Single-project mode** (registry empty or missing): the server uses `process.cwd()` as the only project. URLs are `/epics/...`, `/api/...` — unchanged from earlier kadai versions.
- **Multi-project mode** (registry has ≥1 entry): the server tracks each project independently — separate `EventBus`, separate filesystem watcher, independent SSE channel. URLs are `/p/<slug>/...`, `/api/p/<slug>/...`. The picker at `/projects` lists registered projects.

Switch modes by running `kadai serve register [path]` to enter multi-project mode, or `--single` flag to force single-project mode regardless of registry contents.

## The runner state model

When you use `/kadai-run` (or inspect with `kadai run --status`), state is persisted at `.kadai/runner.json` so the runner survives crashes and session boundaries. The `--resume` flag lives in the `/kadai-run` slash command, not the CLI — the CLI's `kadai run` is informational only.

Statuses:

| Status | Meaning |
|---|---|
| `idle` | No run in flight (default). |
| `running` | Actively executing a story. |
| `paused-blocked` | Implementer reported a blocker that requires manual resolution. |
| `paused-needs-feature` | Implementer reported the work needs a fast-follow-up feature; user prompted to plan it. |
| `paused-review` | Story finished, awaiting user confirmation to advance. |
| `error` | Last invocation crashed unrecoverably. |

Transitions are explicit; the runner never silently advances past a `paused-*` state. Each state change is written to `.kadai/runner.json` before the next action begins, so a crash mid-run leaves the state file in the last-known-good state.

## The dependency edge (`dependsOn`)

When a story enters the fast-follow-up flow (the implementer reports "this needs a new feature to unblock it"), the runner records a `dependsOn: [FEAT-XXX]` field on the blocked story's frontmatter. This is the durable record of "STORY-007 was paused because it needed FEAT-009" — it survives runner crashes, is visible to `kadai status`, the web viewer, and human readers of the spine.

The runner queues blocked stories on a `pausedStack`; when the unblocker feature's stories finish, the top of the stack is resumed automatically. If multiple stories are waiting in the stack (nested fast-follow-up chains), they are resumed in LIFO order.

## Test tiers

Kadai's tests live in three tiers, deliberately gated to balance signal vs cost:

| Tier | What it runs | Cost | Frequency |
|---|---|---|---|
| **1 — Unit** (`bun test`) | Pure logic, mocked LLM, in-process | Free | Every PR |
| **2 — Cassette** (`bun test tests/cassette/`) | Captured `claude -p` runs replayed against the kadai CLI; no model calls | Free | Every PR |
| **3 — Real e2e** (`RUN_DOGFOOD_E2E=1 bun test tests/dogfood/`) | Live `claude -p` against a fresh kadai project | $$ + 5–10min | Pre-release / nightly |

Tier 2 is the cassette pattern — recorded sequences of `kadai` CLI invocations + a serialized `.kadai/` snapshot. The replay verifies that current code, given the same call sequence, produces the same final spine state. It catches schema regressions, plumbing bugs, and any code change that breaks the wrapper's spine writes — without needing to call Claude.

**To re-record a cassette** (after intentional behavior changes):

```
rm -rf tests/cassettes/<name>
bun scripts/record-cassette.ts <name> "<prompt>"
git add tests/cassettes/<name>
git commit
```

Tier 3 (real e2e) is the canary for skill-matching drift — Claude shipping a model update that stops loading the wrapper skill. Treat it as a periodic check, not a PR gate.
