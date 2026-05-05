import { test, expect, beforeEach, afterEach } from 'bun:test';
import { listPhases, addPhase, removePhase, renamePhase } from '../../src/cli/phases';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-phases-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('listPhases returns the default phases', () => {
  const slugs = listPhases(tmp).map(p => p.slug);
  expect(slugs).toEqual(['mvp', 'v1', 'future', 'parking-lot']);
});

test('addPhase appends a new phase', () => {
  addPhase(tmp, 'v2', 'v2.0', '#ff0000');
  const slugs = listPhases(tmp).map(p => p.slug);
  expect(slugs).toContain('v2');
});

test('addPhase rejects duplicate slug', () => {
  expect(() => addPhase(tmp, 'mvp', 'X', '#000')).toThrow(/already exists/i);
});

test('removePhase removes a phase', () => {
  removePhase(tmp, 'parking-lot');
  expect(listPhases(tmp).map(p => p.slug)).not.toContain('parking-lot');
});

test('removePhase throws for unknown slug', () => {
  expect(() => removePhase(tmp, 'nonexistent')).toThrow(/not found/i);
});

test('renamePhase changes display and slug', () => {
  renamePhase(tmp, 'v1', 'v1-rebrand', 'V1 Rebrand');
  const found = listPhases(tmp).find(p => p.slug === 'v1-rebrand');
  expect(found?.display).toBe('V1 Rebrand');
});
