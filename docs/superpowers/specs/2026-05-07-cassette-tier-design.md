# Cassette tier for kadai dogfood — design spec

**Status:** Draft 2026-05-07. Lives on `feature/cassette-tier` (off `feature/kadai-aware-skills`).

## Motivation

The kadai-aware-skills work shipped with two test tiers:

- **Tier 1** (every PR, ~3s): unit + plumbing tests via direct module imports
- **Tier 3** (gated `RUN_DOGFOOD_E2E=1`, ~5–10min): real `claude -p` end-to-end

The gap between them is exactly where production bugs live. The Plan-17 CSS bug (built clean, ran broken) and this plan's `picked`-not-updated-on-resume bug (unit tests passed, real flow silently broke) both lived in that gap. Tier 3 catches them but is too slow + too expensive to run on every PR, so dev cycles regress shipping behavior we won't notice until release.

A **Tier 2** between them — fast, deterministic, no model calls, but exercising the wrapper's actual integration with the kadai CLI — would close the gap.

## Goals

- A new test tier that runs on every PR alongside Tier 1 (~30s budget for the whole tier).
- Captures real `claude -p` runs as **cassettes**: a recorded sequence of `kadai` CLI invocations the wrapper made, plus a snapshot of the resulting `.kadai/` directory.
- Replays cassettes against fresh temp spines without invoking Claude.
- Verifies that current code, given the same CLI invocations, produces the same final spine state.
- Re-recording is a manual developer action (not automated) — cassettes are committed to git.

## Non-goals

- Verifying that Claude actually loads the right skill (that's Tier 3's job — skill-matching drift is fundamentally non-deterministic and belongs in nightly canaries, not PR gates).
- Mocking Claude itself (the "stub" pattern). Cassettes capture *real* sequences; stubs capture *imagined* sequences.
- Verifying parity between the cassette's CLI sequence and the current wrapper's actual choices (the wrapper might validly call `kadai add` differently while still producing the right end state).
- Cross-platform replay nuances (file ordering, locale-dependent dates). v1 assumes Linux/macOS dev boxes.

## What gets captured (cassette format)

Each cassette is two files:

```
tests/cassettes/<scenario-name>/
  calls.jsonl           # newline-delimited JSON, one CLI invocation per line
  spine.snapshot.json   # serialized .kadai/ directory tree at end of run
```

`calls.jsonl` example (one line per call):

```json
{"argv": ["init", "-y"], "exit": 0}
{"argv": ["add", "epic", "--title", "MD Toolkit", "--phase", "mvp"], "exit": 0}
{"argv": ["add", "feature", "--title", "Markdown to plaintext", "--epic", "EPIC-001", "--phase", "mvp"], "exit": 0}
{"argv": ["attach-spec", "FEAT-001", "/tmp/spec-abc123.md"], "exit": 0, "stdin_file": "spec-content.md"}
{"argv": ["add", "story", "--title", "...", "--feature", "FEAT-001", "--phase", "mvp"], "exit": 0}
{"argv": ["pick", "STORY-001"], "exit": 0}
```

`spine.snapshot.json` is a recursive serialization of `.kadai/`:

```json
{
  "config.toml": "<file contents>",
  ".counters.json": "{...}",
  "picked": "STORY-001",
  "epics/EPIC-001-md-toolkit/epic.md": "---\\nid: EPIC-001\\n...\\n---\\n# Body\\n",
  "epics/EPIC-001-md-toolkit/features/FEAT-001-markdown-to-plaintext/feature.md": "...",
  "epics/.../stories/STORY-001-.../story.md": "...",
  "epics/.../stories/STORY-001-.../plan.md": "..."
}
```

Files containing volatile fields (timestamps, IDs that change per run) get **normalized** at snapshot time: ISO timestamps replaced with `<TIMESTAMP>`, kadai-counter values left alone (they're deterministic given a known starting state). The normalization is a pure function on the snapshot blob; replay re-normalizes the produced spine the same way before diffing.

## How the recorder works

`scripts/record-cassette.ts` (new):

1. Take a scenario name + a Claude prompt as args.
2. Create a fresh temp dir; `kadai init -y` in it.
3. Run `claude -p "<prompt>"` with `KADAI_RECORD_TO=<calls-jsonl-path>` env var set.
4. The kadai CLI (modified) writes one JSONL line per mutating invocation to that file.
5. After Claude finishes, snapshot the `.kadai/` tree via `serializeSpine(rootDir)` → `spine.snapshot.json`.
6. Write both files into `tests/cassettes/<scenario-name>/`.
7. Print a summary: "captured N CLI calls, snapshot is M bytes, commit cassette to lock it in."

Recorder is a one-shot dev tool, not a test. It IS gated on `claude` being on PATH and uses real model calls — same cost profile as Tier 3.

## How replay works

`tests/cassette/replay.test.ts` (new):

1. Discover all `tests/cassettes/*/` directories.
2. For each cassette: create a fresh temp dir.
3. Read `calls.jsonl` line by line; exec each `kadai <argv>` against the temp dir.
4. After all calls succeed, snapshot the resulting spine.
5. Diff the produced snapshot vs the captured `spine.snapshot.json` after normalization.
6. Assert equality. On mismatch, print a unified diff showing exactly which file diverged.

If any CLI call returns a non-zero exit when the cassette captured a zero exit (or vice versa), fail with the call index + argv that diverged.

## CLI changes needed

`src/cli/index.ts` (or a wrapper around it) gets a one-line addition: when `KADAI_RECORD_TO` is set, append `{argv, exit}` to that file before exiting. ~10 lines including the file-locking via `appendFileSync` (atomic enough for our single-writer use case).

No other CLI changes. The recorder is dev-only; the test code is dev-only.

## What this catches vs misses

**Catches** (bugs the existing tiers would have shipped):

- Schema changes that break the wrapper's CLI calls (e.g., `kadai add story` requires a new flag — old cassette fails)
- Plumbing bugs in the runner / CLI / spine helpers that produce a different final state for the same call sequence (the gray-matter cache poisoning, the resume-doesn't-update-picked, the date corruption)
- Regressions in `kadai init` defaults that change the seeded `.kadai/` shape
- Atomic write bugs that leave `.tmp` files behind (snapshot diff would surface them)

**Misses** (and that's OK — Tier 3 owns these):

- Claude stops loading the wrapper skill (skill-matching drift)
- The wrapper logic changes its CLI choices but produces a valid different final state (a behavior change, not a bug — the team should re-record the cassette)
- Anthropic API outages / rate-limits / model deprecations

## Out of scope (v1)

- Cassette versioning / migration. v1 is "re-record when you intentionally change something."
- Partial-failure cassettes (capturing a run that errored midway). Always-succeed cassettes only.
- Concurrent replay (running multiple cassettes in parallel). Sequential is fine for the scenario count we'll have.
- Auto-recording in CI. Recorder is dev-only.

## Acceptance criteria

This ships when:

1. `scripts/record-cassette.ts <name> "<prompt>"` produces a `tests/cassettes/<name>/` directory with both files.
2. `bun test tests/cassette/` replays all cassettes in <30s on a typical dev machine.
3. At least one cassette is committed (the "blog MVP brainstorm + plan" flow that timed out in Task 10).
4. The CLI's `KADAI_RECORD_TO` instrumentation does NOT change behavior when the env var is unset.
5. `bun test` (no env vars) shows the cassette tier passing alongside the existing tiers, full suite still <10s.

## Suggested implementation tasks

1. **CLI recording instrumentation.** ~15 lines in `src/cli/index.ts`. Two unit tests: one verifies recording happens with the env var set, one verifies no behavior change without it.

2. **Spine snapshot helpers** (`src/cassette/snapshot.ts`). Walk `.kadai/`, build the recursive blob, normalize timestamps. Pure functions — heavily unit-tested.

3. **Cassette replay test runner** (`tests/cassette/replay.test.ts`). Discovers cassettes, exec'es each call against a temp dir via `execFileSync('kadai', argv)`, snapshots, diffs.

4. **Recorder script** (`scripts/record-cassette.ts`). Wraps `claude -p` + sets the env var + writes both files. CLI surface: `bun scripts/record-cassette.ts <name> "<prompt>"`.

5. **First captured cassette** — the blog-MVP brainstorm-and-plan flow Task 10 used. Run the recorder once, commit the result.

6. **Wiki updates** (`docs/wiki/troubleshooting.md` for "cassette diff failed" and `docs/wiki/concepts.md` for the tier model overview).

## References

- Aware-skills spec + plan (the wrappers we're testing): `docs/superpowers/specs/2026-05-06-kadai-aware-skills-design.md`
- Plan-17 (the CSS bug that motivated tighter test gates): `docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md`
- Existing dogfood test: `tests/dogfood/kadai-aware-skills.dogfood.test.ts`
- Pact (HTTP cassettes): https://pact.io
- VCR.py (the original cassette pattern): https://vcrpy.readthedocs.io/
