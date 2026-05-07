import { test, expect } from 'bun:test';
import { parseCassetteLine } from '../../src/cassette/recorder';

test('parseCassetteLine reads new kind:cli format', () => {
  const line = '{"kind":"cli","argv":["init","-y"],"exit":0}';
  const entry = parseCassetteLine(line);
  expect(entry.kind).toBe('cli');
  if (entry.kind === 'cli') {
    expect(entry.argv).toEqual(['init', '-y']);
    expect(entry.exit).toBe(0);
  }
});

test('parseCassetteLine reads new kind:mcp format', () => {
  const line = '{"kind":"mcp","tool":"create_epic","args":{"title":"Auth","phase":"mvp"},"ok":true}';
  const entry = parseCassetteLine(line);
  expect(entry.kind).toBe('mcp');
  if (entry.kind === 'mcp') {
    expect(entry.tool).toBe('create_epic');
    expect(entry.args).toEqual({ title: 'Auth', phase: 'mvp' });
    expect(entry.ok).toBe(true);
  }
});

test('parseCassetteLine treats legacy lines (no kind, has argv) as kind:cli', () => {
  const legacy = '{"argv":["init","-y"],"exit":0}';
  const entry = parseCassetteLine(legacy);
  expect(entry.kind).toBe('cli');
  if (entry.kind === 'cli') {
    expect(entry.argv).toEqual(['init', '-y']);
  }
});

test('parseCassetteLine throws on malformed line', () => {
  expect(() => parseCassetteLine('{ not json')).toThrow();
  expect(() => parseCassetteLine('{"random":"object"}')).toThrow(/cassette/i);
});

test('MUTATING_MCP_TOOLS includes the expected mutating tools', async () => {
  const { MUTATING_MCP_TOOLS } = await import('../../src/cassette/recorder');
  expect(MUTATING_MCP_TOOLS.has('create_epic')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('create_feature')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('create_story')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('create_task')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('attach_spec')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('attach_plan')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('pick_story')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('unpick')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('set_status')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('record_change')).toBe(true);
  // Reads should NOT be in the set
  expect(MUTATING_MCP_TOOLS.has('list_epics')).toBe(false);
  expect(MUTATING_MCP_TOOLS.has('get_item')).toBe(false);
  expect(MUTATING_MCP_TOOLS.has('search')).toBe(false);
});
