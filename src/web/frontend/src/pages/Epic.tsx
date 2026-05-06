import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { getItem, listFeatures } from '../api';
import { useLiveKey } from '../live';
import type { Item } from '../types';

export function Epic() {
  const { id } = useParams({ from: '/epics/$id' });
  const [epic, setEpic] = useState<Item | null>(null);
  const [features, setFeatures] = useState<Item[]>([]);
  const liveKey = useLiveKey();

  useEffect(() => {
    getItem(id).then(setEpic);
    listFeatures({ epic_id: id }).then(setFeatures);
  }, [id, liveKey]);

  if (!epic) return <div className="text-muted">Loading or not found…</div>;
  const d = epic.data as { id: string; title: string; phase: string; status: string };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-muted hover:text-zinc-300">← back to roadmap</Link>
        <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
        <h1 className="text-2xl font-bold">{d.title}</h1>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">Features</h2>
        {features.length === 0 ? (
          <div className="text-muted text-sm italic">(no features yet)</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.sort((a, b) => ((a.data as any).order ?? 0) - ((b.data as any).order ?? 0)).map(f => {
              const fd = f.data as { id: string; title: string; status: string };
              return (
                <Link
                  key={fd.id}
                  to="/features/$id"
                  params={{ id: fd.id }}
                  className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500"
                >
                  <div className="text-xs text-muted">{fd.id}</div>
                  <div className="font-medium">{fd.title}</div>
                  <div className="mt-1 text-xs"><span className="bg-zinc-800 px-2 py-0.5 rounded">{fd.status}</span></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
