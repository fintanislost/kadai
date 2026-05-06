import { useEffect, useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { getPicked, listPhases } from '../api';
import type { Item, PhaseConfig } from '../types';
import { LiveUpdatesProvider } from '../live';
import { SearchBox } from './SearchBox';
import { ProjectModeProvider, useProjectMode } from '../project';

function ProjectIndicator() {
  const mode = useProjectMode();
  if (!mode.isMulti) return null;
  if (mode.activeSlug) {
    const active = mode.projects.find(p => p.slug === mode.activeSlug);
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Project:</span>
        <span className="font-bold">{active?.name ?? mode.activeSlug}</span>
        <Link to="/projects" className="text-xs text-muted hover:text-zinc-300">← Switch</Link>
      </div>
    );
  }
  return <Link to="/projects" className="text-sm text-muted hover:text-zinc-300">Projects</Link>;
}

export function Layout() {
  const [picked, setPicked] = useState<Item | null>(null);
  const [phases, setPhases] = useState<PhaseConfig[]>([]);

  useEffect(() => {
    getPicked().then(setPicked).catch(() => setPicked(null));
    listPhases().then(setPhases).catch(() => setPhases([]));
  }, []);

  return (
    <ProjectModeProvider>
      <LiveUpdatesProvider>
        <div className="min-h-screen flex flex-col">
          <header className="bg-panel border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
            <Link to="/" className="font-bold text-lg">Kadai</Link>
            <Link to="/activity" className="text-sm text-muted hover:text-zinc-300">Activity</Link>
            <Link to="/compare" className="text-sm text-muted hover:text-zinc-300">Compare</Link>
            <div className="flex items-center gap-2 text-sm">
              {phases.map(p => (
                <span
                  key={p.slug}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ background: p.color + '33', color: p.color }}
                >
                  {p.display}
                </span>
              ))}
            </div>
            <ProjectIndicator />
            <SearchBox />
            <div className="ml-auto text-sm">
              {picked ? (
                <span className="bg-emerald-900/40 text-emerald-300 px-3 py-1 rounded">
                  Picked: {picked.data.id} — {picked.data.title}
                </span>
              ) : (
                <span className="text-muted">No story picked</span>
              )}
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </LiveUpdatesProvider>
    </ProjectModeProvider>
  );
}
