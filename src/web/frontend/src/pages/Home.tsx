import { useEffect, useState } from 'react';
import { listEpics, listPhases, listFeatures, listStories, listTasks } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { EpicCard } from '../components/EpicCard';
import { SkeletonStack } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Layers } from 'lucide-react';
import type { Item, PhaseConfig } from '../types';

export function Home() {
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ epics: 0, features: 0, stories: 0, tasks: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listPhases(activeSlug),
      listEpics({}, activeSlug),
      listFeatures({}, activeSlug),
      listStories({}, activeSlug),
      listTasks({}, activeSlug),
    ]).then(([p, e, f, s, t]) => {
      setPhases(p);
      setEpics(e);
      setCounts({ epics: e.length, features: f.length, stories: s.length, tasks: t.length });
    }).finally(() => setLoading(false));
  }, [liveKey, activeSlug]);

  if (loading && epics.length === 0) return <SkeletonStack rows={5} />;

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto px-4">
      <div className="bg-surface-1 border border-white/[0.06] rounded-2xl shadow-elev-1 px-9 py-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-2">Project roadmap</div>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-[1.15] text-text-primary mb-6">Spine overview</h1>

        <div className="grid grid-cols-4 gap-6 pt-5 border-t border-white/[0.06]">
          {[
            { label: 'Epics',    val: counts.epics    },
            { label: 'Features', val: counts.features },
            { label: 'Stories',  val: counts.stories  },
            { label: 'Tasks',    val: counts.tasks    },
          ].map(c => (
            <div key={c.label}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-1.5">{c.label}</div>
              <div className="text-[24px] font-semibold text-text-primary">{c.val}</div>
            </div>
          ))}
        </div>

        {phases.length > 0 && (
          <div className="mt-7 pt-5 border-t border-white/[0.06]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-3">Phases</div>
            <div className="flex flex-wrap gap-2">
              {phases.map(p => (
                <span key={p.slug}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase border"
                  style={{ background: p.color + '15', color: p.color, borderColor: p.color + '40' }}
                >
                  {p.display} <span className="opacity-60 ml-1">{epics.filter(e => (e.data as { phase: string }).phase === p.slug).length}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {phases.length === 0 || epics.length === 0 ? (
        <EmptyState icon={Layers} title="No epics yet" hint="Add one with `kadai add epic --title 'My first epic' --phase mvp`" />
      ) : phases.map(phase => {
        const phaseEpics = epics
          .filter(e => (e.data as { phase: string }).phase === phase.slug)
          .sort((a, b) => ((a.data as { order?: number }).order ?? 0) - ((b.data as { order?: number }).order ?? 0));
        if (phaseEpics.length === 0) return null;
        return (
          <section key={phase.slug}>
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: phase.color }}>
              {phase.display} <span className="text-text-tertiary normal-case ml-1">· {phaseEpics.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {phaseEpics.map(epic => <EpicCard key={(epic.data as { id: string }).id} epic={epic} activeSlug={activeSlug} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
