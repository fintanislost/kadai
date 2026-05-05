import { test, expect, beforeEach, afterEach } from 'bun:test';
import { readPicked, setPicked, clearPicked } from '../../src/core/picked';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-picked-'));
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('readPicked returns null when no file exists', () => {
  expect(readPicked(tmp)).toBeNull();
});

test('setPicked + readPicked roundtrip', () => {
  setPicked(tmp, 'STORY-042');
  expect(readPicked(tmp)).toBe('STORY-042');
});

test('clearPicked removes the file', () => {
  setPicked(tmp, 'STORY-042');
  clearPicked(tmp);
  expect(readPicked(tmp)).toBeNull();
});

test('setPicked rejects non-story IDs', () => {
  expect(() => setPicked(tmp, 'EPIC-001')).toThrow(/only stories can be picked/i);
});
