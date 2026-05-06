interface Props {
  done: number;
  inProgress: number;
  total: number;
  className?: string;
}

export function ProgressBar({ done, inProgress, total, className = '' }: Props) {
  const safeTotal = Math.max(total, 1);
  const donePct = Math.min(100, (done / safeTotal) * 100);
  const inProgPct = Math.min(100 - donePct, (inProgress / safeTotal) * 100);
  return (
    <div className={`h-1 rounded-full bg-white/[0.05] overflow-hidden flex ${className}`}>
      <div className="bg-status-done" style={{ width: `${donePct}%` }} />
      <div className="bg-status-in_progress/70" style={{ width: `${inProgPct}%` }} />
    </div>
  );
}
