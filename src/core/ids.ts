import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ItemKind } from './state-machine';

const COUNTERS_FILE = '.counters.json';

const PREFIX: Record<ItemKind, string> = {
  epic: 'EPIC',
  feature: 'FEAT',
  story: 'STORY',
  task: 'TASK',
};

const PREFIX_TO_KIND: Record<string, ItemKind> = {
  EPIC: 'epic',
  FEAT: 'feature',
  STORY: 'story',
  TASK: 'task',
};

type Counters = Record<ItemKind, number>;

function counterPath(rootDir: string): string {
  return join(rootDir, '.kadai', COUNTERS_FILE);
}

function readCounters(rootDir: string): Counters {
  const path = counterPath(rootDir);
  if (!existsSync(path)) {
    return { epic: 0, feature: 0, story: 0, task: 0 };
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Counters;
}

function writeCounters(rootDir: string, counters: Counters): void {
  const path = counterPath(rootDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(counters, null, 2) + '\n', 'utf8');
}

export function nextId(kind: ItemKind, rootDir: string): string {
  const counters = readCounters(rootDir);
  counters[kind] += 1;
  writeCounters(rootDir, counters);
  return formatId(kind, counters[kind]);
}

export function formatId(kind: ItemKind, n: number): string {
  return `${PREFIX[kind]}-${String(n).padStart(3, '0')}`;
}

export function parseId(id: string): { kind: ItemKind; n: number } | null {
  const m = id.match(/^(EPIC|FEAT|STORY|TASK)-(\d+)$/);
  if (!m) return null;
  return { kind: PREFIX_TO_KIND[m[1]], n: parseInt(m[2], 10) };
}
