# kadai

> Local-first product spine for projects driven by agentic coding.

Kadai tracks a hierarchical scope — **epics → features → stories → tasks** — as markdown files committed to your repo, and exposes typed **MCP tools + Claude Code hooks** that keep agents honest to the spine. Agents can't edit code that doesn't map to a picked story; every edit they do make is captured to that story's changelog.

Three things ship in this repo:

1. A **CLI** (`kadai`) — manage the spine from the terminal.
2. An **MCP server** (`kadai mcp`) — exposes the spine to agents through typed tools.
3. A **web viewer** (`kadai serve`) — roadmap + drill-down views at localhost, with live updates and spine-wide search.

Plus a bundled **Claude Code plugin** (`kadai-plugin/`) — auto-triggering skill and slash commands (`/kadai-pick`, `/kadai-status`, `/kadai-disable`, …).

## Install

From source (requires [Bun](https://bun.sh) ≥ 1.1):

```bash
git clone https://github.com/fintanislost/kadai.git
cd kadai
bun install
bun run build:web
bun link              # exposes the `kadai` command
```

Or build a self-contained binary:

```bash
bun run build         # writes dist/kadai for your host
bun run build:all     # cross-compiles for 5 targets
```

Other install paths (curl, Homebrew, npm) are documented in [`docs/wiki/installation.md`](docs/wiki/installation.md). Releases are pending — until then, install from source.

## Quick start

```bash
cd ~/projects/my-app
kadai init                                  # creates .kadai/, .mcp.json, hooks
kadai add feature --title 'User login' --phase mvp --parent EPIC-001
kadai add story   --title 'Email login'  --phase mvp --parent FEAT-001
kadai pick STORY-001                        # picks + transitions to in_progress
kadai status                                # picked story + queue
kadai serve                                 # roadmap at localhost
```

Restart your Claude Code session in the project directory after `kadai init` so the MCP server and hooks load.

To install the Claude Code plugin (so agents auto-trigger the kadai skill):

```
/plugin marketplace add /path/to/kadai-repo
/plugin install kadai@kadai
/reload-plugins
```

## How the guardrail works

After `kadai pick <story>`:

- **PreToolUse** blocks `Edit` / `Write` outside `.kadai/` and the configured allowlist when no story is picked.
- **PostToolUse** captures every edit to the picked story's `changelog.md`.
- **`kadai disable`** turns the guardrail off project-wide (or globally / per env var); `kadai enable` brings it back. See [`docs/wiki/concepts.md`](docs/wiki/concepts.md) for the toggle semantics.

## Docs

User-facing documentation lives in [`docs/wiki/`](docs/wiki/):

- [Getting started](docs/wiki/getting-started.md)
- [Installation](docs/wiki/installation.md)
- [CLI reference](docs/wiki/cli-reference.md)
- [Concepts](docs/wiki/concepts.md) — epics/features/stories/tasks, phases, picked, the state machine
- [Plugin](docs/wiki/plugin.md)
- [Web viewer](docs/wiki/web-viewer.md)
- [API reference](docs/wiki/api-reference.md)
- [Troubleshooting](docs/wiki/troubleshooting.md)
- [Post-MVP backlog](docs/wiki/post-mvp.md)

## Development

```bash
bun test                                   # full test suite
bun test src/core                          # core module only
bun test src/cli                           # CLI only
```

Tech stack: TypeScript on Bun (runtime + test runner + bundler), `commander` (CLI), `zod` (validation), `gray-matter` (frontmatter), `smol-toml` (config), `@modelcontextprotocol/sdk` (MCP), Vite + React + Tailwind + TanStack Router (web viewer).

## License

TBD.
