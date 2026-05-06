import type { Status } from '../types';

const BG_BY_STATUS: Record<Status, string> = {
  backlog:     'bg-status-backlog/20 text-status-backlog ring-1 ring-status-backlog/30',
  ready:       'bg-status-ready/20 text-status-ready ring-1 ring-status-ready/30',
  in_progress: 'bg-status-in_progress/20 text-status-in_progress ring-1 ring-status-in_progress/30',
  blocked:     'bg-status-blocked/20 text-status-blocked ring-1 ring-status-blocked/30',
  review:      'bg-status-review/20 text-status-review ring-1 ring-status-review/30',
  done:        'bg-status-done/20 text-status-done ring-1 ring-status-done/30',
  cancelled:   'bg-status-cancelled/30 text-zinc-400 ring-1 ring-status-cancelled/40 line-through opacity-70',
};

interface Props {
  status: Status;
  size?: 'xs' | 'sm';
  className?: string;
}

export function StatusBadge({ status, size = 'xs', className = '' }: Props) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span
      className={`${sizeClass} ${BG_BY_STATUS[status]} rounded font-medium tracking-wide uppercase ${className}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
