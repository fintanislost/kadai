import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { getItem, getFile, listTasks } from '../api';
import { AttachButton } from '../components/AttachButton';
import { EmptyState } from '../components/EmptyState';
import { KindIcon } from '../components/KindIcon';
import { Markdown } from '../components/Markdown';
import { SkeletonStack } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { StatusPanel } from '../components/StatusPanel';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { Item, Status } from '../types';
import { CheckSquare, Clock, FileQuestion, FileText } from 'lucide-react';

type TabName = 'story' | 'spec' | 'plan' | 'changelog' | 'tasks';

export function Story() {
  // useParams without `from` to support both /stories/$id and /p/$slug/stories/$id
  const params = useParams({ strict: false }) as { id?: string; slug?: string };
  const id = params.id ?? '';
  const [story, setStory] = useState<Item | null>(null);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>('story');
  const [loading, setLoading] = useState(true);
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listTasks({ story_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getFile(id, 'plan.md', activeSlug),
      getFile(id, 'changelog.md', activeSlug),
    ]).then(([s, t, sp, pl, ch]) => {
      setStory(s);
      setTasks(t);
      setSpec(sp);
      setPlan(pl);
      setChangelog(ch);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !story) return <SkeletonStack rows={5} />;
  if (!story) return <EmptyState icon={FileQuestion} title="Story not found" hint={`No story with ID ${id} exists.`} />;
  const d = story.data as {
    id: string;
    title: string;
    phase: string;
    status: string;
    parent: string;
    acceptance_criteria?: string[];
  };

  const tabs: TabName[] = ['story', 'spec', 'plan', 'changelog', 'tasks'];

  function patchStatus(next: Status) {
    setStory(prev => prev ? { ...prev, data: { ...prev.data, status: next } } : prev);
  }

  function reloadAttached(filename: 'spec.md' | 'plan.md') {
    getFile(d.id, filename, activeSlug).then(content => {
      if (filename === 'spec.md') setSpec(content);
      else setPlan(content);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
      <div className="space-y-6">
        <div>
          <ProjectScopedLink activeSlug={activeSlug} to="/features/$id" params={{ id: d.parent }} className="text-xs text-muted hover:text-zinc-300">← back to {d.parent}</ProjectScopedLink>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span>{d.id} · phase {d.phase}</span>
            <StatusBadge status={d.status as Status} />
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <KindIcon kind="story" size={20} />
            {d.title}
          </h1>
        </div>

        <div className="border-b border-zinc-800 flex gap-4">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm capitalize ${tab === t ? 'text-zinc-100 border-b-2 border-zinc-100 -mb-px' : 'text-muted hover:text-zinc-300'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-panel rounded p-4">
          {tab === 'story' && (
            <div className="space-y-3">
              {d.acceptance_criteria && (
                <div>
                  <h3 className="section-label mb-2">Acceptance criteria</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {d.acceptance_criteria.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              <Markdown>{story.body}</Markdown>
            </div>
          )}
          {tab === 'spec' && (spec ? (
            <Markdown>{spec}</Markdown>
          ) : (
            <EmptyState
              icon={FileText}
              title="No spec attached"
              hint="Upload a spec.md to define what this story should do."
              action={<AttachButton itemId={d.id} kind="spec" onAttached={() => reloadAttached('spec.md')} slug={activeSlug} />}
            />
          ))}
          {tab === 'plan' && (plan ? (
            <Markdown>{plan}</Markdown>
          ) : (
            <EmptyState
              icon={FileText}
              title="No plan attached"
              hint="Upload a plan.md with implementation steps."
              action={<AttachButton itemId={d.id} kind="plan" onAttached={() => reloadAttached('plan.md')} slug={activeSlug} />}
            />
          ))}
          {tab === 'changelog' && (changelog ? (
            <Markdown>{changelog}</Markdown>
          ) : (
            <EmptyState icon={Clock} title="Changelog is empty" hint="Edits to this story while picked, plus matching commits, appear here." />
          ))}
          {tab === 'tasks' && (
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <EmptyState icon={CheckSquare} title="No tasks yet" hint={`Add one with \`kadai add task --story ${id}\``} />
              ) : tasks.map(t => {
                const td = t.data as { id: string; title: string; status: string };
                return (
                  <div key={td.id} className="flex items-center gap-3">
                    <input type="checkbox" checked={td.status === 'done'} readOnly />
                    <KindIcon kind="task" size={12} className="shrink-0" />
                    <span className="text-xs text-muted">{td.id}</span>
                    <span>{td.title}</span>
                    <StatusBadge status={td.status as Status} className="ml-auto" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <StatusPanel
          itemId={d.id}
          currentStatus={d.status as Status}
          onStatusChange={patchStatus}
          slug={activeSlug}
        />
      </aside>
    </div>
  );
}
