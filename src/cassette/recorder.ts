import { appendFileSync } from 'node:fs';

export interface CallRecord {
  argv: string[];
  exit: number;
}

// Subcommands that ARE NOT spine-mutating wrapper actions, and therefore
// shouldn't pollute cassettes:
// - hook: Claude Code lifecycle events fire one of these for every Edit/Write
//         the agent makes during the session. Pure noise; replay-incompatible
//         (the hook subcommands read JSON from stdin which isn't there in replay).
// - mcp:  the MCP server launch. Long-running; not a discrete "spine write."
// - serve: the web viewer; long-running; orthogonal to the wrapper.
const NOISE_SUBCOMMANDS = new Set(['hook', 'mcp', 'serve']);

export function appendCallToCassette(record: CallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  if (record.argv.length > 0 && NOISE_SUBCOMMANDS.has(record.argv[0])) return;
  try {
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Best-effort — if the cassette file isn't writable, don't crash the CLI.
  }
}
