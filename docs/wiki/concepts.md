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
