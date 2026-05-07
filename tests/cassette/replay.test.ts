import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeSpine, diffSpines, type Snapshot } from '../../src/cassette/snapshot';

const CASSETTES_DIR = join(__dirname, '../cassettes');
const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function listCassettes(): string[] {
  if (!existsSync(CASSETTES_DIR)) return [];
  return readdirSync(CASSETTES_DIR).filter(name => {
    const dir = join(CASSETTES_DIR, name);
    return statSync(dir).isDirectory()
      && existsSync(join(dir, 'calls.jsonl'))
      && existsSync(join(dir, 'spine.snapshot.json'));
  });
}

const cassettes = listCassettes();

if (cassettes.length === 0) {
  test('no cassettes recorded yet — see scripts/record-cassette.ts', () => {
    // Sentinel test that always passes when there are no cassettes.
    expect(cassettes.length).toBe(0);
  });
}

for (const name of cassettes) {
  test(`cassette: ${name}`, () => {
    const cassetteDir = join(CASSETTES_DIR, name);
    const calls = readFileSync(join(cassetteDir, 'calls.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as { argv: string[]; exit: number });
    const captured = JSON.parse(readFileSync(join(cassetteDir, 'spine.snapshot.json'), 'utf8')) as Snapshot;

    const tmp = mkdtempSync(join(tmpdir(), `kadai-cass-${name}-`));
    try {
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        let actualExit = 0;
        try {
          execFileSync('bun', [KADAI_CLI, ...call.argv], { cwd: tmp, stdio: 'pipe' });
        } catch (e) {
          actualExit = (e as { status?: number }).status ?? 1;
        }
        if (actualExit !== call.exit) {
          throw new Error(`call ${i} (${JSON.stringify(call.argv)}): captured exit ${call.exit}, replay got ${actualExit}`);
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
  }, 60 * 1000);  // 60s per cassette is generous; most should run in <10s
}
