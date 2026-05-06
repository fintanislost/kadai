import { useEffect, useState } from 'react';
import { listEpics, listPhases } from '../api';
import { EpicCard } from '../components/EpicCard';
import { useLiveKey } from '../live';
import type { Item, PhaseConfig } from '../types';

export function Home() {
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);
  const liveKey = useLiveKey();

  useEffect(() => {
    listPhases().then(setPhases);
    listEpics().then(setEpics);
  }, [liveKey]);

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
                {phaseEpics.map(epic => <EpicCard key={(epic.data as any).id} epic={epic} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
