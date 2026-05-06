# Web viewer

Run `kadai serve` (after `bun run build:web` in the kadai repo) to launch the localhost SPA.

## Layout

- `/` — roadmap home, grouped by phase, lists epics with their features/stories rolled up.
- `/epics/:id` — epic detail with its features.
- `/features/:id` — feature detail with a kanban board of its stories.
- `/stories/:id` — story detail with tabs (story, spec, plan, changelog, tasks) and a status changer right rail.

The header has a **search box** — type a query (min 2 chars), press Enter to land on `/search?q=...` with full-spine results. See [api-reference.md#search](api-reference.md#search) for the underlying endpoint.

The header has links to **Activity** (a flat reverse-chronological stream of all changelog entries across the spine) and **Compare** (side-by-side phase comparison; pass `?a=<phase>&b=<phase>` in the URL or pick from the available phases shown).

## Interactivity (Plan 7+)

The viewer is no longer read-only. From the story page right rail you can move the story to any legal next status. From the feature page kanban you can drag a story card across columns to change its status. From the spec/plan tabs you can upload a markdown file via the **Attach** button — the file is moved into the item directory and the frontmatter is updated.

Status changes are optimistic — the UI updates immediately and reverts if the server rejects (e.g., illegal transition).

The viewer also auto-refreshes on any change to `.kadai/` (CLI write, MCP tool, hook append, or another browser tab). It uses Server-Sent Events on `/api/events` — see [api-reference.md](api-reference.md#live-updates) for the protocol details.

See [api-reference.md](api-reference.md) for the full endpoint surface backing the UI.
