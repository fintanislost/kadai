# Installation

Kadai ships as a single self-contained binary. Pick the installation method that fits your environment.

> **Status:** the install script and Homebrew formula are templates ready to use against real GitHub Releases. Until releases are published, install from source (the last option).

## curl (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/fintanislost/kadai/main/scripts/install.sh | sh
```

Detects your OS + arch, downloads the matching binary from GitHub Releases, drops it into `~/.local/bin/kadai`. Override the destination with `BIN_DIR=/usr/local/bin sh install.sh`.

## Homebrew (macOS / Linux)

```bash
brew install fintanislost/tap/kadai
```

The formula at [`scripts/Formula/kadai.rb`](../../scripts/Formula/kadai.rb) is the template. Submit to a tap or homebrew-core to enable.

## npm (requires Bun runtime)

```bash
npm install -g kadai
```

Kadai's CLI runs on the [Bun](https://bun.sh) runtime (the `bin` shebang is `#!/usr/bin/env bun`). Install Bun first if you don't have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

## From source (any platform with Bun)

```bash
git clone https://github.com/fintanislost/kadai.git
cd kadai
bun install
bun run build:web
bun link    # exposes the `kadai` command
```

Or build a self-contained binary:

```bash
bun run build      # writes dist/kadai (your host's OS/arch)
bun run build:all  # writes dist/kadai-{platform}-{arch} for all 5 targets
```

## Verify

```bash
kadai --version
kadai --help
```

Then bootstrap a project: see [getting-started.md](getting-started.md).
