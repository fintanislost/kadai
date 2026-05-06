import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { getItem, listStories } from '../api';
import { KanbanBoard } from '../components/KanbanBoard';
import { Markdown } from '../components/Markdown';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { Item, Status } from '../types';

export function Feature() {
  // useParams without `from` to support both /features/$id and /p/$slug/features/$id
  const params = useParams({ strict: false }) as { id?: string; slug?: string };
  const id = params.id ?? '';
  const [feature, setFeature] = useState<Item | null>(null);
  const [stories, setStories] = useState<Item[]>([]);
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    if (!id) return;
    getItem(id, activeSlug).then(setFeature);
    listStories({ feature_id: id }, activeSlug).then(setStories);
  }, [id, liveKey, activeSlug]);

  if (!feature) return <div className="text-muted">Loading or not found…</div>;
  const d = feature.data as { id: string; title: string; phase: string; status: string; parent: string };

  return (
    <div className="space-y-6">
      <div>
        <ProjectScopedLink activeSlug={activeSlug} to="/epics/$id" params={{ id: d.parent }} className="text-xs text-muted hover:text-zinc-300">← back to {d.parent}</ProjectScopedLink>
        <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
        <h1 className="text-2xl font-bold">{d.title}</h1>
      </div>

      {feature.body && (
        <div className="bg-panel rounded p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Description</h2>
          <Markdown>{feature.body}</Markdown>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">Stories</h2>
        <KanbanBoard
          stories={stories}
          activeSlug={activeSlug}
          onLocalStatusChange={(storyId: string, newStatus: Status) =>
            setStories(prev => prev.map(s =>
              (s.data as any).id === storyId
                ? { ...s, data: { ...s.data, status: newStatus } }
                : s
            ))
          }
        />
      </div>
    </div>
  );
}
