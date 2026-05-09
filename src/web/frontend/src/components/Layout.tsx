import React, { useEffect, useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { getPicked, getDisabledStatus, type DisabledStatus } from '../api';
import type { Item } from '../types';
import { LiveUpdatesProvider, useLiveKey } from '../live';
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
        <Link to="/projects" className="text-xs text-muted hover:text-text-primary">← Switch</Link>
      </div>
    );
  }
  return <Link to="/projects" className="text-sm text-muted hover:text-text-primary">Projects</Link>;
}

function DisabledBanner() {
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();
  const [status, setStatus] = React.useState<DisabledStatus>({ disabled: false });

  React.useEffect(() => {
    getDisabledStatus(activeSlug).then(setStatus).catch(() => setStatus({ disabled: false }));
  }, [activeSlug, liveKey]);

  if (!status.disabled) return null;
  const tooltipText = [
    `Disabled since ${status.since}`,
    status.reason ? `Reason: ${status.reason}` : '',
    'Run `kadai enable` to re-enable.',
  ].filter(Boolean).join('\n');

  return (
    <span
      title={tooltipText}
      className="bg-accent/[0.10] text-accent border border-accent/25 rounded-md px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide cursor-help"
    >
      ⚠ DISABLED
    </span>
  );
}

export function Layout() {
  const [picked, setPicked] = useState<Item | null>(null);

  useEffect(() => {
    getPicked().then(setPicked).catch(() => setPicked(null));
  }, []);

  return (
    <ProjectModeProvider>
      <LiveUpdatesProvider>
        <div className="min-h-screen flex flex-col">
          <header className="bg-surface-1/70 backdrop-blur border-b border-white/[0.06] px-8 py-3">
            <div className="flex items-center gap-7 max-w-[1400px] mx-auto">
              <Link to="/" className="font-semibold tracking-tight flex items-center gap-2.5 text-[15px]">
                <span className="w-[18px] h-[18px] rounded bg-text-primary text-bg flex items-center justify-center text-[11px] font-extrabold tracking-tighter">k</span>
                Kadai
              </Link>
              <ProjectIndicator />
              <nav className="flex items-center gap-5 text-[13.5px]">
                <Link to="/activity" className="text-text-tertiary hover:text-text-primary transition-colors">Activity</Link>
                <Link to="/compare" className="text-text-tertiary hover:text-text-primary transition-colors">Compare</Link>
              </nav>
              <DisabledBanner />
              <div className="flex-1 max-w-[380px]">
                <SearchBox />
              </div>
              <div className="text-sm">
                {picked ? (
                  <span className="bg-white/[0.04] text-text-secondary border border-white/[0.10] rounded-md px-2.5 py-1 inline-flex items-center gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-in_progress" />
                    Picked: <span className="text-text-primary font-medium">{picked.data.id}</span>
                  </span>
                ) : (
                  <span className="text-text-tertiary text-xs">Nothing picked</span>
                )}
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
