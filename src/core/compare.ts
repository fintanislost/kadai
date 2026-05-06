import { walkSpine } from './spine';
import { loadConfig } from '../config/load';
import { getPhase, getId, getTitle, getStatus } from './item-helpers';
import type { Item } from './types';
import type { Status, ItemKind } from './state-machine';

export interface ComparedItem {
  id: string;
  kind: ItemKind;
  title: string;
  status: Status;
}

export interface ComparedPhase {
  phase: string;
  items: ComparedItem[];
}

export interface CompareResult {
  a: ComparedPhase;
  b: ComparedPhase;
  common: { titles: string[] };
}

function toCompared(item: Item): ComparedItem {
  return {
    id: getId(item),
    kind: item.kind,
    title: getTitle(item),
    status: getStatus(item),
  };
}

function ensurePhaseExists(rootDir: string, slug: string): void {
  const cfg = loadConfig(rootDir);
  if (!cfg.phases.some(p => p.slug === slug)) {
    throw new Error(`Phase "${slug}" not found in config`);
  }
}

export function comparePhases(rootDir: string, aSlug: string, bSlug: string): CompareResult {
  ensurePhaseExists(rootDir, aSlug);
  ensurePhaseExists(rootDir, bSlug);

  const items = walkSpine(rootDir);
  const a = items.filter(i => getPhase(i) === aSlug).map(toCompared);
  const b = items.filter(i => getPhase(i) === bSlug).map(toCompared);

  const aTitles = new Set(a.map(i => i.title));
  const common = b.map(i => i.title).filter(t => aTitles.has(t));
  const uniqueCommon = Array.from(new Set(common)).sort();

  return {
    a: { phase: aSlug, items: a },
    b: { phase: bSlug, items: b },
    common: { titles: uniqueCommon },
  };
}
