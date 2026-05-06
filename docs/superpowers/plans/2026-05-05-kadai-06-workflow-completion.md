# Kadai Plan 6 — Workflow completion (CLI + plugin parity)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the immediate UX gaps surfaced during real use — add the missing CLI command for arbitrary status mutations, make `kadai init -y` actually useful, and round out the slash-command family with the three the plugin is missing.

**Architecture:** Pure additions on top of Plan 1 (core data layer + CLI), Plan 2 (MCP), and Plan 5 (plugin). One new CLI command (`set-status`) wraps the existing `setStatus` core operation. Three new slash commands wrap existing MCP tools (with CLI fallback). One small CLI behavior change (`init -y` → creates a default epic). No new dependencies, no schema changes, no migrations.

**Tech Stack:** TypeScript on Bun (existing). Same tools as MVP — commander, picocolors, prompts. Tests via `bun test` for CLI changes; plugin/skill changes verified by the bundled `kadai-dogfood-test` skill (Path A automated dogfood).

## Position in the build

| | |
|---|---|
| **This is plan** | 6 of N (first post-MVP plan) |
| **Prior plan** | [Plan 5 — Plugin + dogfood](2026-05-05-kadai-05-plugin-and-dogfood.md) — `DONE` (MVP complete) |
| **Next plan** | Plan 7 — Web viewer interactivity (per [post-MVP.md](../../wiki/post-mvp.md)) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- **`kadai set-status <id> <status> [--reason <text>]`** — arbitrary status mutations from the CLI. Closes the Path A test gap.
- **`kadai init -y` creates EPIC-001 "Project setup"** — `--yes` no longer leaves an empty spine.
- **`/kadai-add <kind>`** — slash command for guided creation (uses MCP `create_*` tools with prompts for missing fields).
- **`/kadai-set-status STORY-001 review`** — slash companion to the new CLI command.
- **`/kadai-unpick`** — slash companion to `kadai unpick`.
- **`kadai-plugin` version bumped to `0.2.0`** (so `/plugin update` triggers refresh on existing installs).
- **Dogfood verification:** the bundled `kadai-dogfood-test` skill runs against this build's binary + plugin and the 6-point checklist from spec §10 lands ≥ 5/6 (point 6 still optional).
- All ~177 existing tests still pass; no regression.

## Out of scope (deferred to later plans per [post-mvp.md](../../wiki/post-mvp.md))

- Web viewer interactivity — Plan 7
- SSE live updates — Plan 8
- Search — Plan 9
- Git integration (`kadai sync`) — Plan 10
- `UserPromptSubmit` and `Stop` hooks — Plan 11
- Distribution polish (compile, brew, npm, curl) — Plan 12
- Technical debt — Plan 13

## File structure

```
src/cli/
└── set-status.ts                          # NEW — runSetStatus + setStatusCommand

src/cli/init.ts (modified)                 # action handler: --yes creates default epic
src/cli/index.ts (modified)                # register setStatusCommand

tests/cli/set-status.test.ts               # NEW — runSetStatus behavior
tests/cli/init.test.ts (modified)          # add test for runInit + first-epic flow

kadai-plugin/commands/
├── kadai-add.md                           # NEW
├── kadai-set-status.md                    # NEW
└── kadai-unpick.md                        # NEW

kadai-plugin/.claude-plugin/plugin.json    # version bump 0.1.0 → 0.2.0

docs/wiki/cli-reference.md                 # MODIFIED — add `kadai set-status` + note `init -y`
docs/wiki/plugin.md                        # MODIFIED — list 3 new slash commands
docs/wiki/post-mvp.md                      # MODIFIED — move Plan 6 items to "Recently shipped"
```

## Tasks

---

### Task 1: `kadai set-status` CLI command

**Files:**
- Create: `src/cli/set-status.ts`
- Create: `tests/cli/set-status.test.ts`
- Modify: `src/cli/index.ts` (register `setStatusCommand`)
- Modify: `docs/wiki/cli-reference.md` (add section)

**Goal:** `kadai set-status <id> <status> [--reason <text>]` — thin CLI wrapper over the existing `setStatus` core operation. Validates the transition; exits non-zero with stderr message on illegal transition or unknown ID.

- [ ] **Step 1: Failing test**

Create `/home/fintan/repos/kadai/tests/cli/set-status.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runSetStatus } from '../../src/cli/set-status';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-set-status-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runSetStatus moves an item from ready to in_progress', () => {
  runSetStatus(tmp, 'EPIC-001', 'in_progress');
  expect(findById(tmp, 'EPIC-001')?.data.status).toBe('in_progress');
});

test('runSetStatus rejects illegal transitions', () => {
  expect(() => runSetStatus(tmp, 'EPIC-001', 'done'))
    .toThrow(/illegal transition/i);
});

test('runSetStatus throws for unknown ID', () => {
  expect(() => runSetStatus(tmp, 'EPIC-999', 'in_progress'))
    .toThrow(/not found/i);
});

test('runSetStatus accepts story review transition (story-only state)', () => {
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runSetStatus(tmp, 'STORY-001', 'in_progress');
  runSetStatus(tmp, 'STORY-001', 'review');
  expect(findById(tmp, 'STORY-001')?.data.status).toBe('review');
});
```

- [ ] **Step 2:** `bun test tests/cli/set-status.test.ts` — expect FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/cli/set-status.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { setStatus } from '../core/operations';
import type { Status } from '../core/state-machine';

const STATUS_VALUES = [
  'backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled',
] as const;

export function runSetStatus(rootDir: string, id: string, status: Status): void {
  // Thin wrapper — setStatus already validates the transition + writes atomically.
  setStatus(rootDir, id, status);
}

export const setStatusCommand = new Command('set-status')
  .description('Update the status of any kadai item, validated against the state machine')
  .argument('<id>', 'item ID like EPIC-001 or STORY-042')
  .argument('<status>', `target status (${STATUS_VALUES.join('|')})`)
  .option('-r, --reason <text>', 'reason for the change (logged but not persisted in this MVP)')
  .action((id: string, status: string, opts: { reason?: string }) => {
    if (!STATUS_VALUES.includes(status as Status)) {
      console.error(pc.red(`Invalid status: ${status}. Must be one of: ${STATUS_VALUES.join(', ')}`));
      process.exit(2);
    }
    try {
      runSetStatus(process.cwd(), id, status as Status);
      const reasonNote = opts.reason ? ` (reason: ${opts.reason})` : '';
      console.log(pc.green(`✓ ${id} → ${status}${reasonNote}`));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(pc.red(msg));
      process.exit(1);
    }
  });
```

- [ ] **Step 4:** `bun test tests/cli/set-status.test.ts` — expect 4 PASS.

- [ ] **Step 5: Register in CLI entry**

In `/home/fintan/repos/kadai/src/cli/index.ts`, add the import + registration (alongside the existing commands):

```typescript
import { setStatusCommand } from './set-status';

// ... (existing program.addCommand calls)
program.addCommand(setStatusCommand);
```

- [ ] **Step 6: Smoke-test the CLI**

```bash
TMP=$(mktemp -d) && cd "$TMP" && \
  kadai init -y > /dev/null && \
  kadai add epic --title "Test" --phase mvp > /dev/null && \
  kadai set-status EPIC-001 in_progress && \
  kadai list epic && \
  kadai set-status EPIC-001 done 2>&1 ; echo "exit=$?" ; \
  kadai set-status NOPE-001 in_progress 2>&1 ; echo "exit=$?" ; \
  cd / && rm -rf "$TMP"
```

Expected: first set-status succeeds (status → in_progress); second fails with "Illegal transition" + exit 1; third fails with "Item not found" + exit 1.

- [ ] **Step 7: Update docs**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, add a new section after `kadai pick`:

```markdown
## `kadai set-status <id> <status> [--reason]`

Update the status of any item. Validates against the state machine; illegal transitions exit 1 with an error message.

```bash
kadai set-status STORY-001 in_progress
kadai set-status STORY-001 review --reason "tests pass, awaiting code review"
kadai set-status STORY-001 done
```

The `--reason` flag is accepted (logged in CLI output) but not persisted in MVP — it's reserved for the post-MVP audit log feature.

For programmatic use, the MCP tool `mcp__kadai__set_status` does the same thing.
```

- [ ] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/set-status.ts src/cli/index.ts tests/cli/set-status.test.ts docs/wiki/cli-reference.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "feat(cli): add 'kadai set-status' command [Plan-6 Task-1]"
```

## Update Task 1 checkboxes (8 boxes) in plan.

---

### Task 2: `kadai init -y` creates a default first epic

**Files:**
- Modify: `src/cli/init.ts` (action handler — when `--yes`, create EPIC with default title)
- Modify: `tests/cli/init.test.ts` (add a test for the new behavior)
- Modify: `docs/wiki/cli-reference.md` (update `init -y` description)

**Goal:** `kadai init -y` should leave the spine in a usable state. Currently it creates `.kadai/` but no epic — so the next thing the user runs (`kadai add feature --parent EPIC-001`) errors. Fix: with `--yes`, also create EPIC-001 titled "Project setup" using the same code path the wizard uses.

- [ ] **Step 1: Add a failing test**

Append to `/home/fintan/repos/kadai/tests/cli/init.test.ts`:

```typescript
test('runInit with skipFirstEpic=false creates EPIC-001 (matches what -y does after Task 2)', () => {
  // This documents the new --yes behavior: the init wizard's epic-creation step
  // is now also taken when --yes is passed (with default title).
  // The runInit function itself doesn't create the epic — that's done by the CLI
  // action handler. So this test verifies the building block: runInit + runAdd
  // produce a usable spine.
  runInit({ rootDir: tmp, productDescription: 'Auto', skipFirstEpic: true });
  // The CLI will then call runAdd('epic', ...) when --yes; verify that path works:
  const { runAdd } = require('../../src/cli/add');
  const epicId = runAdd({ rootDir: tmp, kind: 'epic', title: 'Project setup', phase: 'mvp' });
  expect(epicId).toBe('EPIC-001');
});
```

- [ ] **Step 2:** `bun test tests/cli/init.test.ts` — should PASS already (this is a documenting test; the building block already works).

- [ ] **Step 3: Modify the init action handler**

In `/home/fintan/repos/kadai/src/cli/init.ts`, replace the `initCommand.action` body with:

```typescript
  .action(async (opts: { yes?: boolean }) => {
    const rootDir = process.cwd();
    const yes = !!opts.yes;
    let productDescription = 'Untitled product';
    let createFirstEpic = yes;                              // --yes → create with default
    let firstEpicTitle = yes ? 'Project setup' : '';

    if (!yes) {
      const r1 = await prompts({
        type: 'text',
        name: 'productDescription',
        message: 'What is the product you are tracking?',
        initial: 'Untitled product',
      });
      productDescription = r1.productDescription ?? 'Untitled product';

      const r2 = await prompts({
        type: 'confirm',
        name: 'createFirstEpic',
        message: 'Want to create your first epic now?',
        initial: true,
      });
      createFirstEpic = !!r2.createFirstEpic;

      if (createFirstEpic) {
        const r3 = await prompts({
          type: 'text',
          name: 'firstEpicTitle',
          message: 'First epic title:',
          initial: 'Project setup',
        });
        firstEpicTitle = r3.firstEpicTitle ?? 'Project setup';
      }
    }

    runInit({ rootDir, productDescription, skipFirstEpic: !createFirstEpic });
    console.log(pc.green('✓ kadai initialized in ' + rootDir));

    if (createFirstEpic && firstEpicTitle) {
      // @ts-ignore
      const { runAdd } = await import('./add');
      const epicId = runAdd({
        rootDir,
        kind: 'epic',
        title: firstEpicTitle,
        phase: DEFAULT_CONFIG.phases[0].slug,
      });
      console.log(pc.green(`✓ first epic created: ${epicId} — ${firstEpicTitle}`));
      console.log('Next: ' + pc.cyan(`kadai add feature --epic ${epicId}`));
    } else {
      console.log('Next: ' + pc.cyan('kadai add epic'));
    }
    console.log('');
    console.log(pc.yellow('⚠ Restart your Claude Code session in this directory'));
    console.log(pc.yellow('  to load the new MCP server (.mcp.json) and hooks (.claude/settings.json).'));
  });
```

(Only one line changed semantically — `createFirstEpic = yes` instead of `false` — but the surrounding `let firstEpicTitle = yes ? 'Project setup' : ''` is the second change. The rest is identical to before.)

- [ ] **Step 4:** `bun test tests/cli/init.test.ts` — all PASS (existing tests unchanged).

- [ ] **Step 5: Smoke-test the new behavior**

```bash
TMP=$(mktemp -d) && cd "$TMP" && \
  kadai init -y && \
  kadai list epic && \
  kadai add feature --title "Math" --phase mvp --epic EPIC-001 && \
  cd / && rm -rf "$TMP"
```

Expected: `kadai init -y` now creates EPIC-001 "Project setup"; subsequent `kadai add feature --epic EPIC-001` succeeds without "parent not found".

- [ ] **Step 6: Update docs**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, update the `kadai init` section's `-y` row:

Change:
```markdown
| `-y, --yes` | Skip prompts, use defaults, don't create a first epic |
```

To:
```markdown
| `-y, --yes` | Skip prompts, use defaults; creates EPIC-001 titled "Project setup" so the spine is usable immediately |
```

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/init.ts tests/cli/init.test.ts docs/wiki/cli-reference.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "feat(cli): kadai init -y now creates a default first epic [Plan-6 Task-2]"
```

## Update Task 2 checkboxes (7 boxes) in plan.

---

### Task 3: `/kadai-add <kind>` slash command

**Files:**
- Create: `kadai-plugin/commands/kadai-add.md`
- Modify: `docs/wiki/plugin.md` (mention the new command)

**Goal:** Slash command that creates a kadai item via the MCP `create_*` tools, prompting for missing fields. Mirrors the CLI `kadai add` UX.

- [x] **Step 1: Create the command**

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-add.md`:

````markdown
---
description: Create a kadai item (epic, feature, story, or task) with prompts for missing fields
allowed-tools: Bash, mcp__kadai__create_epic, mcp__kadai__create_feature, mcp__kadai__create_story, mcp__kadai__create_task, mcp__kadai__list_phases, mcp__kadai__get
argument-hint: <kind> [title]
---

The user wants to create a kadai item. The arguments are `$ARGUMENTS` — the first word should be the kind (`epic`, `feature`, `story`, or `task`); anything after is treated as the title.

## What to do

1. **Parse the kind.** Must be one of `epic | feature | story | task`. If invalid or missing, ask the user.

2. **Determine the title.** If text follows the kind in `$ARGUMENTS`, use it; otherwise ask the user for a title.

3. **For non-task kinds, determine the phase.** Default to `mvp` unless the user specifies. Call `mcp__kadai__list_phases` if you need to confirm the available phases.

4. **For non-epic kinds, determine the parent.**
   - feature → parent epic
   - story → parent feature
   - task → parent story

   If the user didn't say which parent, look up candidates via the appropriate `mcp__kadai__list_*` tool (e.g., `list_epics` for a feature) and ask the user to pick one. If exactly one candidate exists, use it without asking.

5. **Call the matching MCP create tool:**
   - `mcp__kadai__create_epic({ title, phase, description })`
   - `mcp__kadai__create_feature({ parent_epic, title, phase, description })`
   - `mcp__kadai__create_story({ parent_feature, title, phase, description, acceptance_criteria? })`
   - `mcp__kadai__create_task({ parent_story, title, description, plan_step? })`

   Pass empty `description: ""` if the user didn't provide one (the create tool will use a placeholder body).

6. **Confirm:** print the new item's ID and a one-line next step (e.g., for an epic: "Next: `/kadai-add feature` under EPIC-XXX").

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai add $ARGUMENTS    # may need additional flags depending on kind
```

The CLI prompts for missing fields too, so this still works — just less guided.
````

- [x] **Step 2: Verify**

```bash
cd /home/fintan/repos/kadai
head -10 kadai-plugin/commands/kadai-add.md
```

Expected: YAML frontmatter visible.

- [x] **Step 3: Update docs**

In `/home/fintan/repos/kadai/docs/wiki/plugin.md`, update the "What it provides" section to add `/kadai-add`:

Change the bullet list under "What it provides" to add (alongside the existing items):

```markdown
- **`/kadai-add <kind> [title]`** — guided creation of any item kind, asking for parent and phase when needed.
```

- [x] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/commands/kadai-add.md docs/wiki/plugin.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "feat(plugin): add /kadai-add slash command [Plan-6 Task-3]"
```

## Update Task 3 checkboxes (4 boxes) in plan.

---

### Task 4: `/kadai-set-status` slash command

**Files:**
- Create: `kadai-plugin/commands/kadai-set-status.md`
- Modify: `docs/wiki/plugin.md`

**Goal:** Slash companion to `kadai set-status` — wraps `mcp__kadai__set_status` with CLI fallback.

- [x] **Step 1: Create the command**

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-set-status.md`:

````markdown
---
description: Update the status of a kadai item (validated against the state machine)
allowed-tools: Bash, mcp__kadai__set_status, mcp__kadai__get
argument-hint: <id> <status>
---

The user wants to set a kadai item's status. The arguments are `$ARGUMENTS` — first the ID (like `STORY-042`), then the status (`backlog | ready | in_progress | blocked | review | done | cancelled`).

## What to do

1. **Parse the args.** Need both an ID (matching `(EPIC|FEAT|STORY|TASK)-\d+`) and a status. If either is missing or invalid, tell the user the expected form (`/kadai-set-status STORY-001 review`) and stop.

2. **Verify the item exists** via `mcp__kadai__get` with the ID. If null, report and stop.

3. **Set the status** via `mcp__kadai__set_status` with the ID and status. The MCP tool validates against the state machine; if the transition is illegal, it returns an error message — pass that back to the user.

4. **Confirm:** print "✓ ID → status".

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai set-status $ARGUMENTS
```

This does the same thing.

## Common transitions

- `STORY-001 in_progress` — start work (also done automatically by `/kadai-pick`)
- `STORY-001 review` — work done, awaiting PR review
- `STORY-001 done` — shipped
- `STORY-001 blocked` — stuck, needs human input
- `STORY-001 cancelled` — explicitly killed
````

- [x] **Step 2: Update docs**

In `/home/fintan/repos/kadai/docs/wiki/plugin.md`, add to the "What it provides" list:

```markdown
- **`/kadai-set-status <id> <status>`** — set status to any state machine value (e.g., `STORY-001 review`).
```

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/commands/kadai-set-status.md docs/wiki/plugin.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "feat(plugin): add /kadai-set-status slash command [Plan-6 Task-4]"
```

## Update Task 4 checkboxes (3 boxes) in plan.

---

### Task 5: `/kadai-unpick` slash command

**Files:**
- Create: `kadai-plugin/commands/kadai-unpick.md`
- Modify: `docs/wiki/plugin.md`

**Goal:** Slash companion to `kadai unpick` — wraps `mcp__kadai__unpick`. Tiny.

- [x] **Step 1: Create the command**

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-unpick.md`:

````markdown
---
description: Clear the picked-story flag (does NOT change the story's status)
allowed-tools: Bash, mcp__kadai__unpick
---

The user wants to clear the picked-story flag.

## What to do

1. Call `mcp__kadai__unpick` (no arguments).
2. Confirm: print "✓ unpicked — no story is currently picked".

Note: this does NOT change the picked story's status. If the story was `in_progress`, it stays `in_progress`. To also revert status, the user would need `/kadai-set-status STORY-XXX ready` or similar.

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai unpick
```
````

- [x] **Step 2: Update docs**

In `/home/fintan/repos/kadai/docs/wiki/plugin.md`, add to the "What it provides" list:

```markdown
- **`/kadai-unpick`** — clear the picked-story flag (does not change status).
```

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/commands/kadai-unpick.md docs/wiki/plugin.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "feat(plugin): add /kadai-unpick slash command [Plan-6 Task-5]"
```

## Update Task 5 checkboxes (3 boxes) in plan.

---

### Task 6: Plugin version bump + post-MVP doc update

**Files:**
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (version 0.1.0 → 0.2.0)
- Modify: `docs/wiki/post-mvp.md` (move Plan 6 items to "Recently shipped"; mark Plan 7 as next)

**Goal:** Bump the plugin version so users running `/plugin update` get the new commands. Mark Plan 6 work shipped in the backlog doc.

- [ ] **Step 1: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change:

```json
  "version": "0.1.0",
```

to:

```json
  "version": "0.2.0",
```

- [ ] **Step 2: Update post-MVP backlog**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Remove the "Plan 6 — Workflow completion" section from "Shipping plan (proposed)".

(b) Mark Plan 7 — Web viewer interactivity with the 🟢 **next** badge instead.

(c) In the "Recently shipped" section at the bottom, replace the placeholder text with:

```markdown
## Recently shipped (as items move out of this list)

### Plan 6 — Workflow completion (shipped 2026-05-05)

- `kadai set-status <id> <status> [--reason]` — arbitrary status mutations from CLI
- `kadai init -y` now creates EPIC-001 "Project setup" so the spine is usable immediately
- `/kadai-add <kind>` — guided creation slash command
- `/kadai-set-status <id> <status>` — slash companion to the new CLI
- `/kadai-unpick` — slash companion to `kadai unpick`
- Plugin version bumped to 0.2.0
```

(d) Remove the corresponding items from the "Surfaced from real use" subsection of the Backlog.

- [ ] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/.claude-plugin/plugin.json docs/wiki/post-mvp.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "chore(plugin): bump version to 0.2.0 + mark Plan 6 shipped in backlog [Plan-6 Task-6]"
```

## Update Task 6 checkboxes (3 boxes) in plan.

---

### Task 7: Dogfood verification via shell test

**Files:** None directly created — appends to `docs/dogfood-acceptance-test.md` if the run is notable.

**Goal:** Run the bundled `kadai-dogfood-test` skill against this build to verify the new slash commands and the CLI changes work together via the `claude -p` Path A method. This is the "TDD using the shell testing method" loop the user asked for.

> **Important:** This task verifies the SLASH COMMANDS work after install. It assumes the user has reinstalled the kadai plugin (or run `/plugin update`) so v0.2.0 is loaded. If the test runs against a stale plugin install (still 0.1.0), the new slash commands won't be available — that's a setup issue, not a code defect.

- [ ] **Step 1: Reinstall the plugin to pick up v0.2.0**

The implementer needs to confirm the user has refreshed the plugin install. From the user's Claude Code session:

```
/plugin marketplace add /home/fintan/repos/kadai     # idempotent — re-registers
/plugin update kadai                                  # if available, otherwise:
/plugin uninstall kadai
/plugin install kadai@kadai
/reload-plugins
```

Verify: `/help` lists `/kadai-add`, `/kadai-set-status`, `/kadai-unpick` among available commands.

> If the implementer can't directly trigger this on the user's session, document the prerequisite in the report and proceed assuming v0.2.0 is loaded.

- [ ] **Step 2: Run the kadai-dogfood-test skill procedure**

Following the skill at `kadai-plugin/skills/kadai-dogfood-test/SKILL.md`:

```bash
TMP=$(mktemp -d -t kadai-dogfood-XXXXXX)
echo "Test temp dir: $TMP"
cd "$TMP"

kadai init -y > /dev/null
# Verify Task 2's change: -y should now have created EPIC-001
kadai list epic
# Expected: EPIC-001 "Project setup" already exists

kadai add feature --title "Math utils" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Implement add(a,b)" --phase mvp --feature FEAT-001 > /dev/null
kadai list story
```

- [ ] **Step 3: Spawn `claude -p` for the integration test**

```bash
cd "$TMP"

echo "STORY-001 needs implementing — 'Implement add(a,b)'. Use the kadai workflow: pick the story (use the /kadai-pick slash command if available, or 'kadai pick STORY-001' from bash), then create src/math.ts with an add(a, b) function and tests/math.test.ts using bun:test. Mark the story 'review' when done — use /kadai-set-status STORY-001 review or 'kadai set-status STORY-001 review' from bash. Report which kadai commands you used and any hook errors you saw." \
  | claude -p --model haiku \
  --allowedTools "Bash Edit Write Read mcp__kadai__set_status mcp__kadai__pick_story mcp__kadai__get_active_story mcp__kadai__list_stories mcp__kadai__get mcp__kadai__create_task" \
  2>&1 | tee /tmp/kadai-plan6-output.txt | tail -50
```

- [ ] **Step 4: Verify the 6 dogfood points**

```bash
cd "$TMP"

echo "=== (point 1+3) Did the agent use kadai workflow? ==="
grep -iE "(pick|kadai|guardrail)" /tmp/kadai-plan6-output.txt | head -20

echo "=== (point 4) Changelog populated? ==="
find .kadai -name changelog.md -exec echo "{}:" \; -exec cat {} \; -exec echo "" \;

echo "=== (point 5) Story status moved? ==="
kadai list story
echo "(should show STORY-001 in 'review' if Task 1's set-status worked end-to-end)"

echo "=== Created files (sanity) ==="
ls src/ tests/ 2>&1

echo "=== Final overall status ==="
kadai status
```

Specifically verify these Plan 6 outcomes are visible in the output:

- ✅ `kadai init -y` produced EPIC-001 (Task 2 worked)
- ✅ `kadai add feature --epic EPIC-001` worked (Task 2's flag alias from Plan 6 — well, alias is from previous post-MVP fix)
- ✅ Story moved to `review` via `kadai set-status` or `mcp__kadai__set_status` (Task 1 worked)

- [ ] **Step 5: Append the run to the dogfood acceptance log**

Append a new section to `/home/fintan/repos/kadai/docs/dogfood-acceptance-test.md` titled `## Path A run — Plan 6 verification — 2026-05-05` with the observations from Step 4. Match the format of the previous Path A log entry.

- [ ] **Step 6: Clean up + commit**

```bash
rm -rf "$TMP" /tmp/kadai-plan6-output.txt

cd /home/fintan/repos/kadai
git add docs/dogfood-acceptance-test.md docs/superpowers/plans/2026-05-05-kadai-06-workflow-completion.md
git commit -m "test(dogfood): Plan 6 verification via claude -p shell method [Plan-6 Task-7]"
```

## Update Task 7 checkboxes (6 boxes) in plan.

## Constraints
- Don't run the test against the kadai project repo itself (use a temp dir).
- If `claude` isn't available in the implementer's bash environment, document that the dogfood verification couldn't run automatically and recommend the user run it manually via the runbook in `docs/dogfood-acceptance-test.md`.
- Plan 6 is "PASS" if the spec-required outcomes (init -y → epic, set-status works) are visible in the test, even if the slash commands aren't (because the plugin reinstall is a user action, not implementer-triggerable).

---

## Plan 6 self-review checklist

- [ ] All 7 tasks above completed; checkboxes ticked.
- [ ] `bun test` passes (~181+ tests including the 4 new set-status tests).
- [ ] `bun run typecheck` passes.
- [ ] `kadai set-status` works end-to-end (smoke test in Task 1 step 6).
- [ ] `kadai init -y` creates EPIC-001 (smoke test in Task 2 step 5).
- [ ] Plugin v0.2.0 in the manifest.
- [ ] post-mvp.md updated: Plan 6 in "Recently shipped"; Plan 7 marked 🟢 **next**.
- [ ] Dogfood verification (Task 7) ran or was documented as user-manual.

---

## Proceed to Plan 7

When the checklist above is satisfied:

1. Update [`README.md`](README.md): add a Plan 6 row marked `DONE` (after Plan 5).
2. Update [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" to point to Plan 7 (web viewer interactivity).
3. Run `/writing-plans` against the Plan 7 stub when ready (no stub file yet — Plan 7 onwards will be drafted just-in-time per the post-MVP backlog).

If a fresh Claude session lands here:
- Verify Plan 5 is `DONE` per [`README.md`](README.md).
- The first unchecked `- [ ]` task above is your next action.
- Source spec is the post-MVP backlog at [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md), specifically the "Plan 6 — Workflow completion" section.
