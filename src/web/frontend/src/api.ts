import type { Item, PhaseConfig, Status, ItemKind } from './types';
import type { ProjectInfo } from './project';

function withBase(slug: string | null | undefined, path: string): string {
  return slug ? `/api/p/${slug}${path}` : `/api${path}`;
}

export async function listPhases(slug?: string | null): Promise<PhaseConfig[]> {
  const url = withBase(slug, '/phases');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<PhaseConfig[]>;
}

export async function listEpics(filters: { phase?: string; status?: string } = {}, slug?: string | null): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  const url = withBase(slug, `/epics${qs ? '?' + qs : ''}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Item[]>;
}

export async function listFeatures(filters: { epic_id?: string; phase?: string; status?: string } = {}, slug?: string | null): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  const url = withBase(slug, `/features${qs ? '?' + qs : ''}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Item[]>;
}

export async function listStories(filters: { feature_id?: string; phase?: string; status?: string } = {}, slug?: string | null): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  const url = withBase(slug, `/stories${qs ? '?' + qs : ''}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Item[]>;
}

export async function listTasks(filters: { story_id?: string; status?: string } = {}, slug?: string | null): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  const url = withBase(slug, `/tasks${qs ? '?' + qs : ''}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Item[]>;
}

export async function getItem(id: string, slug?: string | null): Promise<Item | null> {
  const url = withBase(slug, `/items/${id}`);
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Item>;
}

export async function getPicked(slug?: string | null): Promise<Item | null> {
  const url = withBase(slug, '/picked');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Item | null>;
}

export async function getFile(id: string, filename: 'spec.md' | 'plan.md' | 'changelog.md', slug?: string | null): Promise<string | null> {
  const url = withBase(slug, `/files/${id}/${filename}`);
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.text();
}

export interface Transitions {
  current: Status;
  allowed: Status[];
}

export async function getTransitions(id: string, slug?: string | null): Promise<Transitions | null> {
  const url = withBase(slug, `/items/${id}/transitions`);
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<Transitions>;
}

export async function setItemStatus(id: string, status: Status, slug?: string | null): Promise<Item> {
  const url = withBase(slug, `/items/${id}/status`);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<Item>;
}

export async function attachFile(id: string, kind: 'spec' | 'plan', file: File, slug?: string | null): Promise<Item> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const url = withBase(slug, `/items/${id}/attach`);
  const r = await fetch(url, { method: 'POST', body: form });
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<Item>;
}

export interface SearchResult {
  id: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  status: Status;
  matchType: 'title' | 'body' | 'acceptance';
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

export async function searchSpine(query: string, slug?: string | null): Promise<SearchResult[]> {
  const url = withBase(slug, `/search?q=${encodeURIComponent(query)}`);
  const r = await fetch(url);
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<SearchResult[]>;
}

export interface ActivityEntry {
  ts: string;
  kind: 'Write' | 'Edit' | 'commit' | 'note' | 'other';
  payload: string;
  itemId: string;
  itemTitle: string;
  itemKind: ItemKind;
}

export async function getActivity(limit = 100, slug?: string | null): Promise<ActivityEntry[]> {
  const url = withBase(slug, `/activity?limit=${limit}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<ActivityEntry[]>;
}

export interface ComparedItem {
  id: string;
  kind: ItemKind;
  title: string;
  status: Status;
}

export interface CompareResult {
  a: { phase: string; items: ComparedItem[] };
  b: { phase: string; items: ComparedItem[] };
  common: { titles: string[] };
}

export async function comparePhasesApi(a: string, b: string, slug?: string | null): Promise<CompareResult> {
  const url = withBase(slug, `/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  const r = await fetch(url);
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<CompareResult>;
}

export async function listProjects(): Promise<ProjectInfo[]> {
  const r = await fetch('/api/projects');
  if (!r.ok) return [];
  return r.json() as Promise<ProjectInfo[]>;
}

export async function getSubtree(id: string, slug?: string | null): Promise<Item[]> {
  const r = await fetch(withBase(slug, `/items/${id}/subtree`));
  if (!r.ok) throw new Error(`/items/${id}/subtree → ${r.status}`);
  return r.json() as Promise<Item[]>;
}

export type DisabledScope = 'project' | 'global' | 'env' | 'both';

export interface DisabledStatus {
  disabled: boolean;
  scope?: DisabledScope;
  since?: string;
  reason?: string;
}

export async function getDisabledStatus(slug?: string | null): Promise<DisabledStatus> {
  const r = await fetch(withBase(slug, '/disabled-status'));
  if (!r.ok) return { disabled: false };  // gracefully degrade
  return r.json() as Promise<DisabledStatus>;
}
