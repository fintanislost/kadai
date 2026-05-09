import { existsSync, readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Snapshot = Record<string, string>;

const SKIP_FILES = new Set(['runner.json', 'bypass.log']);
// `runner.json` is per-session state, not part of the spine; bypass.log is audit trail.

function walk(dir: string, baseKadai: string, out: Snapshot): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    // lstatSync (not statSync) so we don't follow symlinks. A circular
    // symlink in .kadai/ would otherwise hang the walker. Symlinks aren't
    // a kadai-supported pattern; we just skip them silently.
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      walk(full, baseKadai, out);
    } else if (stat.isFile()) {
      const key = relative(baseKadai, full);
      out[key] = readFileSync(full, 'utf8');
    }
  }
}

export function serializeSpine(rootDir: string): Snapshot {
  const kadaiDir = join(rootDir, '.kadai');
  const out: Snapshot = {};
  walk(kadaiDir, kadaiDir, out);
  return out;
}

// Match an ISO datetime (with time component) inside any quoted string in YAML
// frontmatter, e.g.  updated: "2026-05-07T14:30:00.123Z"  →  "<TIMESTAMP>".
// The timezone marker (Z or +HH:MM offset) is REQUIRED.
const ISO_DATETIME_REGEX = /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})"/g;

// Match a YAML-quoted ISO date string (single OR double quotes).
// Real cassettes capture today's date in created/updated fields (kadai writes
// new Date().toISOString().split('T')[0]), so a cassette recorded one day
// always diverges from a next-day replay if these aren't normalized.
const ISO_DATE_REGEX = /(['"])\d{4}-\d{2}-\d{2}\1/g;

export function normalizeSpine(snap: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const [k, v] of Object.entries(snap)) {
    out[k] = v
      .replace(ISO_DATETIME_REGEX, '"<TIMESTAMP>"')
      .replace(ISO_DATE_REGEX, '$1<DATE>$1');
  }
  return out;
}

export function diffSpines(captured: Snapshot, produced: Snapshot): string | null {
  const a = normalizeSpine(captured);
  const b = normalizeSpine(produced);
  const aKeys = new Set(Object.keys(a));
  const bKeys = new Set(Object.keys(b));
  const issues: string[] = [];
  for (const k of [...aKeys].sort()) {
    if (!bKeys.has(k)) issues.push(`missing: ${k}`);
  }
  for (const k of [...bKeys].sort()) {
    if (!aKeys.has(k)) issues.push(`extra/unexpected: ${k}`);
  }
  for (const k of [...aKeys].sort()) {
    if (!bKeys.has(k)) continue;
    if (a[k] !== b[k]) {
      issues.push(`content mismatch: ${k}\n${formatContentDiff(a[k], b[k])}`);
    }
  }
  return issues.length === 0 ? null : issues.join('\n');
}

function formatContentDiff(expected: string, actual: string): string {
  // Find the first byte that differs.
  const minLen = Math.min(expected.length, actual.length);
  let divergePos = minLen;
  for (let i = 0; i < minLen; i++) {
    if (expected[i] !== actual[i]) { divergePos = i; break; }
  }
  // If they only differ in length (one is a prefix of the other), divergePos = minLen.

  // Show a window of 40 chars before + 60 chars after the divergence.
  const windowStart = Math.max(0, divergePos - 40);
  const windowEnd = divergePos + 60;
  const escape = (s: string) => s.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  const expectedWindow = escape(expected.slice(windowStart, windowEnd));
  const actualWindow = escape(actual.slice(windowStart, windowEnd));

  // Compute the caret position relative to the window for visual alignment.
  const caretOffset = divergePos - windowStart;
  const caretLine = ' '.repeat(caretOffset) + '^';

  return [
    `  divergence at byte ${divergePos} (expected length ${expected.length}, actual length ${actual.length})`,
    `  expected: ${expectedWindow}`,
    `  actual:   ${actualWindow}`,
    `            ${caretLine}`,
  ].join('\n');
}
