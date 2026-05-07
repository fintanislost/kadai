import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync, lstatSync } from 'node:fs';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeSpine, diffSpines, type Snapshot } from '../../src/cassette/snapshot';
import { parseCassetteLine } from '../../src/cassette/recorder';
import { _resetRegistry, getTool } from '../../src/mcp/registry';
import { registerReadTools } from '../../src/mcp/handlers/reads';
import { registerGetTools } from '../../src/mcp/handlers/get';
import { registerSearchTools } from '../../src/mcp/handlers/search';
import { registerCreateTools } from '../../src/mcp/handlers/creates';
import { registerStatusTools } from '../../src/mcp/handlers/status';
import { registerPickTools } from '../../src/mcp/handlers/picks';
import { registerAttachTools } from '../../src/mcp/handlers/attach';
import { registerRecordChangeTool } from '../../src/mcp/handlers/record-change';

const CASSETTES_DIR = join(__dirname, '../cassettes');
const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

// Register all MCP tools once at module load — same as src/cli/mcp.ts does.
_resetRegistry();
registerReadTools();
registerGetTools();
registerSearchTools();
registerCreateTools();
registerStatusTools();
registerPickTools();
registerAttachTools();
registerRecordChangeTool();

function listCassettes(): string[] {
  if (!existsSync(CASSETTES_DIR)) return [];
  return readdirSync(CASSETTES_DIR).filter(name => {
    const dir = join(CASSETTES_DIR, name);
    const stat = lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
    return existsSync(join(dir, 'calls.jsonl'))
      && existsSync(join(dir, 'spine.snapshot.json'));
  });
}

const cassettes = listCassettes();
const REPLAY_ENV: NodeJS.ProcessEnv = { ...process.env, KADAI_RECORD_TO: '' };

if (cassettes.length === 0) {
  test('no cassettes recorded yet — see scripts/record-cassette.ts', () => {
    expect(cassettes.length).toBe(0);
  });
}

for (const name of cassettes) {
  test(`cassette: ${name}`, async () => {
    const cassetteDir = join(CASSETTES_DIR, name);
    const lines = readFileSync(join(cassetteDir, 'calls.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean);
    const entries = lines.map(parseCassetteLine);
    const captured = JSON.parse(readFileSync(join(cassetteDir, 'spine.snapshot.json'), 'utf8')) as Snapshot;

    const tmp = mkdtempSync(join(tmpdir(), `kadai-cass-${name}-`));
    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.kind === 'cli') {
          let actualExit = 0;
          try {
            execFileSync('bun', [KADAI_CLI, ...entry.argv], { cwd: tmp, stdio: 'pipe', env: REPLAY_ENV });
          } catch (e) {
            actualExit = (e as { status?: number }).status ?? 1;
          }
          if (actualExit !== entry.exit) {
            throw new Error(`[cassette: ${name}] cli call ${i} (${JSON.stringify(entry.argv)}): captured exit ${entry.exit}, replay got ${actualExit}`);
          }
        } else {
          // entry.kind === 'mcp'
          const tool = getTool(entry.tool);
          if (!tool) throw new Error(`[cassette: ${name}] mcp call ${i}: unknown tool "${entry.tool}"`);
          // Materialize any captured source files at their original paths so handlers
          // that read+remove them (attach_spec, attach_plan) work on replay.
          if (entry.files) {
            for (const [path, content] of Object.entries(entry.files)) {
              mkdirSync(dirname(path), { recursive: true });
              writeFileSync(path, content, 'utf8');
            }
          }
          let threw = false;
          try {
            const parsed = tool.inputSchema.parse(entry.args);
            await tool.handler(parsed, { rootDir: tmp });
          } catch (e) {
            threw = true;
            if (entry.ok) {
              throw new Error(`[cassette: ${name}] mcp call ${i} (${entry.tool}): captured ok=true but replay threw: ${(e as Error).message}`);
            }
          }
          if (!threw && !entry.ok) {
            throw new Error(`[cassette: ${name}] mcp call ${i} (${entry.tool}): captured ok=false but replay succeeded`);
          }
        }
      }
      const produced = serializeSpine(tmp);
      const diff = diffSpines(captured, produced);
      if (diff !== null) {
        throw new Error(`cassette "${name}" diverged:\n${diff}`);
      }
      expect(diff).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60 * 1000);
}
