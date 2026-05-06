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
          <header className="bg-panel/80 backdrop-blur border-b border-zinc-800 px-6 py-2.5">
            <div className="flex items-center gap-6">
              {/* LEFT: brand */}
              <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
                <span className="text-emerald-400">●</span> Kadai
              </Link>

              {/* MID-LEFT: project context (multi-mode only) */}
              <ProjectIndicator />

              {/* MID: nav */}
              <nav className="flex items-center gap-4 text-sm">
                <Link to="/activity" className="text-muted hover:text-zinc-200 transition-colors">Activity</Link>
                <Link to="/compare" className="text-muted hover:text-zinc-200 transition-colors">Compare</Link>
              </nav>

              {/* CENTER: search (grows) */}
              <div className="flex-1 max-w-md">
                <SearchBox />
              </div>

              {/* RIGHT: phase pills + picked indicator */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1.5">
                  {phases.map(p => (
                    <span
                      key={p.slug}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ring-1"
                      style={{ background: p.color + '15', color: p.color, borderColor: p.color + '40' }}
                    >
                      {p.display}
                    </span>
                  ))}
                </div>
                <div className="text-sm">
                  {picked ? (
                    <span className="bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 px-3 py-1 rounded-full font-medium">
                      ● {picked.data.id}
                    </span>
                  ) : (
                    <span className="text-muted text-xs">Nothing picked</span>
                  )}
                </div>
              </div>
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
