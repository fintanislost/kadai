import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isDisabled,
  setDisabled,
  clearDisabled,
  getDisabledInfo,
  setGloballyDisabled,
  clearGloballyDisabled,
  isGloballyDisabled,
} from '../../src/core/toggle';

function fresh(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-toggle-'));
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
  return tmp;
}

// All global-disable tests must redirect KADAI_HOME to a temp dir so they
// NEVER touch the real user's ~/.kadai/disabled. (HOME wouldn't work — Bun's
// os.homedir() reads from /etc/passwd, not the env var.)
let savedKadaiHome: string | undefined;
let savedKadaiDisabled: string | undefined;
let tempHome: string | undefined;

beforeEach(() => {
  savedKadaiHome = process.env.KADAI_HOME;
  savedKadaiDisabled = process.env.KADAI_DISABLED;
  tempHome = mkdtempSync(join(tmpdir(), 'kadai-home-'));
  process.env.KADAI_HOME = tempHome;
  delete process.env.KADAI_DISABLED;
});

afterEach(() => {
  if (tempHome) rmSync(tempHome, { recursive: true, force: true });
  if (savedKadaiHome === undefined) delete process.env.KADAI_HOME;
  else process.env.KADAI_HOME = savedKadaiHome;
  if (savedKadaiDisabled === undefined) delete process.env.KADAI_DISABLED;
  else process.env.KADAI_DISABLED = savedKadaiDisabled;
});

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
    expect(info?.scope).toBe('project');
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
    setDisabled(root, 'second');
    const second = getDisabledInfo(root);
    expect(second?.reason).toBe('second');
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
    expect(info?.scope).toBe('project');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// === Global disable ===

test('setGloballyDisabled writes ~/.kadai/disabled; isDisabled then true even outside a project', () => {
  const root = fresh();
  try {
    setGloballyDisabled('focus week');
    expect(isGloballyDisabled()).toBe(true);
    expect(isDisabled(root)).toBe(true);
    expect(existsSync(join(tempHome!, '.kadai/disabled'))).toBe(true);
    const content = readFileSync(join(tempHome!, '.kadai/disabled'), 'utf8');
    expect(content).toContain('reason: focus week');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearGloballyDisabled removes ~/.kadai/disabled', () => {
  const root = fresh();
  try {
    setGloballyDisabled('x');
    clearGloballyDisabled();
    expect(isGloballyDisabled()).toBe(false);
    expect(isDisabled(root)).toBe(false);
    expect(existsSync(join(tempHome!, '.kadai/disabled'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearGloballyDisabled is idempotent', () => {
  expect(() => clearGloballyDisabled()).not.toThrow();
  expect(() => clearGloballyDisabled()).not.toThrow();
});

test('getDisabledInfo with only global disable reports scope=global', () => {
  const root = fresh();
  try {
    setGloballyDisabled('focus');
    const info = getDisabledInfo(root);
    expect(info).not.toBeNull();
    expect(info?.scope).toBe('global');
    expect(info?.reason).toBe('focus');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('getDisabledInfo with both project + global reports scope=both, prefers project metadata', () => {
  const root = fresh();
  try {
    setGloballyDisabled('global reason');
    setDisabled(root, 'project reason');
    const info = getDisabledInfo(root);
    expect(info?.scope).toBe('both');
    expect(info?.reason).toBe('project reason');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// === Env var ===

test('KADAI_DISABLED=1 disables without any file', () => {
  const root = fresh();
  try {
    process.env.KADAI_DISABLED = '1';
    expect(isDisabled(root)).toBe(true);
    expect(isGloballyDisabled()).toBe(true);
    const info = getDisabledInfo(root);
    expect(info?.scope).toBe('env');
    expect(info?.reason).toContain('KADAI_DISABLED');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('KADAI_DISABLED=true also works', () => {
  const root = fresh();
  try {
    process.env.KADAI_DISABLED = 'true';
    expect(isDisabled(root)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('KADAI_DISABLED=0 (or any other value) does NOT disable', () => {
  const root = fresh();
  try {
    process.env.KADAI_DISABLED = '0';
    expect(isDisabled(root)).toBe(false);
    process.env.KADAI_DISABLED = 'false';
    expect(isDisabled(root)).toBe(false);
    process.env.KADAI_DISABLED = '';
    expect(isDisabled(root)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('env var wins over file presence in scope display', () => {
  const root = fresh();
  try {
    setDisabled(root, 'project reason');
    setGloballyDisabled('global reason');
    process.env.KADAI_DISABLED = '1';
    const info = getDisabledInfo(root);
    expect(info?.scope).toBe('env');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearing project does not undo global disable', () => {
  const root = fresh();
  try {
    setDisabled(root, 'p');
    setGloballyDisabled('g');
    clearDisabled(root);
    expect(isDisabled(root)).toBe(true);  // still disabled by global
    expect(getDisabledInfo(root)?.scope).toBe('global');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
