import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { addPhase } from '../../src/cli/phases';
import { comparePhases } from '../../src/core/compare';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-compare-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Billing', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'v1' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Analytics', phase: 'v1' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('comparePhases returns items in each phase + common titles', () => {
  const r = comparePhases(tmp, 'mvp', 'v1');
  expect(r.a.phase).toBe('mvp');
  expect(r.b.phase).toBe('v1');
  const aTitles = r.a.items.map(i => i.title).sort();
  const bTitles = r.b.items.map(i => i.title).sort();
  expect(aTitles).toEqual(['Auth', 'Billing']);
  expect(bTitles).toEqual(['Analytics', 'Auth']);
  expect(r.common.titles).toEqual(['Auth']);
});

test('comparePhases includes all kinds (not just epics)', () => {
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'v1', parent: 'EPIC-003' });
  const r = comparePhases(tmp, 'mvp', 'v1');
  expect(r.a.items.some(i => i.kind === 'feature' && i.title === 'Login')).toBe(true);
  expect(r.common.titles).toContain('Login');
});

test('comparePhases throws if either phase does not exist', () => {
  expect(() => comparePhases(tmp, 'mvp', 'nonexistent')).toThrow(/not found/i);
  expect(() => comparePhases(tmp, 'nonexistent', 'mvp')).toThrow(/not found/i);
});

test('comparePhases returns empty arrays when phases exist but contain no items', () => {
  addPhase(tmp, 'parking', 'Parking', '#888888');
  const r = comparePhases(tmp, 'mvp', 'parking');
  expect(r.a.items.length).toBeGreaterThan(0);
  expect(r.b.items.length).toBe(0);
  expect(r.common.titles).toEqual([]);
});
