import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getSubtree } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { StatusBadge } from './StatusBadge';
import { KindIcon } from './KindIcon';
import { IdPill } from './IdPill';
import { SkeletonStack } from './Skeleton';
import { EmptyState } from './EmptyState';
import { FileQuestion } from 'lucide-react';
import type { Item, ItemKind } from '../types';

const ROUTE_BY_KIND: Record<ItemKind, { single: string; multi: string }> = {
  epic:    { single: '/epics/$id',    multi: '/p/$slug/epics/$id'    },
  feature: { single: '/features/$id', multi: '/p/$slug/features/$id' },
  story:   { single: '/stories/$id',  multi: '/p/$slug/stories/$id'  },
  task:    { single: '/stories/$id',  multi: '/p/$slug/stories/$id'  },
};

interface Props {
  rootId: string;
  currentId: string;
}

interface Node {
  item: Item;
  children: Node[];
  depth: number;
}

function buildTree(items: Item[], rootId: string): Node | null {
  const byId = new Map<string, Item>();
  for (const it of items) byId.set((it.data as unknown as { id: string }).id, it);
  const root = byId.get(rootId);
  if (!root) return null;
  const childrenOf = (parentId: string): Item[] =>
    items.filter(it => (it.data as unknown as { parent?: string }).parent === parentId);
  const buildNode = (item: Item, depth: number): Node => {
    const id = (item.data as unknown as { id: string }).id;
    return {
      item,
      depth,
      children: childrenOf(id).map(c => buildNode(c, depth + 1)),
    };
  };
  return buildNode(root, 0);
}

function TreeRow({ node, currentId, activeSlug }: { node: Node; currentId: string; activeSlug: string | null }) {
  const data = node.item.data as unknown as { id: string; title: string; status: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled' };
  const isHere = data.id === currentId;
  const route = ROUTE_BY_KIND[node.item.kind];
  const indent = node.depth * 28;

  const content = (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isHere ? 'bg-accent/[0.10] ring-1 ring-accent/25' : 'hover:bg-white/[0.03]'}`}
      style={{ marginLeft: indent }}
    >
      <KindIcon kind={node.item.kind} size={14} />
      <IdPill id={data.id} />
      <span className={`text-[13.5px] flex-1 text-text-primary ${isHere ? 'font-medium' : ''}`}>{data.title}</span>
      <StatusBadge status={data.status} />
      {isHere && <span className="text-[11px] text-accent ml-2">← here</span>}
    </div>
  );

  const isUnclickable = isHere || node.item.kind === 'task';
  return (
    <>
      {isUnclickable ? content : (
        activeSlug ? (
          <Link to={route.multi as never} params={{ slug: activeSlug, id: data.id } as never} className="block">{content}</Link>
        ) : (
          <Link to={route.single as never} params={{ id: data.id } as never} className="block">{content}</Link>
        )
      )}
      {node.children.map(c => {
        const cid = (c.item.data as unknown as { id: string }).id;
        return <TreeRow key={`${c.item.kind}-${cid}`} node={c} currentId={currentId} activeSlug={activeSlug} />;
      })}
    </>
  );
}

export function TreeView({ rootId, currentId }: Props) {
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSubtree(rootId, activeSlug)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [rootId, activeSlug, liveKey]);

  if (loading && items.length === 0) return <SkeletonStack rows={6} />;
  const tree = buildTree(items, rootId);
  if (!tree) return <EmptyState icon={FileQuestion} title="Subtree empty or unavailable" />;

  return (
    <div className="space-y-1">
      <TreeRow node={tree} currentId={currentId} activeSlug={activeSlug} />
    </div>
  );
}
