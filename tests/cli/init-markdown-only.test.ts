import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-md-only-'));
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runInit with markdownOnly: true creates .kadai/ but skips MCP/hooks/CLAUDE.md', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true, markdownOnly: true });
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai', 'config.toml'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai', 'README.md'))).toBe(true);
  // Skipped:
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(false);
  expect(existsSync(join(tmp, '.claude', 'settings.json'))).toBe(false);
  expect(existsSync(join(tmp, 'CLAUDE.md'))).toBe(false);
});

test('runInit without markdownOnly (default) installs the full integration', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
  expect(existsSync(join(tmp, '.claude', 'settings.json'))).toBe(true);
  expect(existsSync(join(tmp, 'CLAUDE.md'))).toBe(true);
});

test('runInit markdownOnly is idempotent — re-running does not create the integration', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true, markdownOnly: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true, markdownOnly: true });
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(false);
});
