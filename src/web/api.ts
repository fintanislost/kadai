import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { walkSpine, findById } from '../core/spine';
import { loadConfig } from '../config/load';
import { readPicked } from '../core/picked';
import { setStatus } from '../core/operations';
import { legalNextStates } from '../core/state-machine';
import type { Item } from '../core/types';
import type { ItemKind, Status } from '../core/state-machine';

function filterItems(
  items: Item[],
  kind: ItemKind,
  filters: { phase?: string; status?: Status; parent?: string },
): Item[] {
  return items.filter(item => {
    if (item.kind !== kind) return false;
    const d = item.data as unknown as Record<string, unknown>;
    if (filters.phase && d.phase !== filters.phase) return false;
    if (filters.status && item.data.status !== filters.status) return false;
    if (filters.parent && d.parent !== filters.parent) return false;
    return true;
  });
}

function readQuery(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  return v ?? undefined;
}

export async function handleApi(req: Request, rootDir: string): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/api/phases') {
    return Response.json(loadConfig(rootDir).phases);
  }

  if (path === '/api/epics') {
    return Response.json(filterItems(walkSpine(rootDir), 'epic', {
      phase: readQuery(url, 'phase'),
      status: readQuery(url, 'status') as Status | undefined,
    }));
  }

  if (path === '/api/features') {
    return Response.json(filterItems(walkSpine(rootDir), 'feature', {
      phase: readQuery(url, 'phase'),
      status: readQuery(url, 'status') as Status | undefined,
      parent: readQuery(url, 'epic_id'),
    }));
  }

  if (path === '/api/stories') {
    return Response.json(filterItems(walkSpine(rootDir), 'story', {
      phase: readQuery(url, 'phase'),
      status: readQuery(url, 'status') as Status | undefined,
      parent: readQuery(url, 'feature_id'),
    }));
  }

  if (path === '/api/tasks') {
    return Response.json(filterItems(walkSpine(rootDir), 'task', {
      status: readQuery(url, 'status') as Status | undefined,
      parent: readQuery(url, 'story_id'),
    }));
  }

  const fileMatch = path.match(/^\/api\/files\/([A-Z]+-\d+)\/([a-z.]+)$/);
  if (fileMatch) {
    const [, id, filename] = fileMatch;
    if (!['spec.md', 'plan.md', 'changelog.md'].includes(filename)) {
      return new Response('Forbidden', { status: 403 });
    }
    const item = findById(rootDir, id);
    if (!item) return new Response('Not found', { status: 404 });
    const itemDir = dirname(item.path);
    const filePath = join(itemDir, filename);
    if (!existsSync(filePath)) return new Response('Not found', { status: 404 });
    const content = readFileSync(filePath, 'utf8');
    return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const transitionsMatch = path.match(/^\/api\/items\/([A-Z]+-\d+)\/transitions$/);
  if (transitionsMatch && req.method === 'GET') {
    const item = findById(rootDir, transitionsMatch[1]);
    if (!item) return new Response('Not found', { status: 404 });
    return Response.json({
      current: item.data.status,
      allowed: legalNextStates(item.kind, item.data.status),
    });
  }

  const statusMatch = path.match(/^\/api\/items\/([A-Z]+-\d+)\/status$/);
  if (statusMatch && req.method === 'POST') {
    const id = statusMatch[1];
    let body: { status?: string };
    try {
      body = await req.json() as { status?: string };
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body.status || typeof body.status !== 'string') {
      return Response.json({ error: 'Missing required field: status' }, { status: 400 });
    }
    const item = findById(rootDir, id);
    if (!item) return Response.json({ error: `Item not found: ${id}` }, { status: 404 });
    try {
      setStatus(rootDir, id, body.status as Status);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json({ error: msg }, { status: 400 });
    }
    const updated = findById(rootDir, id);
    return Response.json(updated);
  }

  const itemMatch = path.match(/^\/api\/items\/(.+)$/);
  if (itemMatch && req.method === 'GET') {
    const item = findById(rootDir, itemMatch[1]);
    if (!item) return new Response('Not found', { status: 404 });
    return Response.json(item);
  }

  if (path === '/api/picked') {
    const id = readPicked(rootDir);
    if (!id) return Response.json(null);
    return Response.json(findById(rootDir, id));
  }

  return new Response('Not found', { status: 404 });
}
