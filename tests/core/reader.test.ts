import { test, expect, beforeEach, afterEach } from 'bun:test';
import { readItem } from '../../src/core/reader';
import { writeFileAtomic } from '../../src/core/files';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-reader-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('readItem parses a valid epic file', () => {
  const path = join(tmp, 'epic.md');
  writeFileAtomic(path, `---
id: EPIC-001
title: Authentication
status: ready
phase: mvp
order: 10
created: 2026-05-05
updated: 2026-05-05
---

## Description
Auth stuff.
`);
  const item = readItem(path);
  expect(item.kind).toBe('epic');
  expect(item.data.id).toBe('EPIC-001');
  expect(item.data.title).toBe('Authentication');
  expect(item.body).toContain('Auth stuff');
});

test('readItem throws on missing id', () => {
  const path = join(tmp, 'broken.md');
  writeFileAtomic(path, '---\ntitle: No ID\n---\n');
  expect(() => readItem(path)).toThrow(/Missing id/);
});

test('readItem throws on invalid id format', () => {
  const path = join(tmp, 'broken.md');
  writeFileAtomic(path, '---\nid: BAD-FORMAT\ntitle: x\n---\n');
  expect(() => readItem(path)).toThrow(/Invalid id/);
});

test('readItem throws on schema violation', () => {
  const path = join(tmp, 'broken.md');
  writeFileAtomic(path, `---
id: EPIC-001
title: x
status: bogus_status
phase: mvp
order: 10
created: 2026-05-05
updated: 2026-05-05
---
`);
  expect(() => readItem(path)).toThrow();
});
