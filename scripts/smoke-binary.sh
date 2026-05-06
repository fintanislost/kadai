#!/usr/bin/env bash
# Build the kadai binary, run a handful of subcommands against a temp project,
# assert each one succeeds. Run from the kadai repo root.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$REPO_ROOT/dist/kadai"

# 1. Build (chains build:web + embed-assets + bun build --compile).
echo "==> bun run build"
cd "$REPO_ROOT"
bun run build > /dev/null

if [[ ! -x "$BIN" ]]; then
  echo "FAIL: $BIN not built or not executable"
  exit 1
fi
echo "    binary at $BIN"

# 2. Make a tmp project, exercise the CLI surface.
TMP="$(mktemp -d -t kadai-smoke-XXXXXX)"
cleanup() { rm -rf "$TMP" "$TMP-serve.log"; }
trap cleanup EXIT

cd "$TMP"
echo "==> kadai init -y"
"$BIN" init -y > /dev/null

echo "==> kadai add feature"
"$BIN" add feature --title "Login" --phase mvp --epic EPIC-001 > /dev/null

echo "==> kadai add story"
"$BIN" add story --title "Email" --phase mvp --feature FEAT-001 > /dev/null

echo "==> kadai list story"
"$BIN" list story | grep -q 'STORY-001' || { echo "FAIL: STORY-001 not listed"; exit 1; }

echo "==> kadai pick STORY-001"
"$BIN" pick STORY-001 > /dev/null

echo "==> kadai status"
"$BIN" status | grep -q 'STORY-001' || { echo "FAIL: status doesn't show picked story"; exit 1; }

# 3. Spawn `kadai serve` in the background, hit /api/items/STORY-001 and /,
#    confirm the embedded SPA returns a real HTML response.
echo "==> kadai serve --no-open --port 7912"
"$BIN" serve --no-open --port 7912 > "$TMP-serve.log" 2>&1 &
SERVE_PID=$!
sleep 2

if ! curl -fsS "http://localhost:7912/api/items/STORY-001" > /dev/null; then
  kill $SERVE_PID 2>/dev/null || true
  cat "$TMP-serve.log"
  echo "FAIL: /api/items/STORY-001 unreachable"
  exit 1
fi

INDEX="$(curl -fsS http://localhost:7912/)"
if ! grep -q '<div id="root"' <<< "$INDEX"; then
  kill $SERVE_PID 2>/dev/null || true
  cat "$TMP-serve.log"
  echo "FAIL: / does not return SPA HTML"
  exit 1
fi

JS="$(curl -fsS http://localhost:7912/assets/index.js | wc -c)"
if (( JS < 1000 )); then
  kill $SERVE_PID 2>/dev/null || true
  echo "FAIL: /assets/index.js too small (size=$JS)"
  exit 1
fi

kill $SERVE_PID 2>/dev/null || true
sleep 1

echo ""
echo "✅ Binary smoke test PASSED"
echo "    init, add, list, pick, status, serve, embedded SPA all working"
