import { Link } from '@tanstack/react-router';
import { KindIcon } from './KindIcon';
import { StatusBadge } from './StatusBadge';
import type { Item, Status } from '../types';

export function EpicCard({ epic }: { epic: Item }) {
  const d = epic.data as { id: string; title: string; status: string; phase: string };
  return (
    <Link
      to="/epics/$id"
      params={{ id: d.id }}
      className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500 transition"
    >
      <div className="text-xs text-muted">{d.id}</div>
      <div className="flex items-center gap-1.5 font-medium">
        <KindIcon kind="epic" size={14} />
        {d.title}
      </div>
      <div className="mt-1 text-xs">
        <StatusBadge status={d.status as Status} />
      </div>
    </Link>
  );
}
