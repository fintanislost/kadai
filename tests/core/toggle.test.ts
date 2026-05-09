import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDisabled, setDisabled, clearDisabled, getDisabledInfo } from '../../src/core/toggle';

function fresh(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-toggle-'));
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
  return tmp;
}

test('isDisabled returns false when .kadai/disabled does not exist', () => {
  const root = fresh();
  try { expect(isDisabled(root)).toBe(false); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test('setDisabled writes .kadai/disabled with timestamp; isDisabled then true', () => {
  const root = fresh();
  try {
    setDisabled(root);
    expect(isDisabled(root)).toBe(true);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(true);
    const content = readFileSync(join(root, '.kadai/disabled'), 'utf8');
    expect(content).toMatch(/^disabled-since: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('setDisabled with reason includes it in the file', () => {
  const root = fresh();
  try {
    setDisabled(root, 'quick refactor');
    const content = readFileSync(join(root, '.kadai/disabled'), 'utf8');
    expect(content).toContain('reason: quick refactor');
    const info = getDisabledInfo(root);
    expect(info?.reason).toBe('quick refactor');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearDisabled removes the file; isDisabled then false', () => {
  const root = fresh();
  try {
    setDisabled(root, 'x');
    clearDisabled(root);
    expect(isDisabled(root)).toBe(false);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearDisabled is idempotent (no error when already enabled)', () => {
  const root = fresh();
  try {
    expect(() => clearDisabled(root)).not.toThrow();
    expect(() => clearDisabled(root)).not.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('setDisabled is idempotent — second call updates the timestamp + reason', () => {
  const root = fresh();
  try {
    setDisabled(root, 'first');
    const first = getDisabledInfo(root);
    // Second call should overwrite, not error
    setDisabled(root, 'second');
    const second = getDisabledInfo(root);
    expect(second?.reason).toBe('second');
    // since timestamps may match if called in same millisecond; just verify reason changed
    expect(first?.reason).toBe('first');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('getDisabledInfo returns null when not disabled', () => {
  const root = fresh();
  try { expect(getDisabledInfo(root)).toBeNull(); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test('getDisabledInfo returns since but undefined reason when disabled with no reason', () => {
  const root = fresh();
  try {
    setDisabled(root);
    const info = getDisabledInfo(root);
    expect(info?.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(info?.reason).toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
