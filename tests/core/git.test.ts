import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCommits } from '../../src/core/git';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-git-'));
  execSync('git init -q -b main', { cwd: tmp });
  execSync('git config user.email "test@example.com"', { cwd: tmp });
  execSync('git config user.name "Test"', { cwd: tmp });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function commit(cwd: string, subject: string, body?: string): string {
  writeFileSync(join(cwd, 'f-' + Date.now() + Math.random() + '.txt'), 'x');
  execSync('git add -A', { cwd });
  const msg = body ? `${subject}\n\n${body}` : subject;
  execFileSync('git', ['commit', '-q', '-m', msg], { cwd });
  return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
}

test('listCommits returns [] when there are no commits', () => {
  expect(listCommits(tmp)).toEqual([]);
});

test('listCommits returns one commit with correct fields', () => {
  const sha = commit(tmp, 'feat: hello world');
  const commits = listCommits(tmp);
  expect(commits.length).toBe(1);
  expect(commits[0].sha).toBe(sha);
  expect(commits[0].subject).toBe('feat: hello world');
  expect(commits[0].body).toBe('');
  expect(commits[0].dateIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('listCommits parses multi-line body without truncation', () => {
  commit(tmp, 'feat: thing', 'Line one.\n\nLine two.\n\nReferences STORY-042.');
  const c = listCommits(tmp)[0];
  expect(c.body).toContain('Line one.');
  expect(c.body).toContain('Line two.');
  expect(c.body).toContain('STORY-042');
});

test('listCommits returns commits in newest-first order (matches git log default)', () => {
  const sha1 = commit(tmp, 'first');
  const sha2 = commit(tmp, 'second');
  const sha3 = commit(tmp, 'third');
  const commits = listCommits(tmp);
  expect(commits.map(c => c.sha)).toEqual([sha3, sha2, sha1]);
});

test('listCommits with --since limits the range', () => {
  commit(tmp, 'before');
  execSync('git tag boundary', { cwd: tmp });
  const sha2 = commit(tmp, 'after');
  const filtered = listCommits(tmp, { since: 'boundary' });
  expect(filtered.map(c => c.sha)).toEqual([sha2]);
});

test('listCommits returns [] when rootDir is not a git repo', () => {
  const notRepo = mkdtempSync(join(tmpdir(), 'kadai-notgit-'));
  try {
    expect(listCommits(notRepo)).toEqual([]);
  } finally {
    rmSync(notRepo, { recursive: true, force: true });
  }
});

test('listCommits handles a subject containing the field-separator-like sequence', () => {
  commit(tmp, 'feat: "quoted" | piped subject', 'And |body| with chars.');
  const c = listCommits(tmp)[0];
  expect(c.subject).toBe('feat: "quoted" | piped subject');
  expect(c.body).toContain('|body|');
});
