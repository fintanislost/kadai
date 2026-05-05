# Product spine

**Product:** Untitled product

This directory is the kadai spine — the source of truth for what this product should do.

- `epics/` — top-level capability areas, each with `features/` and below them `stories/` and `tasks/`
- `config.toml` — phases, auto-transition flags, guardrail allowlist
- `.counters.json` — ID counters (committed)

Don't edit by hand if you're not sure of the schema; use `kadai add (epic|feature|story|task)`.
