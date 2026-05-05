import type { Item, PhaseConfig } from './types';

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
