import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-init-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('init creates .kadai/ with config, README, .gitignore, epics dir', () => {
  runInit({ rootDir: tmp, productDescription: 'A test product', skipFirstEpic: true });
  expect(existsSync(join(tmp, '.kadai/config.toml'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai/README.md'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai/.gitignore'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai/epics'))).toBe(true);
});

test('init writes product description to .kadai/README.md', () => {
  runInit({ rootDir: tmp, productDescription: 'My cool app', skipFirstEpic: true });
  const readme = readFileSync(join(tmp, '.kadai/README.md'), 'utf8');
  expect(readme).toContain('My cool app');
});

test('init creates CLAUDE.md with kadai section if missing', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const claude = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  expect(claude).toContain('## Kadai');
});

test('init appends to existing CLAUDE.md without overwriting', () => {
  writeFileSync(join(tmp, 'CLAUDE.md'), '# My Project\n\nExisting content.\n');
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const claude = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  expect(claude).toContain('Existing content');
  expect(claude).toContain('## Kadai');
});

test('init does not duplicate the kadai section on re-run', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const claude = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  const occurrences = claude.match(/## Kadai/g)?.length ?? 0;
  expect(occurrences).toBe(1);
});
