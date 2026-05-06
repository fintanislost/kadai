import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { walkSpine } from './spine';
import { getId, getTitle } from './item-helpers';
import type { Item } from './types';

export type ChangelogKind = 'Write' | 'Edit' | 'commit' | 'note' | 'other';

export interface ActivityEntry {
  ts: string;
  kind: ChangelogKind;
  payload: string;
  itemId: string;
  itemTitle: string;
  itemKind: Item['kind'];
}

export interface BuildActivityOptions {
  limit?: number;
}

const LINE_RE = /^- (\d{4}-\d{2}-\d{2}T[\d:.+\-]+Z?)\s+`([^`]+)`\s+(.*)$/;

export function parseChangelogEntries(text: string): Array<{ ts: string; kind: ChangelogKind; payload: string }> {
  const out: Array<{ ts: string; kind: ChangelogKind; payload: string }> = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, ts, rawKind, payload] = m;
    const kind: ChangelogKind = rawKind === 'Write' || rawKind === 'Edit' || rawKind === 'commit' || rawKind === 'note'
      ? rawKind
      : 'other';
    out.push({ ts, kind, payload });
  }
  return out;
}

export function buildActivity(rootDir: string, opts: BuildActivityOptions = {}): ActivityEntry[] {
  const items = walkSpine(rootDir);
  const all: ActivityEntry[] = [];

  for (const item of items) {
    const path = join(dirname(item.path), 'changelog.md');
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const entry of parseChangelogEntries(text)) {
      all.push({
        ...entry,
        itemId: getId(item),
        itemTitle: getTitle(item),
        itemKind: item.kind,
      });
    }
  }

  all.sort((a, b) => b.ts.localeCompare(a.ts));

  if (opts.limit !== undefined) return all.slice(0, opts.limit);
  return all;
}
