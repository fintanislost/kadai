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

import { mkdtempSync, writeFileSync, rmSync as _rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pjoin } from 'node:path';
import { captureReferencedFiles } from '../../src/cassette/recorder';

test('captureReferencedFiles snapshots source_path file contents', () => {
  const tmp = mkdtempSync(pjoin(tmpdir(), 'kadai-cap-'));
  try {
    const specPath = pjoin(tmp, 'spec.md');
    writeFileSync(specPath, '# Hello\nbody\n', 'utf8');
    const captured = captureReferencedFiles({ feature_id: 'FEAT-001', source_path: specPath });
    expect(captured).toEqual({ [specPath]: '# Hello\nbody\n' });
  } finally { _rmSync(tmp, { recursive: true, force: true }); }
});

test('captureReferencedFiles returns undefined when no source_path arg', () => {
  expect(captureReferencedFiles({ id: 'STORY-001' })).toBeUndefined();
  expect(captureReferencedFiles({})).toBeUndefined();
  expect(captureReferencedFiles(null)).toBeUndefined();
  expect(captureReferencedFiles('not an object')).toBeUndefined();
});

test('captureReferencedFiles skips source_path when file does not exist', () => {
  const captured = captureReferencedFiles({ source_path: '/nonexistent/file/path.md' });
  expect(captured).toBeUndefined();
});

test('parseCassetteLine round-trips files field', () => {
  const line = '{"kind":"mcp","tool":"attach_spec","args":{"feature_id":"FEAT-001","source_path":"/tmp/spec.md"},"ok":true,"files":{"/tmp/spec.md":"# Body\\n"}}';
  const entry = parseCassetteLine(line);
  expect(entry.kind).toBe('mcp');
  if (entry.kind === 'mcp') {
    expect(entry.files).toEqual({ '/tmp/spec.md': '# Body\n' });
  }
});

test('parseCassetteLine handles MCP entries without files field (back-compat)', () => {
  const line = '{"kind":"mcp","tool":"create_epic","args":{"title":"X"},"ok":true}';
  const entry = parseCassetteLine(line);
  expect(entry.kind).toBe('mcp');
  if (entry.kind === 'mcp') {
    expect(entry.files).toBeUndefined();
  }
});
