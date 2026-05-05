import { Link } from '@tanstack/react-router';
import type { Item } from '../types';

export function EpicCard({ epic }: { epic: Item }) {
  const d = epic.data as { id: string; title: string; status: string; phase: string };
  return (
    <Link
      to="/epics/$id"
      params={{ id: d.id }}
      className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500 transition"
    >
      <div className="text-xs text-muted">{d.id}</div>
      <div className="font-medium">{d.title}</div>
      <div className="mt-1 text-xs">
        <span className="bg-zinc-800 px-2 py-0.5 rounded">{d.status}</span>
      </div>
    </Link>
  );
}
