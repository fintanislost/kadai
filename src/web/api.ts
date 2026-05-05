import { walkSpine, findById } from '../core/spine';
import { loadConfig } from '../config/load';
import { readPicked } from '../core/picked';
import type { Item } from '../core/types';
import type { ItemKind, Status } from '../core/state-machine';

function filterItems(
  items: Item[],
  kind: ItemKind,
  filters: { phase?: string; status?: Status; parent?: string },
): Item[] {
  return items.filter(item => {
    if (item.kind !== kind) return false;
    const d = item.data as Record<string, unknown>;
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

  const itemMatch = path.match(/^\/api\/items\/(.+)$/);
  if (itemMatch) {
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
