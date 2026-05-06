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

test('init creates .mcp.json with kadai server entry if missing', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const mcpPath = join(tmp, '.mcp.json');
  expect(existsSync(mcpPath)).toBe(true);
  const json = JSON.parse(readFileSync(mcpPath, 'utf8'));
  expect(json.mcpServers?.kadai?.command).toBe('kadai');
  expect(json.mcpServers?.kadai?.args).toEqual(['mcp']);
});

test('init merges into existing .mcp.json without overwriting other servers', () => {
  const mcpPath = join(tmp, '.mcp.json');
  writeFileSync(mcpPath, JSON.stringify({
    mcpServers: { other: { command: 'foo', args: [] } },
  }, null, 2));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const json = JSON.parse(readFileSync(mcpPath, 'utf8'));
  expect(json.mcpServers.other?.command).toBe('foo');
  expect(json.mcpServers.kadai?.command).toBe('kadai');
});

test('init re-run does not duplicate kadai entry', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const mcpPath = join(tmp, '.mcp.json');
  const json = JSON.parse(readFileSync(mcpPath, 'utf8'));
  expect(Object.keys(json.mcpServers).filter(k => k === 'kadai').length).toBe(1);
});

test('init creates .claude/settings.json with kadai hook entries if missing', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const settingsPath = join(tmp, '.claude/settings.json');
  expect(existsSync(settingsPath)).toBe(true);
  const json = JSON.parse(readFileSync(settingsPath, 'utf8'));
  expect(json.hooks?.PreToolUse).toBeDefined();
  expect(json.hooks?.PostToolUse).toBeDefined();
  const preCmds = json.hooks.PreToolUse.flatMap((entry: any) =>
    entry.hooks?.map((h: any) => h.command) ?? []);
  expect(preCmds).toContain('kadai hook pre-tool-use');
  const postCmds = json.hooks.PostToolUse.flatMap((entry: any) =>
    entry.hooks?.map((h: any) => h.command) ?? []);
  expect(postCmds).toContain('kadai hook post-tool-use');
});

test('init merges into existing .claude/settings.json without overwriting other hooks', () => {
  const settingsPath = join(tmp, '.claude/settings.json');
  require('node:fs').mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify({
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'other-hook' }] },
      ],
    },
  }, null, 2));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const json = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const allPreCmds = json.hooks.PreToolUse.flatMap((entry: any) =>
    entry.hooks?.map((h: any) => h.command) ?? []);
  expect(allPreCmds).toContain('other-hook');
  expect(allPreCmds).toContain('kadai hook pre-tool-use');
});

test('init re-run does not duplicate kadai hook entries', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const settingsPath = join(tmp, '.claude/settings.json');
  const json = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const preCmds = json.hooks.PreToolUse.flatMap((entry: any) =>
    entry.hooks?.map((h: any) => h.command) ?? []);
  const kadaiPreCount = preCmds.filter((c: string) => c === 'kadai hook pre-tool-use').length;
  expect(kadaiPreCount).toBe(1);
});

test('runInit + runAdd produces a usable spine (the path -y will take after Task 2)', () => {
  // This documents the new --yes behavior: the init wizard's epic-creation step
  // is now also taken when --yes is passed (with default title "Project setup").
  // The runInit function itself doesn't create the epic — that's done by the CLI
  // action handler. So this test verifies the building block: runInit + runAdd
  // produce a usable spine.
  const { runAdd } = require('../../src/cli/add');
  runInit({ rootDir: tmp, productDescription: 'Auto', skipFirstEpic: true });
  // The CLI will then call runAdd('epic', ...) when --yes; verify that path works:
  const epicId = runAdd({ rootDir: tmp, kind: 'epic', title: 'Project setup', phase: 'mvp' });
  expect(epicId).toBe('EPIC-001');
});
