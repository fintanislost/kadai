import { test, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileAtomic } from '../../src/core/files';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-files-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('writeFileAtomic writes file', () => {
  const path = join(tmp, 'sub', 'file.txt');
  writeFileAtomic(path, 'hello');
  expect(readFileSync(path, 'utf8')).toBe('hello');
});

test('writeFileAtomic creates intermediate directories', () => {
  const path = join(tmp, 'a', 'b', 'c', 'file.txt');
  writeFileAtomic(path, 'data');
  expect(existsSync(path)).toBe(true);
});

test('writeFileAtomic does not leave temp files', () => {
  writeFileAtomic(join(tmp, 'file.txt'), 'data');
  const files = readdirSync(tmp);
  expect(files.filter(f => f.endsWith('.tmp'))).toEqual([]);
});

test('writeFileAtomic overwrites existing file', () => {
  const path = join(tmp, 'file.txt');
  writeFileAtomic(path, 'first');
  writeFileAtomic(path, 'second');
  expect(readFileSync(path, 'utf8')).toBe('second');
});
