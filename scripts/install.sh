#!/usr/bin/env bash
# Kadai install script. Detects OS/arch, downloads the matching binary from
# GitHub Releases (or the URL specified by INSTALL_URL), and drops it into
# $BIN_DIR (default ~/.local/bin).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/<owner>/kadai/main/scripts/install.sh | sh
#   INSTALL_URL=https://example.com/releases/v0.8.0 BIN_DIR=/usr/local/bin sh install.sh
set -eu

INSTALL_URL="${INSTALL_URL:-https://github.com/fintanislost/kadai/releases/latest/download}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"

# 1. Detect OS.
case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  MINGW*|MSYS*|CYGWIN*) os=windows ;;
  *) echo "kadai install: unsupported OS $(uname -s)" >&2; exit 1 ;;
esac

# 2. Detect arch.
case "$(uname -m)" in
  x86_64|amd64) arch=x64 ;;
  arm64|aarch64) arch=arm64 ;;
  *) echo "kadai install: unsupported arch $(uname -m)" >&2; exit 1 ;;
esac

# 3. Compose binary name + URL.
suffix=""
[ "$os" = "windows" ] && suffix=".exe"
binary="kadai-${os}-${arch}${suffix}"
url="${INSTALL_URL}/${binary}"

echo "kadai install: downloading $binary"
echo "  from: $url"
echo "  to:   $BIN_DIR/kadai${suffix}"

mkdir -p "$BIN_DIR"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# Support file:// for tests + plain http(s) for real installs.
case "$url" in
  file://*)
    cp "${url#file://}" "$tmp"
    ;;
  *)
    if command -v curl > /dev/null 2>&1; then
      curl -fsSL "$url" -o "$tmp"
    elif command -v wget > /dev/null 2>&1; then
      wget -qO "$tmp" "$url"
    else
      echo "kadai install: need curl or wget" >&2
      exit 1
    fi
    ;;
esac

chmod +x "$tmp"
mv "$tmp" "$BIN_DIR/kadai${suffix}"
trap - EXIT

echo ""
echo "✅ kadai installed at $BIN_DIR/kadai${suffix}"
case ":$PATH:" in
  *:"$BIN_DIR":*) ;;
  *) echo "⚠ $BIN_DIR is not on your \$PATH. Add to your shell rc:"
     echo "    export PATH=\"$BIN_DIR:\$PATH\""
     ;;
esac
