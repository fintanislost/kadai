import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { MUTATING_MCP_TOOLS } from '../mcp/mutating-tools';

export { MUTATING_MCP_TOOLS };  // re-export for back-compat with existing test imports

export type CassetteEntry =
  | { kind: 'cli'; argv: string[]; exit: number }
  | { kind: 'mcp'; tool: string; args: unknown; ok: boolean; files?: Record<string, string> };

export interface CallRecord {
  argv: string[];
  exit: number;
}

export interface McpCallRecord {
  tool: string;
  args: unknown;
  ok: boolean;
  files?: Record<string, string>;
}

// Argument keys whose values are file paths. The recorder snapshots the file's
// contents at call-time and embeds them in the cassette entry, because the
// handler may move/delete the file (attach_spec/attach_plan both do this) and
// at replay time the path otherwise wouldn't exist.
const FILE_PATH_ARG_KEYS = new Set(['source_path']);

export function captureReferencedFiles(args: unknown): Record<string, string> | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const captured: Record<string, string> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (FILE_PATH_ARG_KEYS.has(key) && typeof value === 'string') {
      try {
        if (existsSync(value)) {
          captured[value] = readFileSync(value, 'utf8');
        }
      } catch {
        // Best-effort — if the file is unreadable, don't crash recording.
      }
    }
  }
  return Object.keys(captured).length > 0 ? captured : undefined;
}

// Subcommands that ARE NOT spine-mutating wrapper actions, and therefore
// shouldn't pollute cassettes:
// - hook: Claude Code lifecycle events fire one of these for every Edit/Write
//         the agent makes during the session. Pure noise; replay-incompatible
//         (the hook subcommands read JSON from stdin which isn't there in replay).
// - mcp:  the MCP server launch. Long-running; not a discrete "spine write."
// - serve: the web viewer; long-running; orthogonal to the wrapper.
const NOISE_SUBCOMMANDS = new Set(['hook', 'mcp', 'serve']);


function writeLine(path: string, entry: CassetteEntry): void {
  try {
    appendFileSync(path, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Best-effort — if the cassette file isn't writable, don't crash.
  }
}

export function appendCallToCassette(record: CallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  if (record.argv.length > 0 && NOISE_SUBCOMMANDS.has(record.argv[0])) return;
  writeLine(path, { kind: 'cli', argv: record.argv, exit: record.exit });
}

export function appendMcpCallToCassette(record: McpCallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  if (!MUTATING_MCP_TOOLS.has(record.tool)) return;
  const entry: CassetteEntry = { kind: 'mcp', tool: record.tool, args: record.args, ok: record.ok };
  if (record.files && Object.keys(record.files).length > 0) {
    entry.files = record.files;
  }
  writeLine(path, entry);
}

export function parseCassetteLine(line: string): CassetteEntry {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  // Back-compat: legacy lines (no kind, has argv) → cli.
  if (parsed.kind === undefined && Array.isArray(parsed.argv)) {
    return {
      kind: 'cli',
      argv: parsed.argv as string[],
      exit: typeof parsed.exit === 'number' ? parsed.exit : 0,
    };
  }
  if (parsed.kind === 'cli' && Array.isArray(parsed.argv)) {
    return {
      kind: 'cli',
      argv: parsed.argv as string[],
      exit: typeof parsed.exit === 'number' ? parsed.exit : 0,
    };
  }
  if (parsed.kind === 'mcp' && typeof parsed.tool === 'string') {
    const entry: CassetteEntry = {
      kind: 'mcp',
      tool: parsed.tool,
      args: parsed.args,
      ok: parsed.ok !== false, // default to true if missing
    };
    if (parsed.files && typeof parsed.files === 'object') {
      entry.files = parsed.files as Record<string, string>;
    }
    return entry;
  }
  throw new Error(`malformed cassette line: ${line}`);
}
