import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { getItem, getFile, listTasks } from '../api';
import { AttachButton } from '../components/AttachButton';
import { Markdown } from '../components/Markdown';
import { StatusPanel } from '../components/StatusPanel';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { Item } from '../types';
import type { Status } from '../types';

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
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    if (!id) return;
    getItem(id, activeSlug).then(setStory);
    listTasks({ story_id: id }, activeSlug).then(setTasks);
    getFile(id, 'spec.md', activeSlug).then(setSpec);
    getFile(id, 'plan.md', activeSlug).then(setPlan);
    getFile(id, 'changelog.md', activeSlug).then(setChangelog);
  }, [id, liveKey, activeSlug]);

  if (!story) return <div className="text-muted">Loading or not found…</div>;
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
          <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
          <h1 className="text-2xl font-bold">{d.title}</h1>
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
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Acceptance criteria</h3>
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
            <div className="space-y-3">
              <div className="text-muted italic">No spec attached.</div>
              <AttachButton itemId={d.id} kind="spec" slug={activeSlug} onAttached={() => reloadAttached('spec.md')} />
            </div>
          ))}
          {tab === 'plan' && (plan ? (
            <Markdown>{plan}</Markdown>
          ) : (
            <div className="space-y-3">
              <div className="text-muted italic">No plan attached.</div>
              <AttachButton itemId={d.id} kind="plan" slug={activeSlug} onAttached={() => reloadAttached('plan.md')} />
            </div>
          ))}
          {tab === 'changelog' && (changelog ? <Markdown>{changelog}</Markdown> : <div className="text-muted italic">No changelog yet.</div>)}
          {tab === 'tasks' && (
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-muted italic">No tasks yet.</div>
              ) : tasks.map(t => {
                const td = t.data as { id: string; title: string; status: string };
                return (
                  <div key={td.id} className="flex items-center gap-3">
                    <input type="checkbox" checked={td.status === 'done'} readOnly />
                    <span className="text-xs text-muted">{td.id}</span>
                    <span>{td.title}</span>
                    <span className="ml-auto text-xs bg-zinc-800 px-2 py-0.5 rounded">{td.status}</span>
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
