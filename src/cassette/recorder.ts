import { appendFileSync } from 'node:fs';

export type CassetteEntry =
  | { kind: 'cli'; argv: string[]; exit: number }
  | { kind: 'mcp'; tool: string; args: unknown; ok: boolean };

export interface CallRecord {
  argv: string[];
  exit: number;
}

export interface McpCallRecord {
  tool: string;
  args: unknown;
  ok: boolean;
}

// Subcommands that ARE NOT spine-mutating wrapper actions, and therefore
// shouldn't pollute cassettes:
// - hook: Claude Code lifecycle events fire one of these for every Edit/Write
//         the agent makes during the session. Pure noise; replay-incompatible
//         (the hook subcommands read JSON from stdin which isn't there in replay).
// - mcp:  the MCP server launch. Long-running; not a discrete "spine write."
// - serve: the web viewer; long-running; orthogonal to the wrapper.
const NOISE_SUBCOMMANDS = new Set(['hook', 'mcp', 'serve']);

// MCP tools that mutate spine state. Source of truth for what gets recorded
// from the MCP server's dispatch path. Reads (list_*, get_*, search) are
// intentionally excluded — they don't need replay because they don't change state.
export const MUTATING_MCP_TOOLS = new Set<string>([
  'create_epic',
  'create_feature',
  'create_story',
  'create_task',
  'attach_spec',
  'attach_plan',
  'pick_story',
  'unpick',
  'set_status',
  'record_change',
]);

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
  writeLine(path, { kind: 'mcp', tool: record.tool, args: record.args, ok: record.ok });
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
    return {
      kind: 'mcp',
      tool: parsed.tool,
      args: parsed.args,
      ok: parsed.ok !== false, // default to true if missing
    };
  }
  throw new Error(`malformed cassette line: ${line}`);
}
