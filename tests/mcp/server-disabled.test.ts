import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../src/mcp/registry';
import { registerCreateTools } from '../../src/mcp/handlers/creates';
import { setDisabled } from '../../src/core/toggle';
import { MUTATING_MCP_TOOLS } from '../../src/mcp/mutating-tools';

function seedSpine(root: string): void {
  mkdirSync(join(root, '.kadai/epics'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":0,"feature":0,"story":0,"task":0}');
  writeFileSync(
    join(root, '.kadai/config.toml'),
    '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n',
  );
}

test('MUTATING_MCP_TOOLS contract — server-disabled.test depends on this set', () => {
  expect(MUTATING_MCP_TOOLS.has('create_epic')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('list_epics')).toBe(false);
});

// The actual dispatch-handler test is best run via the helper exposed below
// (server.ts factors out the guard so we can test it without spinning up the transport).
// For now we test the conditions that matter: disabled flag + mutating-tool-set membership.

test('isDisabled gate fires for create_epic when disabled', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-disabled-'));
  try {
    seedSpine(root);
    _resetRegistry();
    registerCreateTools();
    setDisabled(root, 'test');
    // The guard logic: server.ts dispatches only when !isDisabled || !MUTATING_MCP_TOOLS.has(name)
    const tool = getTool('create_epic');
    expect(tool).toBeTruthy();
    expect(MUTATING_MCP_TOOLS.has('create_epic')).toBe(true);
    // We don't invoke server transport here; the dispatch test in tests/cli/run.integration.test.ts
    // pattern would be needed for a true e2e. For server.ts, factor the guard into a testable helper:
    const { shouldRefuseMcpCall } = require('../../src/mcp/server');
    expect(shouldRefuseMcpCall('create_epic', root)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('isDisabled gate does NOT fire for list_epics when disabled (reads are fine)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-disabled-'));
  try {
    seedSpine(root);
    setDisabled(root, 'test');
    const { shouldRefuseMcpCall } = require('../../src/mcp/server');
    expect(shouldRefuseMcpCall('list_epics', root)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('isDisabled gate does NOT fire when not disabled (any tool)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-disabled-'));
  try {
    seedSpine(root);
    const { shouldRefuseMcpCall } = require('../../src/mcp/server');
    expect(shouldRefuseMcpCall('create_epic', root)).toBe(false);
    expect(shouldRefuseMcpCall('list_epics', root)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
