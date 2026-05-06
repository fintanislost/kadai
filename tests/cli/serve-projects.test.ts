import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { runRegister, runUnregister, runListProjects } from '../../src/cli/serve-projects';
import { loadKnownProjects } from '../../src/core/projects';

let home: string;
let projectDir: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'kadai-srv-home-'));
  projectDir = mkdtempSync(join(tmpdir(), 'kadai-proj-'));
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
});

test('runRegister adds a project with auto-derived slug from path basename', () => {
  runRegister({ home, rootDir: projectDir });
  const list = loadKnownProjects(home);
  expect(list).toHaveLength(1);
  expect(list[0].slug).toBe(basename(projectDir));
  expect(list[0].rootDir).toBe(projectDir);
});

test('runRegister with explicit --slug and --name overrides', () => {
  runRegister({ home, rootDir: projectDir, slug: 'my-proj', name: 'My Project' });
  const list = loadKnownProjects(home);
  expect(list[0].slug).toBe('my-proj');
  expect(list[0].name).toBe('My Project');
});

test('runRegister throws on duplicate slug', () => {
  runRegister({ home, rootDir: projectDir, slug: 'a' });
  expect(() => runRegister({ home, rootDir: projectDir, slug: 'a' }))
    .toThrow(/already registered/i);
});

test('runUnregister removes an entry', () => {
  runRegister({ home, rootDir: projectDir, slug: 'a' });
  runUnregister({ home, slug: 'a' });
  expect(loadKnownProjects(home)).toEqual([]);
});

test('runListProjects returns the same shape as loadKnownProjects', () => {
  runRegister({ home, rootDir: projectDir, slug: 'a', name: 'Alpha' });
  expect(runListProjects({ home }).map(p => p.slug)).toEqual(['a']);
});
