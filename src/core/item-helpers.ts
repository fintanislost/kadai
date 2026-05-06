import type { Item } from './types';
import type { Status } from './state-machine';

interface Indexable {
  id?: string;
  title?: string;
  status?: Status;
  phase?: string;
  parent?: string;
  order?: number;
  spec?: string;
  plan?: string;
}

function data(item: Item): Indexable {
  return item.data as unknown as Indexable;
}

export function getId(item: Item): string {
  return data(item).id ?? '';
}

export function getTitle(item: Item): string {
  return data(item).title ?? '';
}

export function getStatus(item: Item): Status {
  return data(item).status ?? 'backlog';
}

export function getPhase(item: Item): string | undefined {
  return data(item).phase;
}

export function getParent(item: Item): string | undefined {
  return data(item).parent;
}

export function getOrder(item: Item): number | undefined {
  return data(item).order;
}

export function getSpec(item: Item): string | undefined {
  return data(item).spec;
}

export function getPlan(item: Item): string | undefined {
  return data(item).plan;
}
