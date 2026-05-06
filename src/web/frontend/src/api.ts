import type { Item, PhaseConfig, Status, ItemKind } from './types';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export async function listPhases(): Promise<PhaseConfig[]> {
  return get<PhaseConfig[]>('/api/phases');
}

export async function listEpics(filters: { phase?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/epics${qs ? '?' + qs : ''}`);
}

export async function listFeatures(filters: { epic_id?: string; phase?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/features${qs ? '?' + qs : ''}`);
}

export async function listStories(filters: { feature_id?: string; phase?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/stories${qs ? '?' + qs : ''}`);
}

export async function listTasks(filters: { story_id?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/tasks${qs ? '?' + qs : ''}`);
}

export async function getItem(id: string): Promise<Item | null> {
  const r = await fetch(`/api/items/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/api/items/${id} → ${r.status}`);
  return r.json() as Promise<Item>;
}

export async function getPicked(): Promise<Item | null> {
  return get<Item | null>('/api/picked');
}

export async function getFile(id: string, filename: 'spec.md' | 'plan.md' | 'changelog.md'): Promise<string | null> {
  const r = await fetch(`/api/files/${id}/${filename}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/api/files/${id}/${filename} → ${r.status}`);
  return r.text();
}

export interface Transitions {
  current: Status;
  allowed: Status[];
}

export async function getTransitions(id: string): Promise<Transitions | null> {
  const r = await fetch(`/api/items/${id}/transitions`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/api/items/${id}/transitions → ${r.status}`);
  return r.json() as Promise<Transitions>;
}

export async function setItemStatus(id: string, status: Status): Promise<Item> {
  const r = await fetch(`/api/items/${id}/status`, {
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

export async function attachFile(id: string, kind: 'spec' | 'plan', file: File): Promise<Item> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const r = await fetch(`/api/items/${id}/attach`, { method: 'POST', body: form });
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

export async function searchSpine(query: string): Promise<SearchResult[]> {
  const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<SearchResult[]>;
}
