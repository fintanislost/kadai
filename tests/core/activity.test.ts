import { test, expect, beforeEach, afterEach } from 'bun:test';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { buildActivity, parseChangelogEntries } from '../../src/core/activity';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-activity-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function appendEntry(itemId: string, line: string): void {
  const item = findById(tmp, itemId)!;
  const path = join(dirname(item.path), 'changelog.md');
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, line + '\n', 'utf8');
}

test('parseChangelogEntries handles all three line shapes', () => {
  const text = [
    '- 2026-05-06T10:00:00Z `Write` src/foo.ts',
    '- 2026-05-06T11:00:00Z `commit` abc1234 feat: do thing STORY-001',
    '- 2026-05-06T12:00:00Z `note` Decided to defer OAuth.',
  ].join('\n');
  const entries = parseChangelogEntries(text);
  expect(entries).toHaveLength(3);
  expect(entries[0].kind).toBe('Write');
  expect(entries[0].payload).toBe('src/foo.ts');
  expect(entries[1].kind).toBe('commit');
  expect(entries[1].payload).toContain('abc1234');
  expect(entries[2].kind).toBe('note');
  expect(entries[2].payload).toBe('Decided to defer OAuth.');
});

test('parseChangelogEntries skips malformed lines without crashing', () => {
  const text = '- 2026-05-06T10:00:00Z `Write` src/foo.ts\nthis is not a valid line\n- bad-date `note` x';
  const entries = parseChangelogEntries(text);
  expect(entries.length).toBeGreaterThanOrEqual(1);
  expect(entries[0].payload).toBe('src/foo.ts');
});

test('buildActivity aggregates across the spine, newest first', () => {
  appendEntry('STORY-001', '- 2026-05-06T10:00:00Z `Write` src/old.ts');
  appendEntry('FEAT-001', '- 2026-05-06T12:00:00Z `commit` abc1234 feat thing');
  appendEntry('STORY-001', '- 2026-05-06T11:00:00Z `note` mid-priority');

  const feed = buildActivity(tmp);
  expect(feed.length).toBe(3);
  expect(feed[0].ts).toBe('2026-05-06T12:00:00Z');
  expect(feed[0].itemId).toBe('FEAT-001');
  expect(feed[1].ts).toBe('2026-05-06T11:00:00Z');
  expect(feed[2].ts).toBe('2026-05-06T10:00:00Z');
});

test('buildActivity respects limit parameter', () => {
  for (let i = 0; i < 5; i++) {
    const t = String(i).padStart(2, '0');
    appendEntry('STORY-001', `- 2026-05-06T${t}:00:00Z \`note\` entry-${i}`);
  }
  const feed = buildActivity(tmp, { limit: 3 });
  expect(feed.length).toBe(3);
  expect(feed[0].payload).toBe('entry-4');
});
