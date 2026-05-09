import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendMcpCallToCassette } from '../../src/cassette/recorder';

test('appendMcpCallToCassette writes kind:mcp for a mutating tool', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    const cassettePath = join(root, 'cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      appendMcpCallToCassette({ tool: 'create_epic', args: { title: 'T', phase: 'mvp' }, ok: true });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]) as { kind: string; tool: string; args: unknown; ok: boolean };
    expect(entry.kind).toBe('mcp');
    expect(entry.tool).toBe('create_epic');
    expect(entry.args).toEqual({ title: 'T', phase: 'mvp' });
    expect(entry.ok).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('appendMcpCallToCassette does NOT write for read tools (allowlist filter)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    const cassettePath = join(root, 'cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      appendMcpCallToCassette({ tool: 'list_epics', args: {}, ok: true });
      appendMcpCallToCassette({ tool: 'get_item', args: { id: 'EPIC-001' }, ok: true });
      appendMcpCallToCassette({ tool: 'search', args: { q: 'foo' }, ok: true });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    if (existsSync(cassettePath)) {
      expect(readFileSync(cassettePath, 'utf8').trim()).toBe('');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('appendMcpCallToCassette no-op when KADAI_RECORD_TO unset', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    delete process.env.KADAI_RECORD_TO;
    const cassettePath = join(root, 'cassette.jsonl');
    appendMcpCallToCassette({ tool: 'create_epic', args: { title: 'T' }, ok: true });
    expect(existsSync(cassettePath)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('appendMcpCallToCassette records ok:false on handler failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    const cassettePath = join(root, 'cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      appendMcpCallToCassette({ tool: 'create_epic', args: { title: 'T' }, ok: false });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    const entry = JSON.parse(readFileSync(cassettePath, 'utf8').trim()) as { ok: boolean };
    expect(entry.ok).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
