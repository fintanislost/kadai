import { Link } from '@tanstack/react-router';
import { StatusBadge } from './StatusBadge';
import { KindIcon } from './KindIcon';
import { IdPill } from './IdPill';
import type { Item, Status } from '../types';

interface Props {
  epic: Item;
  activeSlug?: string | null;
}

export function EpicCard({ epic, activeSlug }: Props) {
  const d = epic.data as { id: string; title: string; status: Status; phase: string };
  const card = (
    <div className="bg-surface-1 border border-white/[0.06] hover:border-white/[0.16] rounded-xl p-5 shadow-elev-1 transition-colors h-full">
      <div className="flex items-start gap-3">
        <KindIcon kind="epic" size={18} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <IdPill id={d.id} />
            <StatusBadge status={d.status} />
          </div>
          <div className="text-[15px] font-medium text-text-primary">{d.title}</div>
          <div className="text-[11.5px] text-text-tertiary mt-1">phase {d.phase}</div>
        </div>
      </div>
    </div>
  );
  return activeSlug ? (
    <Link to="/p/$slug/epics/$id" params={{ slug: activeSlug, id: d.id }} className="block">{card}</Link>
  ) : (
    <Link to="/epics/$id" params={{ id: d.id }} className="block">{card}</Link>
  );
}
