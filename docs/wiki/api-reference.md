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
- For real-time updates across browser tabs, see Plan 8 (SSE) once it ships.
