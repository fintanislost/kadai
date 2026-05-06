# Web viewer

Run `kadai serve` (after `bun run build:web` in the kadai repo) to launch the localhost SPA.

## Layout

The viewer follows a consistent **hero + body** pattern across detail pages (Story, Feature, Epic):

- **Topbar:** brand mark, project context (multi-mode), Activity / Compare nav, search, picked indicator
- **Breadcrumb:** parent chain leading to the current item
- **Hero block:** kind label + ID pill + title + status + phase + progress (`X of Y done`) + actions + view toggle
- **Detail body:** 2-column grid — primary content (description, decomposition list) on the left; context (documents, attached content) on the right
- **View toggle:** every detail page can switch into a **Tree** view of its subtree. The Feature page also has a third Kanban view for drag-drop status changes.

The Home page replaces the per-item hero with a project-level hero (4-count summary + phase pills) and per-phase grids of epic cards.

The `GET /api/items/:id/subtree` endpoint backs the Tree view (item + all descendants in one fetch).

The header has a **search box** — type a query (min 2 chars), press Enter to land on `/search?q=...` with full-spine results. See [api-reference.md#search](api-reference.md#search) for the underlying endpoint.

The header has links to **Activity** (a flat reverse-chronological stream of all changelog entries across the spine) and **Compare** (side-by-side phase comparison; pass `?a=<phase>&b=<phase>` in the URL or pick from the available phases shown).

## Visual conventions

- **Status colors**: backlog (grey), ready (blue), in_progress (amber), blocked (red), review (purple), done (green), cancelled (dim grey + strikethrough).
- **Kind icons**: epics (Layers), features (Box), stories (BookOpen), tasks (CheckSquare).
- **Empty states** include a suggested CLI command to add the missing item.
- **Loading states** use shimmering skeleton placeholders (no spinners, no "Loading..." text).

## Interactivity (Plan 7+)

The viewer is no longer read-only. From the story page right rail you can move the story to any legal next status. From the feature page kanban you can drag a story card across columns to change its status. From the spec/plan tabs you can upload a markdown file via the **Attach** button — the file is moved into the item directory and the frontmatter is updated.

Status changes are optimistic — the UI updates immediately and reverts if the server rejects (e.g., illegal transition).

The viewer also auto-refreshes on any change to `.kadai/` (CLI write, MCP tool, hook append, or another browser tab). It uses Server-Sent Events on `/api/events` — see [api-reference.md](api-reference.md#live-updates) for the protocol details.

See [api-reference.md](api-reference.md) for the full endpoint surface backing the UI.

## Multi-project mode

When you've registered ≥1 project via `kadai serve register`, the viewer auto-switches to multi-project mode. The picker at `/projects` shows all registered projects. Each project's pages live at `/p/<slug>/...` (e.g., `/p/alpha/epics/EPIC-001`). The header shows the active project name and a "← Switch" link back to the picker.

In single-project mode (no projects registered) the viewer behaves as before — root `/` is the project's home, pages are at `/epics/...`, etc.
