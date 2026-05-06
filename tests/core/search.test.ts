import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { searchSpine, makeSnippet } from '../../src/core/search';
import { findById } from '../../src/core/spine';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-search-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Email login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Magic link delivery', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('makeSnippet: short text returns the full text', () => {
  const r = makeSnippet('hello world', 'world');
  expect(r.snippet).toBe('hello world');
  expect(r.matchStart).toBe(6);
  expect(r.matchEnd).toBe(11);
});

test('makeSnippet: long text returns ~80 chars around the match with ellipses', () => {
  const text = 'a'.repeat(100) + ' MATCH ' + 'b'.repeat(100);
  const r = makeSnippet(text, 'MATCH');
  expect(r.snippet.length).toBeLessThanOrEqual(90);  // ~80 + ellipses
  expect(r.snippet).toContain('MATCH');
  expect(r.snippet.startsWith('…')).toBe(true);
  expect(r.snippet.endsWith('…')).toBe(true);
  expect(r.snippet.slice(r.matchStart, r.matchEnd).toLowerCase()).toBe('match');
});

test('makeSnippet: case-insensitive match locates the original-case substring', () => {
  const r = makeSnippet('Hello World', 'WORLD');
  expect(r.snippet.slice(r.matchStart, r.matchEnd)).toBe('World');
});

test('makeSnippet: missing match returns first 80 chars with offsets at 0', () => {
  const r = makeSnippet('hello world', 'absent');
  expect(r.snippet).toBe('hello world');
  expect(r.matchStart).toBe(0);
  expect(r.matchEnd).toBe(0);
});

test('searchSpine: matches an item title (matchType=title)', () => {
  const results = searchSpine(tmp, 'Authentication');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('EPIC-001');
  expect(results[0].matchType).toBe('title');
  expect(results[0].snippet).toBe('Authentication');
});

test('searchSpine: matches body content of an item', () => {
  // Append body content directly to STORY-001's file.
  const story = findById(tmp, 'STORY-001')!;
  const original = readFileSync(story.path, 'utf8');
  writeFileSync(story.path, original + '\n\nThe magic-link email is sent via SES with a signed token.\n');

  const results = searchSpine(tmp, 'SES');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('STORY-001');
  expect(results[0].matchType).toBe('body');
  expect(results[0].snippet).toContain('SES');
});

test('searchSpine: case-insensitive matching', () => {
  const results = searchSpine(tmp, 'authentication');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('EPIC-001');
});

test('searchSpine: empty query returns empty list', () => {
  expect(searchSpine(tmp, '')).toEqual([]);
});

test('searchSpine: 1-char query returns empty list (min length is 2)', () => {
  expect(searchSpine(tmp, 'a')).toEqual([]);
});

test('searchSpine: title matches sort before body matches', () => {
  // STORY-001's title already contains "Magic". Add a second story whose body mentions Magic.
  runAdd({ rootDir: tmp, kind: 'story', title: 'Other story', phase: 'mvp', parent: 'FEAT-001' });
  const story2 = findById(tmp, 'STORY-002')!;
  const original = readFileSync(story2.path, 'utf8');
  writeFileSync(story2.path, original + '\n\nWe also need a Magic feature here.\n');

  const results = searchSpine(tmp, 'Magic');
  expect(results.length).toBe(2);
  expect(results[0].matchType).toBe('title');
  expect(results[0].id).toBe('STORY-001');
  expect(results[1].matchType).toBe('body');
  expect(results[1].id).toBe('STORY-002');
});

test('searchSpine: result includes phase + status + kind for downstream rendering', () => {
  const results = searchSpine(tmp, 'Email');
  expect(results.length).toBe(1);
  expect(results[0].kind).toBe('feature');
  expect(results[0].phase).toBe('mvp');
  expect(results[0].status).toBe('ready');
});
