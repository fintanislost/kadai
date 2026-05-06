# Web API reference

The kadai web viewer (`kadai serve`) exposes a small HTTP API at `/api/*`. All paths are JSON unless noted.

## Read endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/phases` | `PhaseConfig[]` from `.kadai/config.toml` |
| `GET` | `/api/epics?phase=&status=` | `Item[]` |
| `GET` | `/api/features?epic_id=&phase=&status=` | `Item[]` |
| `GET` | `/api/stories?feature_id=&phase=&status=` | `Item[]` |
| `GET` | `/api/tasks?story_id=&status=` | `Item[]` |
| `GET` | `/api/items/:id` | `Item` (404 if not found) |
| `GET` | `/api/items/:id/transitions` | `{ current: Status, allowed: Status[] }` |
| `GET` | `/api/picked` | `Item \| null` |
| `GET` | `/api/files/:id/(spec.md\|plan.md\|changelog.md)` | `text/plain` of the file contents |
| `GET` | `/api/events` | `text/event-stream` of `data: {"scope":"spine\|picked\|config"}` lines |
| `GET` | `/api/search?q=<query>` | `SearchResult[]` (or `[]` for queries < 2 chars; 400 if `q` is missing) |

## Write endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/api/items/:id/status` | `{"status":"<status>"}` | updated `Item` (200), `{"error"}` (400/404) |
| `POST` | `/api/items/:id/attach` | multipart: `kind=spec\|plan`, `file=<binary>` | updated `Item` (200), `{"error"}` (400/404) |

### `POST /api/items/:id/status`

Validates the transition against the state machine. Illegal transitions return 400 with `{"error":"Illegal transition for <id> (<kind>): <from> → <to>"}`.

```bash
curl -X POST http://localhost:7777/api/items/STORY-001/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress"}'
```

### `POST /api/items/:id/attach`

Accepts a multipart form with `kind` (`spec` or `plan`) and `file` (the markdown blob). Writes the file as `spec.md` or `plan.md` inside the item's directory and updates the item's frontmatter.

- `kind=spec` is allowed on `feature` and `story` items.
- `kind=plan` is allowed on `story` items only.

```bash
curl -X POST http://localhost:7777/api/items/STORY-001/attach \
  -F 'kind=plan' \
  -F 'file=@./my-plan.md'
```

## Notes

- All write endpoints validate via the same core logic as the CLI and MCP tools, so concurrent CLI/MCP/web edits stay schema-correct.
- There is no auth — `kadai serve` listens on localhost only and assumes the operator is the user.

## Live updates

`/api/events` is a Server-Sent Events stream. The server watches `.kadai/` for filesystem changes (recursive walk plus dynamic add-on-rename for new subdirs, with stat-poll for `.picked` since dotfiles are unreliable on Linux/Bun inotify); each change is debounced (50ms per scope) then pushed as one `data: {...}` line per event:

- `{"scope":"spine"}` — any item file or `.counters.json` etc. changed
- `{"scope":"picked"}` — `.kadai/.picked` changed
- `{"scope":"config"}` — `.kadai/config.toml` changed

A `:` comment heartbeat is sent every 15 seconds so proxies don't kill idle connections. Browsers consume this via `EventSource`; the kadai web viewer re-runs all `useEffect` data fetches on every `spine` event.

## Search

`GET /api/search?q=<query>` does a case-insensitive substring match across each item's title, body, and acceptance_criteria. Min query length is 2 characters; shorter queries return `[]`.

`SearchResult` shape:

```json
{
  "id": "STORY-042",
  "kind": "story",
  "title": "Magic link delivery",
  "phase": "mvp",
  "status": "ready",
  "matchType": "body",
  "snippet": "…the magic-link email is sent via SES with a signed token…",
  "matchStart": 28,
  "matchEnd": 31
}
```

Results are sorted: title matches first, then acceptance-criteria matches, then body matches. Within a match-type, original spine order is preserved. The `snippet` is ~80 chars centered on the first match in the source field; `matchStart`/`matchEnd` are offsets into `snippet` (NOT the source field) so the renderer can highlight without a second search.

The MCP `search` tool is still available and continues to return `Item[]` (full frontmatter + body) for backwards compatibility.
