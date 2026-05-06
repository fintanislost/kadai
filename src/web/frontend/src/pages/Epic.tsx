import { useEffect, useState } from 'react';
import { Link, useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { getItem, getFile, listFeatures, getTransitions, setItemStatus, type Transitions } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { Hero } from '../components/Hero';
import { Card } from '../components/Card';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { TreeView } from '../components/TreeView';
import { StatusBadge } from '../components/StatusBadge';
import { KindIcon } from '../components/KindIcon';
import { IdPill } from '../components/IdPill';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { Box, FileQuestion } from 'lucide-react';
import type { Item, Status } from '../types';

export function Epic() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();

  const [epic, setEpic] = useState<Item | null>(null);
  const [features, setFeatures] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Transitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listFeatures({ epic_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getTransitions(id, activeSlug),
    ]).then(([e, f, sp, tr]) => {
      setEpic(e); setFeatures(f); setSpec(sp); setTransitions(tr);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !epic) return <SkeletonStack rows={6} />;
  if (!epic) return <EmptyState icon={FileQuestion} title="Epic not found" hint={`No epic with ID ${id} exists.`} />;

  const d = epic.data as { id: string; title: string; phase?: string; status: Status };
  const counts = {
    done: features.filter(f => f.data.status === 'done').length,
    inProgress: features.filter(f => f.data.status === 'in_progress').length,
    ready: features.filter(f => f.data.status === 'ready').length,
  };

  const allowed = transitions?.allowed ?? [];
  const primaryAction: Status | null =
    allowed.includes('review') ? 'review' :
    allowed.includes('in_progress') ? 'in_progress' :
    allowed.includes('done') ? 'done' :
    allowed[0] ?? null;

  const crumbs: Crumb[] = [
    { label: 'All epics', to: '/', toMulti: '/p/$slug/', params: {} },
  ];

  const showTree = search.view === 'tree';

  async function move(target: Status) {
    if (!epic) return;
    const previous = (epic.data as { status: Status }).status;
    setEpic(prev => prev ? { ...prev, data: { ...prev.data, status: target } } : prev);
    try {
      await setItemStatus(id, target, activeSlug);
      getTransitions(id, activeSlug).then(setTransitions);
    } catch {
      setEpic(prev => prev ? { ...prev, data: { ...prev.data, status: previous } } : prev);
    }
  }

  return (
    <div className="space-y-7 max-w-[1200px] mx-auto px-4">
      <Breadcrumb crumbs={crumbs} current={d.id} activeSlug={activeSlug} />

      <Hero
        kind="epic"
        id={d.id}
        title={d.title}
        status={d.status}
        phase={d.phase}
        progress={features.length > 0 ? {
          done: counts.done, inProgress: counts.inProgress, ready: counts.ready,
          total: features.length, label: 'Features',
        } : undefined}
        actions={primaryAction && (
          <button
            onClick={() => move(primaryAction)}
            className="bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg text-[13px] hover:bg-[#99f6e4] transition-colors"
          >Mark {primaryAction.replace('_', ' ')}</button>
        )}
        viewToggle={
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-[3px]">
            {[{k: undefined, l: 'Detail'}, {k: 'tree' as const, l: 'Tree'}].map(opt => (
              <button
                key={opt.l}
                onClick={() => navigate({ to: '.', search: { view: opt.k } as never })}
                className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${(search.view as string | undefined) === opt.k ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >{opt.l}</button>
            ))}
          </div>
        }
      />

      {showTree ? (
        <Card title="Subtree" count={`rooted at ${d.id}`}>
          <div className="p-4"><TreeView rootId={d.id} currentId={d.id} /></div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            {epic.body && (
              <Card title="Description">
                <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                  <Markdown>{epic.body}</Markdown>
                </div>
              </Card>
            )}

            <Card title="Features" count={`${counts.done} / ${features.length} done`}>
              {features.length === 0 ? (
                <EmptyState icon={Box} title="No features yet" hint={`Add one with \`kadai add feature --epic ${id}\``} />
              ) : features.map(f => {
                const fd = f.data as { id: string; title: string; status: Status };
                return (
                  <div key={fd.id} className="px-5 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    {activeSlug ? (
                      <Link to="/p/$slug/features/$id" params={{ slug: activeSlug, id: fd.id }} className="flex items-center gap-4">
                        <KindIcon kind="feature" size={14} />
                        <IdPill id={fd.id} />
                        <span className="flex-1 text-[13.5px]">{fd.title}</span>
                        <StatusBadge status={fd.status} />
                      </Link>
                    ) : (
                      <Link to="/features/$id" params={{ id: fd.id }} className="flex items-center gap-4">
                        <KindIcon kind="feature" size={14} />
                        <IdPill id={fd.id} />
                        <span className="flex-1 text-[13.5px]">{fd.title}</span>
                        <StatusBadge status={fd.status} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Documents">
              <DocumentRow kind="spec" attached={!!spec} meta={spec ? `${spec.split(/\n/).filter(Boolean).length} lines` : undefined} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
