# Plan 2 — MCP server

> **Status:** STUB — implementation plan not yet written.
> **To draft this plan:** run `/writing-plans` against this file (after Plan 1 has shipped).

## Position in the build

| | |
|---|---|
| **This is plan** | 2 of 5 |
| **Prior plan** | [Plan 1 — Spine + CLI](2026-05-05-kadai-01-spine-and-cli.md) — must be `DONE` |
| **Next plan** | [Plan 3 — Hooks (guardrails)](2026-05-05-kadai-03-hooks.md) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) |

## Goal

Implement `kadai mcp` — a stdio MCP server that exposes the spine to agents through typed tools. Extend `kadai init` to register the MCP in `.mcp.json`.

## Scope

- `kadai mcp` command runs an MCP stdio server using `@modelcontextprotocol/sdk`
- **Read tools:** `list_phases`, `list_epics`, `list_features`, `list_stories`, `list_tasks`, `get`, `get_active_story`, `search`
- **Write tools:** `create_epic`, `create_feature`, `create_story`, `create_task`, `set_status` (validated via state machine), `set_phase`, `attach_spec` (moves spec from `docs/superpowers/specs/` into `.kadai/`), `attach_plan`, `pick_story`, `unpick`
- All write tools validate against schema + state machine; illegal transitions return clear errors
- Extend `kadai init` to write `.mcp.json` registration: `"kadai": { "command": "kadai", "args": ["mcp"] }` (merged, not overwritten)
- Atomic write coordination: MCP and CLI both write the spine; use file locking on the counters file and atomic-rename for item writes

## Out of scope (deferred)

- `record_change` MCP tool — Plan 3 (the changelog hook needs it)
- `sync_git` MCP tool — post-MVP
- Hooks (`.claude/settings.json` modifications) — Plan 3
- Web viewer integration — Plan 4

## Dependencies — what must exist before writing this plan

**Plan(s) shipped:** Plan 1.

**Specifically, these APIs from Plan 1 are inputs (read the actual exports — the spec API sketches may not match exactly):**

- `src/core/state-machine.ts` — `isLegalTransition(kind, from, to)`, `legalNextStates(kind, from)`
- `src/core/schema.ts` — `validateItem(item)` and per-type Zod schemas
- `src/core/files.ts` — `writeFileAtomic(path, content)`
- `src/core/spine.ts` — `walkSpine(rootDir)` (yields all items)
- `src/core/ids.ts` — `nextId(kind, rootDir)` (counter persistence)
- `src/core/frontmatter.ts` — `parse`, `serialize`
- `src/core/types.ts` — `Epic`, `Feature`, `Story`, `Task`, `Status`, `Phase`, `ItemKind`
- `src/config/load.ts` — `loadConfig(rootDir)`
- `src/cli/init.ts` — exported helpers for the existing init flow (so this plan can extend, not duplicate)

## Outputs — what ships at the end of this plan

- `kadai mcp` command launches a working stdio MCP server
- All read + write tools listed under "Scope" are callable from a connected MCP client
- `kadai init` writes/merges `.mcp.json` registration
- The pick state (`.kadai/.picked`) is queryable via `get_active_story`
- Integration tests cover every MCP tool's happy path + at least one error case (e.g., illegal status transition)

## Spec sections covered

- §5.1 — MCP server tool surface
- §5.5 — CLAUDE.md addition extended (reference MCP)
- §8 — `kadai init` extended to write `.mcp.json`

## When to write this plan

After Plan 1's final task (manual smoke test) passes and the data-layer + CLI exports are stable. Read the actual landed source files in `src/core/*` and `src/cli/init.ts` — *don't rely on this stub's API list, which may have drifted from what got built.*

## Compaction recovery note

If a fresh Claude lands here:
1. Verify Plan 1 is `DONE` per [`README.md`](README.md). If not, complete Plan 1 first.
2. Read the spec at [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md), specifically §5.1.
3. **Read the actual exports** from `src/core/*` and `src/cli/init.ts` — these are the real inputs.
4. Run `/writing-plans` and reference this file. The drafted plan replaces this stub's content.
