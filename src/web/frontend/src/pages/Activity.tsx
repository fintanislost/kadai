import { useEffect, useState } from 'react';
import { getActivity, type ActivityEntry } from '../api';
import { EmptyState } from '../components/EmptyState';
import { KindIcon } from '../components/KindIcon';
import { SkeletonStack } from '../components/Skeleton';
import { Card } from '../components/Card';
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
  Write: 'bg-status-ready/10 text-status-ready',
  Edit: 'bg-status-ready/10 text-status-ready',
  commit: 'bg-status-review/10 text-status-review',
  note: 'bg-accent/10 text-accent',
  other: 'bg-white/[0.03] text-text-secondary',
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
        <div className="text-xs text-text-tertiary">Activity</div>
        <h1 className="text-2xl font-bold">Recent changes</h1>
      </div>
      <Card title="Recent activity" count={entries.length > 0 ? entries.length : undefined}>
        {loading && entries.length === 0 && <div className="px-5 py-4"><SkeletonStack rows={6} /></div>}
        {!loading && entries.length === 0 && (
          <EmptyState icon={Clock} title="No activity yet" hint="Edits, commits, and notes will appear here as work progresses." />
        )}
        {entries.length > 0 && (
          <ul className="space-y-1.5 px-5 py-3.5">
            {entries.map((e, i) => (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <span className="text-xs text-text-tertiary font-mono w-44 shrink-0">{e.ts}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${KIND_BADGE[e.kind] ?? KIND_BADGE.other}`}>{e.kind}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <KindIcon kind={e.itemKind} size={12} />
                  <ProjectScopedLink
                    activeSlug={activeSlug}
                    to={ROUTE_BY_KIND[e.itemKind] ?? '/'}
                    params={{ id: e.itemId }}
                    className="text-xs text-text-tertiary hover:text-text-secondary"
                  >{e.itemId}</ProjectScopedLink>
                </span>
                <span className="text-text-secondary truncate">{e.payload}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
