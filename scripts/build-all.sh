#!/usr/bin/env bash
# Cross-compile kadai for darwin-x64, darwin-arm64, linux-x64, linux-arm64,
# windows-x64. Requires Bun ≥ 1.1 (cross-compile support).
# Run from the kadai repo root.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Build the SPA + embed assets ONCE (shared across all targets).
echo "==> Building SPA and embedding assets (one-time)"
bun run build:web > /dev/null
bun run embed-assets > /dev/null

mkdir -p dist
TARGETS=(
  "bun-darwin-x64:dist/kadai-darwin-x64"
  "bun-darwin-arm64:dist/kadai-darwin-arm64"
  "bun-linux-x64:dist/kadai-linux-x64"
  "bun-linux-arm64:dist/kadai-linux-arm64"
  "bun-windows-x64:dist/kadai-windows-x64.exe"
)

for entry in "${TARGETS[@]}"; do
  target="${entry%%:*}"
  outfile="${entry#*:}"
  echo "==> Building $target → $outfile"
  bun build --compile --target="$target" src/cli/index.ts --outfile "$outfile"
done

echo ""
echo "✅ Built ${#TARGETS[@]} binaries:"
ls -lh dist/kadai-*
