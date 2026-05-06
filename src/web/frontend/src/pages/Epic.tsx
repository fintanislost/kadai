import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { getItem, listFeatures } from '../api';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { Item } from '../types';
import { Box, FileQuestion } from 'lucide-react';

export function Epic() {
  // useParams without `from` to support both /epics/$id and /p/$slug/epics/$id
  const params = useParams({ strict: false }) as { id?: string; slug?: string };
  const id = params.id ?? '';
  const [epic, setEpic] = useState<Item | null>(null);
  const [features, setFeatures] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getItem(id, activeSlug), listFeatures({ epic_id: id }, activeSlug)])
      .then(([e, f]) => { setEpic(e); setFeatures(f); })
      .finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !epic) return <SkeletonStack rows={4} />;
  if (!epic) return <EmptyState icon={FileQuestion} title="Epic not found" hint={`No epic with ID ${id} exists.`} />;
  const d = epic.data as { id: string; title: string; phase: string; status: string };

  return (
    <div className="space-y-6">
      <div>
        <ProjectScopedLink activeSlug={activeSlug} to="/" className="text-xs text-muted hover:text-zinc-300">← back to roadmap</ProjectScopedLink>
        <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
        <h1 className="text-2xl font-bold">{d.title}</h1>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">Features</h2>
        {features.length === 0 ? (
          <EmptyState icon={Box} title="No features yet" hint={`Add one with \`kadai add feature --epic ${id}\``} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.sort((a, b) => ((a.data as any).order ?? 0) - ((b.data as any).order ?? 0)).map(f => {
              const fd = f.data as { id: string; title: string; status: string };
              return (
                <ProjectScopedLink
                  key={fd.id}
                  activeSlug={activeSlug}
                  to="/features/$id"
                  params={{ id: fd.id }}
                  className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500"
                >
                  <div className="text-xs text-muted">{fd.id}</div>
                  <div className="font-medium">{fd.title}</div>
                  <div className="mt-1 text-xs"><span className="bg-zinc-800 px-2 py-0.5 rounded">{fd.status}</span></div>
                </ProjectScopedLink>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
