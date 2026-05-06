import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { renamePhase, removePhase } from '../../src/cli/phases';
import { loadConfig } from '../../src/config/load';
import { getPhase } from '../../src/core/item-helpers';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-phases-mig-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('renamePhase rewrites all items with the old phase slug', () => {
  renamePhase(tmp, 'mvp', 'beta', 'Beta');
  const cfg = loadConfig(tmp);
  expect(cfg.phases.find(p => p.slug === 'beta')?.display).toBe('Beta');
  expect(cfg.phases.find(p => p.slug === 'mvp')).toBeUndefined();
  expect(getPhase(findById(tmp, 'EPIC-001')!)).toBe('beta');
  expect(getPhase(findById(tmp, 'FEAT-001')!)).toBe('beta');
  expect(getPhase(findById(tmp, 'STORY-001')!)).toBe('beta');
});

test('removePhase refuses when items reference the phase and no --move-to is given', () => {
  expect(() => removePhase(tmp, 'mvp')).toThrow(/items.*reference.*mvp|move-to/i);
});

test('removePhase succeeds when no items reference the phase', () => {
  // 'v1' is in DEFAULT_CONFIG but no items reference it.
  expect(() => removePhase(tmp, 'v1')).not.toThrow();
  expect(loadConfig(tmp).phases.find(p => p.slug === 'v1')).toBeUndefined();
});

test('removePhase with moveTo migrates items and removes the phase', () => {
  removePhase(tmp, 'mvp', { moveTo: 'v1' });
  expect(loadConfig(tmp).phases.find(p => p.slug === 'mvp')).toBeUndefined();
  expect(getPhase(findById(tmp, 'EPIC-001')!)).toBe('v1');
  expect(getPhase(findById(tmp, 'FEAT-001')!)).toBe('v1');
  expect(getPhase(findById(tmp, 'STORY-001')!)).toBe('v1');
});

test('removePhase with moveTo errors when the target phase does not exist', () => {
  expect(() => removePhase(tmp, 'mvp', { moveTo: 'nonexistent' })).toThrow(/target.*not found|does not exist/i);
});
