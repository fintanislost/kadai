# /kadai-disable

Disable kadai in the current project. Hooks no-op, mutating CLI commands error, MCP mutating tools refuse, web viewer shows a DISABLED banner. Reads still work.

## Usage

```
/kadai-disable
/kadai-disable a quick refactor across stories
```

The free-form arg becomes the `--reason` recorded in `.kadai/disabled` for the audit log. Run `kadai enable` (or `/kadai-enable`) to restore.

## What happens

Runs `kadai disable` (with `--reason "$ARGS"` if args present). Restart your Claude Code session for `.mcp.json` changes to take full effect — mid-session hooks already check the flag at every invocation, so they no-op immediately without restart.
