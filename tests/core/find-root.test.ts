import { test, expect, beforeEach, afterEach } from 'bun:test';
import { findKadaiRoot } from '../../src/core/find-root';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-find-root-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('findKadaiRoot returns null when no .kadai/ in tree', () => {
  expect(findKadaiRoot(tmp)).toBeNull();
});

test('findKadaiRoot returns the dir containing .kadai/', () => {
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
  expect(findKadaiRoot(tmp)).toBe(tmp);
});

test('findKadaiRoot walks up from a nested directory', () => {
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
  const nested = join(tmp, 'a', 'b', 'c');
  mkdirSync(nested, { recursive: true });
  expect(findKadaiRoot(nested)).toBe(tmp);
});

test('findKadaiRoot stops at filesystem root if not found', () => {
  const nested = join(tmp, 'a', 'b', 'c');
  mkdirSync(nested, { recursive: true });
  expect(findKadaiRoot(nested)).toBeNull();
});
