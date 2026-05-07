import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Snapshot = Record<string, string>;

const SKIP_FILES = new Set(['runner.json', 'bypass.log']);
// `runner.json` is per-session state, not part of the spine; bypass.log is audit trail.

function walk(dir: string, baseKadai: string, out: Snapshot): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, baseKadai, out);
    } else {
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

// Match an ISO datetime (with time component) inside any quoted string in YAML frontmatter,
// e.g.  updated: "2026-05-07T14:30:00.123Z"  →  updated: "<TIMESTAMP>"
// Date-only strings ("2026-05-07") are intentionally NOT matched.
const ISO_DATETIME_REGEX = /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?"/g;

export function normalizeSpine(snap: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const [k, v] of Object.entries(snap)) {
    out[k] = v.replace(ISO_DATETIME_REGEX, '"<TIMESTAMP>"');
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
      // Provide the path + a short hint about the divergence position.
      const aShort = a[k].slice(0, 80).replace(/\n/g, '\\n');
      const bShort = b[k].slice(0, 80).replace(/\n/g, '\\n');
      issues.push(`content mismatch: ${k}\n  expected: ${aShort}\n  actual:   ${bShort}`);
    }
  }
  return issues.length === 0 ? null : issues.join('\n');
}
