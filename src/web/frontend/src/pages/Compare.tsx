import { useEffect, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { listPhases, comparePhasesApi, type CompareResult } from '../api';
import { EmptyState } from '../components/EmptyState';
import { KindIcon } from '../components/KindIcon';
import { StatusBadge } from '../components/StatusBadge';
import { useProjectMode, ProjectScopedLink } from '../project';
import type { PhaseConfig, Status } from '../types';
import { Columns2 } from 'lucide-react';

const ROUTE_BY_KIND: Record<string, string> = {
  epic: '/epics/$id',
  feature: '/features/$id',
  story: '/stories/$id',
  task: '/stories/$id',
};

export function Compare() {
  // useSearch without `from` to support both /compare and /p/$slug/compare
  const search = useSearch({ strict: false }) as { a?: string; b?: string };
  const a = search.a ?? '';
  const b = search.b ?? '';
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { activeSlug } = useProjectMode();

  useEffect(() => { listPhases(activeSlug).then(setPhases); }, [activeSlug]);
  useEffect(() => {
    if (!a || !b) return;
    setError(null);
    comparePhasesApi(a, b, activeSlug).then(setResult).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [a, b, activeSlug]);

  if (!a || !b) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-muted">Compare</div>
        <h1 className="text-2xl font-bold">Pick two phases to compare</h1>
        <div className="text-muted text-sm">URL params: <code>?a=&lt;phase&gt;&b=&lt;phase&gt;</code>. Available phases: {phases.map(p => p.slug).join(', ')}.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted">Compare</div>
        <h1 className="text-2xl font-bold">{a} vs {b}</h1>
        {result && <div className="text-xs text-muted mt-1">{result.common.titles.length} common title{result.common.titles.length !== 1 ? 's' : ''}</div>}
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[result.a, result.b].map((side, idx) => (
            <div key={idx} className="bg-panel rounded p-3 space-y-2">
              <div className="text-sm font-bold">{side.phase} <span className="text-xs text-muted">({side.items.length})</span></div>
              {side.items.length === 0 ? (
                <EmptyState icon={Columns2} title="No items in this phase" className="py-6" />
              ) : (
                <ul className="space-y-1">
                  {side.items.map(item => {
                    const inCommon = result.common.titles.includes(item.title);
                    return (
                      <li key={item.id}>
                        <ProjectScopedLink
                          activeSlug={activeSlug}
                          to={ROUTE_BY_KIND[item.kind] ?? '/'}
                          params={{ id: item.id }}
                          className={`block text-xs p-1.5 rounded ${inCommon ? 'bg-amber-900/30 hover:bg-amber-900/50' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                        >
                          <span className="inline-flex items-center gap-1 mr-1">
                            <KindIcon kind={item.kind} size={12} />
                          </span>
                          <span className="text-muted text-[10px] mr-2">{item.id}</span>
                          <span>{item.title}</span>
                          <StatusBadge status={item.status as Status} size="xs" className="ml-2" />
                        </ProjectScopedLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
