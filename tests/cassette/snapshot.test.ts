import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeSpine, normalizeSpine, diffSpines, type Snapshot } from '../../src/cassette/snapshot';

function seedMinimalSpine(root: string) {
  mkdirSync(join(root, '.kadai/epics/EPIC-001-x'), { recursive: true });
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n');
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\ncreated: "2026-05-07"\nupdated: "2026-05-07T14:30:00.123Z"\norder: 1\n---\n# Body\n');
}

test('serializeSpine returns a flat object with .kadai/-relative paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-snap-'));
  try {
    seedMinimalSpine(root);
    const snap = serializeSpine(root);
    expect(Object.keys(snap)).toContain('config.toml');
    expect(Object.keys(snap)).toContain('.counters.json');
    expect(Object.keys(snap)).toContain('epics/EPIC-001-x/epic.md');
    expect(snap['config.toml']).toContain('allowed_paths');
    expect(snap['epics/EPIC-001-x/epic.md']).toContain('id: EPIC-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('serializeSpine returns empty snapshot when .kadai/ does not exist', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-snap-'));
  try {
    const snap = serializeSpine(root);
    expect(snap).toEqual({});
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('serializeSpine includes picked file when present', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-snap-'));
  try {
    seedMinimalSpine(root);
    writeFileSync(join(root, '.kadai/picked'), 'STORY-001');
    const snap = serializeSpine(root);
    expect(snap['picked']).toBe('STORY-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normalizeSpine replaces ISO timestamps with <TIMESTAMP> placeholder', () => {
  const snap: Snapshot = {
    'epics/EPIC-001/epic.md': 'updated: "2026-05-07T14:30:00.123Z"\nother: foo\n',
    'epics/EPIC-001/feature.md': 'updated: "2026-05-07T14:30:00Z"\n',
  };
  const normalized = normalizeSpine(snap);
  expect(normalized['epics/EPIC-001/epic.md']).toContain('updated: "<TIMESTAMP>"');
  expect(normalized['epics/EPIC-001/epic.md']).not.toContain('14:30:00');
  expect(normalized['epics/EPIC-001/epic.md']).toContain('other: foo');  // non-timestamp content preserved
  expect(normalized['epics/EPIC-001/feature.md']).toContain('updated: "<TIMESTAMP>"');
});

test('normalizeSpine preserves date-only YYYY-MM-DD fields (those are deterministic)', () => {
  const snap: Snapshot = { 'epics/E/epic.md': 'created: "2026-05-07"\nupdated: "2026-05-07"\n' };
  const normalized = normalizeSpine(snap);
  // Date-only strings are deterministic given a known seeded date — only ISO datetimes get replaced.
  expect(normalized['epics/E/epic.md']).toBe('created: "2026-05-07"\nupdated: "2026-05-07"\n');
});

test('diffSpines returns null when snapshots are identical after normalization', () => {
  const a: Snapshot = { 'config.toml': '[g]\n', 'epics/E/epic.md': 'updated: "2026-05-07T14:30:00Z"\n' };
  const b: Snapshot = { 'config.toml': '[g]\n', 'epics/E/epic.md': 'updated: "2026-05-07T16:45:11.000Z"\n' };
  expect(diffSpines(a, b)).toBeNull();
});

test('diffSpines surfaces missing keys with a clear message', () => {
  const a: Snapshot = { 'config.toml': 'x', 'epics/E/epic.md': 'y' };
  const b: Snapshot = { 'config.toml': 'x' };
  const diff = diffSpines(a, b);
  expect(diff).not.toBeNull();
  expect(diff!).toContain('epics/E/epic.md');
  expect(diff!).toMatch(/missing/i);
});

test('diffSpines surfaces extra keys with a clear message', () => {
  const a: Snapshot = { 'config.toml': 'x' };
  const b: Snapshot = { 'config.toml': 'x', 'epics/E/epic.md': 'y' };
  const diff = diffSpines(a, b);
  expect(diff).not.toBeNull();
  expect(diff!).toContain('epics/E/epic.md');
  expect(diff!).toMatch(/extra|unexpected/i);
});

test('diffSpines surfaces content mismatch with the path + a hint', () => {
  const a: Snapshot = { 'epics/E/epic.md': 'title: Original' };
  const b: Snapshot = { 'epics/E/epic.md': 'title: Different' };
  const diff = diffSpines(a, b);
  expect(diff).not.toBeNull();
  expect(diff!).toContain('epics/E/epic.md');
});
