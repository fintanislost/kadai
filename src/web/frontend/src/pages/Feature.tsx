import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { getItem, listStories } from '../api';
import { EmptyState } from '../components/EmptyState';
import { KanbanBoard } from '../components/KanbanBoard';
import { KindIcon } from '../components/KindIcon';
import { Markdown } from '../components/Markdown';
import { SkeletonStack } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { Item, Status } from '../types';
import { BookOpen, FileQuestion } from 'lucide-react';

export function Feature() {
  // useParams without `from` to support both /features/$id and /p/$slug/features/$id
  const params = useParams({ strict: false }) as { id?: string; slug?: string };
  const id = params.id ?? '';
  const [feature, setFeature] = useState<Item | null>(null);
  const [stories, setStories] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getItem(id, activeSlug), listStories({ feature_id: id }, activeSlug)])
      .then(([f, s]) => { setFeature(f); setStories(s); })
      .finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !feature) return <SkeletonStack rows={4} />;
  if (!feature) return <EmptyState icon={FileQuestion} title="Feature not found" hint={`No feature with ID ${id} exists.`} />;
  const d = feature.data as { id: string; title: string; phase: string; status: string; parent: string };

  return (
    <div className="space-y-6">
      <div>
        <ProjectScopedLink activeSlug={activeSlug} to="/epics/$id" params={{ id: d.parent }} className="text-xs text-muted hover:text-zinc-300">← back to {d.parent}</ProjectScopedLink>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span>{d.id} · phase {d.phase}</span>
          <StatusBadge status={d.status as Status} />
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <KindIcon kind="feature" size={20} />
          {d.title}
        </h1>
      </div>

      {feature.body && (
        <div className="bg-panel rounded p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Description</h2>
          <Markdown>{feature.body}</Markdown>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">Stories</h2>
        {stories.length === 0 ? (
          <EmptyState icon={BookOpen} title="No stories yet" hint={`Add one with \`kadai add story --feature ${id}\``} />
        ) : (
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
        )}
      </div>
    </div>
  );
}
