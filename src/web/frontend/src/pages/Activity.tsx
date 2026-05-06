import { useEffect, useState } from 'react';
import { getActivity, type ActivityEntry } from '../api';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { useLiveKey } from '../live';
import { useProjectMode, ProjectScopedLink } from '../project';
import { Clock } from 'lucide-react';

const ROUTE_BY_KIND: Record<string, string> = {
  epic: '/epics/$id',
  feature: '/features/$id',
  story: '/stories/$id',
  task: '/stories/$id',
};

const KIND_BADGE: Record<string, string> = {
  Write: 'bg-blue-900/40 text-blue-200',
  Edit: 'bg-blue-900/40 text-blue-200',
  commit: 'bg-purple-900/40 text-purple-200',
  note: 'bg-amber-900/40 text-amber-200',
  other: 'bg-zinc-800 text-zinc-300',
};

export function Activity() {
  const liveKey = useLiveKey();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeSlug } = useProjectMode();

  useEffect(() => {
    setLoading(true);
    getActivity(200, activeSlug).then(setEntries).finally(() => setLoading(false));
  }, [liveKey, activeSlug]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted">Activity</div>
        <h1 className="text-2xl font-bold">Recent changes</h1>
      </div>
      {loading && entries.length === 0 && <SkeletonStack rows={6} />}
      {!loading && entries.length === 0 && (
        <EmptyState icon={Clock} title="No activity yet" hint="Edits, commits, and notes will appear here as work progresses." />
      )}
      <ul className="space-y-1.5">
        {entries.map((e, i) => (
          <li key={i} className="flex items-baseline gap-3 text-sm">
            <span className="text-xs text-muted font-mono w-44 shrink-0">{e.ts}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${KIND_BADGE[e.kind] ?? KIND_BADGE.other}`}>{e.kind}</span>
            <ProjectScopedLink
              activeSlug={activeSlug}
              to={ROUTE_BY_KIND[e.itemKind] ?? '/'}
              params={{ id: e.itemId }}
              className="text-xs text-muted hover:text-zinc-300 shrink-0"
            >{e.itemId}</ProjectScopedLink>
            <span className="text-zinc-300 truncate">{e.payload}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
