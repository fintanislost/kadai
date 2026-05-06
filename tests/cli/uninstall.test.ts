import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runUninstall } from '../../src/cli/uninstall';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-uninstall-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runUninstall removes the .kadai/ directory by default', () => {
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  runUninstall({ rootDir: tmp, keepSpine: false });
  expect(existsSync(join(tmp, '.kadai'))).toBe(false);
});

test('runUninstall with keepSpine=true preserves .kadai/', () => {
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  runUninstall({ rootDir: tmp, keepSpine: true });
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
});

test('runUninstall removes the kadai entry from .mcp.json (and the file if it becomes empty)', () => {
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
  runUninstall({ rootDir: tmp, keepSpine: false });
  if (existsSync(join(tmp, '.mcp.json'))) {
    const parsed = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
    expect(parsed.mcpServers?.kadai).toBeUndefined();
  }
});

test('runUninstall preserves other MCP servers in .mcp.json', () => {
  const mcp = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
  mcp.mcpServers.other = { command: 'other-tool', args: [] };
  writeFileSync(join(tmp, '.mcp.json'), JSON.stringify(mcp, null, 2) + '\n');

  runUninstall({ rootDir: tmp, keepSpine: false });

  expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
  const after = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
  expect(after.mcpServers.other).toBeDefined();
  expect(after.mcpServers.kadai).toBeUndefined();
});

test('runUninstall removes all 4 kadai hook entries from .claude/settings.json', () => {
  const before = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
  expect(Object.keys(before.hooks).length).toBeGreaterThanOrEqual(4);
  runUninstall({ rootDir: tmp, keepSpine: false });

  if (existsSync(join(tmp, '.claude', 'settings.json'))) {
    const after = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
    for (const event of ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop']) {
      const entries = after.hooks?.[event] ?? [];
      const hasKadai = entries.some((e: { hooks?: Array<{ command?: string }> }) =>
        e.hooks?.some(h => (h.command ?? '').startsWith('kadai hook ')));
      expect(hasKadai).toBe(false);
    }
  }
});

test('runUninstall removes the ## Kadai section from CLAUDE.md', () => {
  const before = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  expect(before).toContain('## Kadai');
  runUninstall({ rootDir: tmp, keepSpine: false });

  if (existsSync(join(tmp, 'CLAUDE.md'))) {
    const after = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
    expect(after).not.toContain('## Kadai');
  }
});
