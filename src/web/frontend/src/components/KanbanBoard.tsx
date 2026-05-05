import { Link } from '@tanstack/react-router';
import type { Item, Status } from '../types';

const COLUMNS: Status[] = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done'];

export function KanbanBoard({ stories }: { stories: Item[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {COLUMNS.map(col => (
        <div key={col} className="bg-panel rounded p-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{col}</div>
          <div className="space-y-2">
            {stories.filter(s => s.data.status === col).map(s => {
              const d = s.data as { id: string; title: string };
              return (
                <Link
                  key={d.id}
                  to="/stories/$id"
                  params={{ id: d.id }}
                  className="block bg-zinc-800 rounded p-2 text-xs hover:bg-zinc-700"
                >
                  <div className="text-muted text-[10px]">{d.id}</div>
                  <div>{d.title}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
