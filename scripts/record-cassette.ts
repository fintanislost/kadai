#!/usr/bin/env bun
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeSpine } from '../src/cassette/snapshot';

const KADAI_CLI = join(__dirname, '../src/cli/index.ts');

function usage(): never {
  process.stderr.write('Usage: bun scripts/record-cassette.ts <scenario-name> "<claude prompt>"\n');
  process.exit(1);
}

const [, , name, prompt] = process.argv;
if (!name || !prompt) usage();
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  process.stderr.write(`Invalid scenario name "${name}": use lowercase letters, digits, hyphens.\n`);
  process.exit(1);
}

const cassetteDir = join(__dirname, '..', 'tests', 'cassettes', name);
if (existsSync(cassetteDir)) {
  process.stderr.write(`Cassette "${name}" already exists at ${cassetteDir}.\nDelete it first if you want to re-record.\n`);
  process.exit(1);
}

// Verify claude + kadai are on PATH
try { execFileSync('which', ['claude'], { stdio: 'pipe' }); } catch { process.stderr.write('`claude` is not on PATH — install Claude Code first.\n'); process.exit(1); }

const tmp = mkdtempSync(join(tmpdir(), `kadai-record-${name}-`));
const cassettePath = join(tmp, 'calls.jsonl');

console.log(`Recording cassette "${name}"`);
console.log(`  Working dir: ${tmp}`);
console.log(`  Cassette path: ${cassettePath}`);

try {
  // 1. kadai init in the temp dir.
  console.log(`Step 1: kadai init -y`);
  execFileSync('bun', [KADAI_CLI, 'init', '-y'], {
    cwd: tmp,
    env: { ...process.env, KADAI_RECORD_TO: cassettePath },
    stdio: 'inherit',
  });

  // 2. Run claude -p with the prompt. Stream stdout so the user can see progress.
  console.log(`Step 2: claude -p "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
  console.log(`(this can take 5-10 minutes — real model calls)`);
  execFileSync('claude', ['-p', prompt], {
    cwd: tmp,
    env: { ...process.env, KADAI_RECORD_TO: cassettePath },
    stdio: 'inherit',
    timeout: 15 * 60 * 1000,  // 15 min hard cap
  });

  // 3. Snapshot the resulting spine.
  console.log(`Step 3: snapshot .kadai/`);
  const snapshot = serializeSpine(tmp);

  // 4. Write both files into tests/cassettes/<name>/.
  console.log(`Step 4: writing cassette to ${cassetteDir}`);
  mkdirSync(cassetteDir, { recursive: true });
  copyFileSync(cassettePath, join(cassetteDir, 'calls.jsonl'));
  writeFileSync(join(cassetteDir, 'spine.snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');

  // 5. Print summary.
  const callCount = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean).length;
  const snapKeyCount = Object.keys(snapshot).length;
  console.log(`\n✓ Cassette recorded:`);
  console.log(`    ${callCount} CLI call(s) captured`);
  console.log(`    ${snapKeyCount} spine file(s) snapshotted`);
  console.log(`\nNext: review tests/cassettes/${name}/, then commit it.`);
  console.log(`The replay test will pick it up automatically on next \`bun test\`.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
