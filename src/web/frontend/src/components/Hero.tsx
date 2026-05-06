import type { ReactNode } from 'react';
import type { ItemKind, Status } from '../types';
import { StatusBadge } from './StatusBadge';
import { IdPill } from './IdPill';
import { ProgressBar } from './ProgressBar';

interface Props {
  kind: ItemKind;
  id: string;
  title: string;
  status: Status;
  phase?: string;
  metaRight?: string;          // e.g., "updated 2h ago"
  progress?: { done: number; inProgress: number; ready: number; total: number; label: string };
  actions?: ReactNode;          // primary + secondary buttons (caller's responsibility)
  viewToggle?: ReactNode;       // segmented control for [Detail | Tree]
  className?: string;
}

export function Hero({ kind, id, title, status, phase, metaRight, progress, actions, viewToggle, className = '' }: Props) {
  return (
    <div className={`bg-surface-1 border border-white/[0.06] rounded-2xl shadow-elev-1 px-9 py-8 grid grid-cols-[1fr_auto] gap-10 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">{kind}</span>
          <IdPill id={id} />
        </div>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-[1.15] text-text-primary mb-3.5">{title}</h1>
        <div className="flex items-center gap-4 flex-wrap text-[13px] text-text-secondary">
          <StatusBadge status={status} />
          {phase && (<><span className="text-text-quaternary">·</span><span>phase {phase}</span></>)}
          {metaRight && (<><span className="text-text-quaternary">·</span><span>{metaRight}</span></>)}
        </div>
        {progress && (
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <span className="section-label">{progress.label}</span>
              <span className="text-xs text-text-secondary">
                {progress.done} of {progress.total} done
                {progress.inProgress > 0 ? ` · ${progress.inProgress} in progress` : ''}
                {progress.ready > 0 ? ` · ${progress.ready} ready` : ''}
              </span>
            </div>
            <ProgressBar done={progress.done} inProgress={progress.inProgress} total={progress.total} />
          </div>
        )}
      </div>
      {(actions || viewToggle) && (
        <div className="flex flex-col gap-4 min-w-[260px]">
          {actions}
          {viewToggle}
        </div>
      )}
    </div>
  );
}
