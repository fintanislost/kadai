import { useEffect, useState } from 'react';
import { listEpics, listPhases } from '../api';
import { EpicCard } from '../components/EpicCard';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { Item, PhaseConfig } from '../types';

export function Home() {
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    listPhases(activeSlug).then(setPhases);
    listEpics({}, activeSlug).then(setEpics);
  }, [liveKey, activeSlug]);

  return (
    <div className="space-y-8">
      {phases.map(phase => {
        const phaseEpics = epics
          .filter(e => (e.data as any).phase === phase.slug)
          .sort((a, b) => ((a.data as any).order ?? 0) - ((b.data as any).order ?? 0));
        return (
          <section key={phase.slug}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3" style={{ color: phase.color }}>
              {phase.display}
            </h2>
            {phaseEpics.length === 0 ? (
              <div className="text-muted text-sm italic">(no epics in this phase)</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {phaseEpics.map(epic => {
                  const d = epic.data as { id: string; title: string; status: string; phase: string };
                  return activeSlug ? (
                    <ProjectScopedLink
                      key={d.id}
                      activeSlug={activeSlug}
                      to="/epics/$id"
                      params={{ id: d.id }}
                      className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500 transition"
                    >
                      <div className="text-xs text-muted">{d.id}</div>
                      <div className="font-medium">{d.title}</div>
                      <div className="mt-1 text-xs">
                        <span className="bg-zinc-800 px-2 py-0.5 rounded">{d.status}</span>
                      </div>
                    </ProjectScopedLink>
                  ) : (
                    <EpicCard key={d.id} epic={epic} />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
