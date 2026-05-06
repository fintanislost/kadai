import { useEffect, useState } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { getItem, getFile, listTasks, getTransitions, setItemStatus, attachFile, type Transitions } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { Hero } from '../components/Hero';
import { Card } from '../components/Card';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { TreeView } from '../components/TreeView';
import { StatusBadge } from '../components/StatusBadge';
import { IdPill } from '../components/IdPill';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { CheckSquare, FileQuestion } from 'lucide-react';
import type { Item, Status } from '../types';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);     if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);     return `${d}d ago`;
}

export function Story() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();

  const [story, setStory] = useState<Item | null>(null);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Transitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listTasks({ story_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getFile(id, 'plan.md', activeSlug),
      getFile(id, 'changelog.md', activeSlug),
      getTransitions(id, activeSlug),
    ]).then(([s, t, sp, p, c, tr]) => {
      setStory(s); setTasks(t); setSpec(sp); setPlan(p); setChangelog(c); setTransitions(tr);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !story) return <SkeletonStack rows={6} />;
  if (!story) return <EmptyState icon={FileQuestion} title="Story not found" hint={`No story with ID ${id} exists.`} />;

  const d = story.data as { id: string; title: string; phase?: string; status: Status; parent: string; updated?: string; acceptance_criteria?: string[] };
  const taskCounts = {
    done: tasks.filter(t => t.data.status === 'done').length,
    inProgress: tasks.filter(t => t.data.status === 'in_progress').length,
    ready: tasks.filter(t => t.data.status === 'ready').length,
  };

  // Pick the primary CTA: prefer review (if legal), else in_progress, else done.
  const allowed = transitions?.allowed ?? [];
  const primaryAction: Status | null =
    allowed.includes('review') ? 'review' :
    allowed.includes('in_progress') ? 'in_progress' :
    allowed.includes('done') ? 'done' :
    allowed[0] ?? null;
  const secondaryActions = allowed.filter(s => s !== primaryAction);

  const crumbs: Crumb[] = [
    { label: 'All epics', to: '/', toMulti: '/p/$slug/', params: {} },
    { label: d.parent, to: '/features/$id', toMulti: '/p/$slug/features/$id', params: { id: d.parent } },
  ];

  const showTree = search.view === 'tree';

  function reloadAttached(filename: 'spec.md' | 'plan.md') {
    getFile(id, filename, activeSlug).then(c => filename === 'spec.md' ? setSpec(c) : setPlan(c));
  }

  async function move(target: Status) {
    const previous = d.status;
    setStory(prev => prev ? { ...prev, data: { ...prev.data, status: target } } : prev);
    try {
      await setItemStatus(id, target, activeSlug);
      // Refetch transitions because the legal next states change with the new status.
      getTransitions(id, activeSlug).then(setTransitions);
    } catch {
      setStory(prev => prev ? { ...prev, data: { ...prev.data, status: previous } } : prev);
    }
  }

  async function uploadAttach(kind: 'spec' | 'plan', file: File) {
    await attachFile(id, kind, file, activeSlug);
    reloadAttached(kind === 'spec' ? 'spec.md' : 'plan.md');
  }

  return (
    <div className="space-y-7 max-w-[1200px] mx-auto px-4">
      <Breadcrumb crumbs={crumbs} current={d.id} activeSlug={activeSlug} />

      <Hero
        kind="story"
        id={d.id}
        title={d.title}
        status={d.status}
        phase={d.phase}
        metaRight={d.updated ? `updated ${timeAgo(d.updated)}` : undefined}
        progress={tasks.length > 0 ? {
          done: taskCounts.done,
          inProgress: taskCounts.inProgress,
          ready: taskCounts.ready,
          total: tasks.length,
          label: 'Tasks',
        } : undefined}
        actions={
          <div className="flex flex-col gap-2">
            {primaryAction && (
              <button
                onClick={() => move(primaryAction)}
                className="bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg text-[13px] hover:bg-[#99f6e4] transition-colors"
              >Mark {primaryAction.replace('_', ' ')}</button>
            )}
            {secondaryActions.length > 0 && (
              <div className="flex gap-1.5">
                {secondaryActions.slice(0, 3).map(s => (
                  <button
                    key={s}
                    onClick={() => move(s)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.10] text-text-primary px-3 py-2 rounded-lg text-[12px] font-medium hover:bg-white/[0.07] hover:border-white/[0.16] transition-colors"
                  >{s.replace('_', ' ')}</button>
                ))}
              </div>
            )}
          </div>
        }
        viewToggle={
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-[3px]">
            <button
              onClick={() => navigate({ to: '.', search: { view: undefined } as never })}
              className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${!showTree ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
            >Detail</button>
            <button
              onClick={() => navigate({ to: '.', search: { view: 'tree' } as never })}
              className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${showTree ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
            >Tree</button>
          </div>
        }
      />

      {showTree ? (
        <Card title="Subtree" count={`rooted at ${d.parent}`}>
          <div className="p-4">
            <TreeView rootId={d.parent} currentId={d.id} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            <Card title="Description">
              <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                {story.body && <Markdown>{story.body}</Markdown>}
                {d.acceptance_criteria && d.acceptance_criteria.length > 0 && (
                  <>
                    <div className="section-label mt-5 mb-3 not-prose">Acceptance criteria</div>
                    <ul className="space-y-2 list-none p-0 m-0 not-prose">
                      {d.acceptance_criteria.map((c, i) => (
                        <li key={i} className="flex gap-3 text-[14px] text-text-secondary">
                          <span className="w-4 h-4 rounded-[4px] border-[1.5px] border-white/[0.16] bg-white/[0.02] shrink-0 mt-[3px]" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Card>

            <Card title="Tasks" count={`${taskCounts.done} / ${tasks.length} done`}>
              {tasks.length === 0 ? (
                <EmptyState icon={CheckSquare} title="No tasks yet" hint={`Add one with \`kadai add task --story ${id}\``} />
              ) : tasks.map(t => {
                const td = t.data as { id: string; title: string; status: Status };
                return (
                  <div key={td.id} className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    <span className="w-4 h-4 rounded-[4px] border-[1.5px] border-white/[0.16]" />
                    <IdPill id={td.id} />
                    <span className="flex-1 text-[13.5px]">{td.title}</span>
                    <StatusBadge status={td.status} />
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Documents">
              <DocumentRow kind="spec"      attached={!!spec}      meta={spec ? `${spec.split(/\n/).filter(Boolean).length} lines` : undefined} />
              <DocumentRow kind="plan"      attached={!!plan}      meta={plan ? `${plan.split(/\n/).filter(Boolean).length} lines` : undefined} />
              <DocumentRow kind="changelog" attached={!!changelog} meta={changelog ? `${changelog.split(/\n/).filter(Boolean).length} entries` : 'no entries'} />
            </Card>

            {(spec || plan) && (
              <Card title="Attached content">
                <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                  {spec && <><div className="section-label mb-2 not-prose">Spec</div><Markdown>{spec}</Markdown></>}
                  {plan && <><div className="section-label mb-2 mt-5 not-prose">Plan</div><Markdown>{plan}</Markdown></>}
                </div>
              </Card>
            )}

            {!spec && (
              <Card>
                <input id="story-spec-input" type="file" accept=".md,text/markdown" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttach('spec', f); }} />
                <EmptyState icon={FileQuestion} title="No spec attached" hint="Upload a spec.md to define what this story should do."
                  action={<button onClick={() => document.getElementById('story-spec-input')?.click()} className="bg-white/[0.04] border border-white/[0.10] px-3 py-1.5 rounded-md text-[12px] hover:bg-white/[0.07]">Attach spec.md</button>}
                />
              </Card>
            )}

            {!plan && (
              <Card>
                <input id="story-plan-input" type="file" accept=".md,text/markdown" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttach('plan', f); }} />
                <EmptyState icon={FileQuestion} title="No plan attached" hint="Upload a plan.md with implementation steps."
                  action={<button onClick={() => document.getElementById('story-plan-input')?.click()} className="bg-white/[0.04] border border-white/[0.10] px-3 py-1.5 rounded-md text-[12px] hover:bg-white/[0.07]">Attach plan.md</button>}
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
