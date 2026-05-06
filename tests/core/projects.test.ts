import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadKnownProjects,
  saveKnownProjects,
  registerProject,
  unregisterProject,
} from '../../src/core/projects';

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'kadai-proj-home-'));
});
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

test('loadKnownProjects returns empty list when file missing', () => {
  expect(loadKnownProjects(home)).toEqual([]);
});

test('saveKnownProjects writes JSON + creates ~/.kadai if needed', () => {
  saveKnownProjects(home, [{ slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' }]);
  const text = readFileSync(join(home, '.kadai', 'known-projects.json'), 'utf8');
  expect(JSON.parse(text)).toEqual({
    projects: [{ slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' }],
  });
});

test('loadKnownProjects round-trips after save', () => {
  saveKnownProjects(home, [{ slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' }]);
  expect(loadKnownProjects(home)).toEqual([
    { slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' },
  ]);
});

test('registerProject appends a new entry', () => {
  registerProject(home, { slug: 'a', name: 'Alpha', rootDir: '/path/a' });
  registerProject(home, { slug: 'b', name: 'Beta', rootDir: '/path/b' });
  const list = loadKnownProjects(home);
  expect(list.map(p => p.slug)).toEqual(['a', 'b']);
  expect(list[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('registerProject throws on duplicate slug', () => {
  registerProject(home, { slug: 'a', name: 'A', rootDir: '/path/a' });
  expect(() => registerProject(home, { slug: 'a', name: 'A2', rootDir: '/path/a2' }))
    .toThrow(/already registered|duplicate/i);
});

test('unregisterProject removes an entry; throws on unknown slug', () => {
  registerProject(home, { slug: 'a', name: 'A', rootDir: '/path/a' });
  unregisterProject(home, 'a');
  expect(loadKnownProjects(home)).toEqual([]);
  expect(() => unregisterProject(home, 'nonexistent')).toThrow(/not registered|not found/i);
});

test('loadKnownProjects ignores malformed JSON gracefully', () => {
  mkdirSync(join(home, '.kadai'), { recursive: true });
  writeFileSync(join(home, '.kadai', 'known-projects.json'), '{garbage}');
  expect(loadKnownProjects(home)).toEqual([]);
});
