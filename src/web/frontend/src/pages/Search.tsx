import { useEffect, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { searchSpine, type SearchResult } from '../api';

const ROUTE_BY_KIND: Record<string, string> = {
  epic: '/epics/$id',
  feature: '/features/$id',
  story: '/stories/$id',
  task: '/stories/$id',
};

function Highlighted({ snippet, matchStart, matchEnd }: { snippet: string; matchStart: number; matchEnd: number }) {
  if (matchEnd === 0) return <>{snippet}</>;
  return (
    <>
      {snippet.slice(0, matchStart)}
      <mark className="bg-yellow-700/40 text-yellow-100 rounded px-0.5">
        {snippet.slice(matchStart, matchEnd)}
      </mark>
      {snippet.slice(matchEnd)}
    </>
  );
}

export function Search() {
  const search = useSearch({ from: '/search' }) as { q?: string };
  const q = search.q ?? '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    searchSpine(q)
      .then(setResults)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted">Search results</div>
        <h1 className="text-2xl font-bold">{q ? `"${q}"` : 'Type a query in the top bar'}</h1>
      </div>

      {q.length > 0 && q.length < 2 && (
        <div className="text-muted italic">Type at least 2 characters.</div>
      )}

      {loading && <div className="text-muted italic">Searching…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!loading && !error && q.length >= 2 && results.length === 0 && (
        <div className="text-muted italic">No results.</div>
      )}

      <div className="space-y-2">
        {results.map(r => {
          const route = ROUTE_BY_KIND[r.kind] ?? '/';
          return (
            <Link
              key={r.id}
              to={route}
              params={{ id: r.id }}
              className="block bg-panel border border-zinc-800 rounded p-3 hover:border-zinc-600"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-muted uppercase">{r.kind}</span>
                <span className="text-xs text-muted">{r.id}</span>
                {r.phase && <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{r.phase}</span>}
                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{r.status}</span>
                <span className="ml-auto text-[10px] text-muted">{r.matchType} match</span>
              </div>
              <div className="mt-1 font-medium">{r.title}</div>
              {r.matchType !== 'title' && (
                <div className="mt-1 text-sm text-zinc-400">
                  <Highlighted snippet={r.snippet} matchStart={r.matchStart} matchEnd={r.matchEnd} />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
