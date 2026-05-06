import { useEffect, useState } from 'react';
import { Link, useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { getItem, getFile, listStories, getTransitions, setItemStatus, type Transitions } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { Hero } from '../components/Hero';
import { Card } from '../components/Card';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { TreeView } from '../components/TreeView';
import { KanbanBoard } from '../components/KanbanBoard';
import { StatusBadge } from '../components/StatusBadge';
import { KindIcon } from '../components/KindIcon';
import { IdPill } from '../components/IdPill';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { BookOpen, FileQuestion } from 'lucide-react';
import type { Item, Status } from '../types';

export function Feature() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();

  const [feature, setFeature] = useState<Item | null>(null);
  const [stories, setStories] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Transitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listStories({ feature_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getTransitions(id, activeSlug),
    ]).then(([f, s, sp, tr]) => {
      setFeature(f); setStories(s); setSpec(sp); setTransitions(tr);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !feature) return <SkeletonStack rows={6} />;
  if (!feature) return <EmptyState icon={FileQuestion} title="Feature not found" hint={`No feature with ID ${id} exists.`} />;

  const d = feature.data as { id: string; title: string; phase?: string; status: Status; parent: string };
  const counts = {
    done: stories.filter(s => s.data.status === 'done').length,
    inProgress: stories.filter(s => s.data.status === 'in_progress').length,
    ready: stories.filter(s => s.data.status === 'ready').length,
  };

  const allowed = transitions?.allowed ?? [];
  const primaryAction: Status | null =
    allowed.includes('in_progress') ? 'in_progress' :
    allowed.includes('done') ? 'done' :
    allowed[0] ?? null;

  const crumbs: Crumb[] = [
    { label: 'All epics', to: '/', toMulti: '/p/$slug/', params: {} },
    { label: d.parent, to: '/epics/$id', toMulti: '/p/$slug/epics/$id', params: { id: d.parent } },
  ];

  const view = search.view as 'tree' | 'kanban' | undefined;

  function setView(v: 'tree' | 'kanban' | undefined) {
    navigate({ to: '.', search: { view: v } as never });
  }

  function onLocalStatusChange(storyId: string, newStatus: Status) {
    setStories(prev => prev.map(s => (s.data as { id: string }).id === storyId ? { ...s, data: { ...s.data, status: newStatus } } : s));
  }

  return (
    <div className="space-y-7 max-w-[1200px] mx-auto px-4">
      <Breadcrumb crumbs={crumbs} current={d.id} activeSlug={activeSlug} />

      <Hero
        kind="feature"
        id={d.id}
        title={d.title}
        status={d.status}
        phase={d.phase}
        progress={stories.length > 0 ? {
          done: counts.done, inProgress: counts.inProgress, ready: counts.ready,
          total: stories.length, label: 'Stories',
        } : undefined}
        actions={primaryAction && (
          <button
            onClick={() => setItemStatus(id, primaryAction, activeSlug).then(() => getItem(id, activeSlug).then(setFeature))}
            className="bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg text-[13px] hover:bg-[#99f6e4] transition-colors"
          >Mark {primaryAction.replace('_', ' ')}</button>
        )}
        viewToggle={
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-[3px]">
            {[{k: undefined, l: 'Detail'}, {k: 'tree' as const, l: 'Tree'}, {k: 'kanban' as const, l: 'Kanban'}].map(opt => (
              <button
                key={opt.l}
                onClick={() => setView(opt.k)}
                className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${view === opt.k ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >{opt.l}</button>
            ))}
          </div>
        }
      />

      {view === 'tree' ? (
        <Card title="Subtree" count={`rooted at ${d.id}`}>
          <div className="p-4"><TreeView rootId={d.id} currentId={d.id} /></div>
        </Card>
      ) : view === 'kanban' ? (
        <Card title="Kanban" count={`${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}`}>
          <div className="p-4"><KanbanBoard stories={stories} onLocalStatusChange={onLocalStatusChange} activeSlug={activeSlug} /></div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            {feature.body && (
              <Card title="Description">
                <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                  <Markdown>{feature.body}</Markdown>
                </div>
              </Card>
            )}

            <Card title="Stories" count={`${counts.done} / ${stories.length} done`}>
              {stories.length === 0 ? (
                <EmptyState icon={BookOpen} title="No stories yet" hint={`Add one with \`kadai add story --feature ${id}\``} />
              ) : stories.map(s => {
                const sd = s.data as { id: string; title: string; status: Status };
                return (
                  <div key={sd.id} className="px-5 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    {activeSlug ? (
                      <Link to="/p/$slug/stories/$id" params={{ slug: activeSlug, id: sd.id }} className="flex items-center gap-4">
                        <KindIcon kind="story" size={14} />
                        <IdPill id={sd.id} />
                        <span className="flex-1 text-[13.5px]">{sd.title}</span>
                        <StatusBadge status={sd.status} />
                      </Link>
                    ) : (
                      <Link to="/stories/$id" params={{ id: sd.id }} className="flex items-center gap-4">
                        <KindIcon kind="story" size={14} />
                        <IdPill id={sd.id} />
                        <span className="flex-1 text-[13.5px]">{sd.title}</span>
                        <StatusBadge status={sd.status} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Documents">
              <DocumentRow kind="spec" attached={!!spec} meta={spec ? `${spec.split(/\n/).length} lines` : undefined} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
