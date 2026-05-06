import type { Status } from '../types';

const COLORS: Record<Status, { bg: string; text: string; ring: string }> = {
  backlog:     { bg: 'bg-white/[0.04]',                 text: 'text-status-backlog',     ring: 'ring-white/10' },
  ready:       { bg: 'bg-status-ready/10',              text: 'text-status-ready',       ring: 'ring-status-ready/20' },
  in_progress: { bg: 'bg-status-in_progress/10',        text: 'text-status-in_progress', ring: 'ring-status-in_progress/20' },
  blocked:     { bg: 'bg-status-blocked/10',            text: 'text-status-blocked',     ring: 'ring-status-blocked/20' },
  review:      { bg: 'bg-status-review/10',             text: 'text-status-review',      ring: 'ring-status-review/20' },
  done:        { bg: 'bg-status-done/10',               text: 'text-status-done',        ring: 'ring-status-done/20' },
  cancelled:   { bg: 'bg-status-cancelled/20 line-through opacity-70', text: 'text-text-tertiary', ring: 'ring-white/10' },
};

interface Props {
  status: Status;
  size?: 'xs' | 'sm';
  className?: string;
}

export function StatusBadge({ status, size = 'xs', className = '' }: Props) {
  const c = COLORS[status];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10.5px] px-2 py-[3px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClass} ${c.bg} ${c.text} rounded font-semibold tracking-[0.06em] uppercase ring-1 ring-inset ${c.ring} ${className}`}
    >
      <span className={`w-[5px] h-[5px] rounded-full bg-current ${status === 'cancelled' ? 'hidden' : ''}`} />
      {status.replace('_', ' ')}
    </span>
  );
}
