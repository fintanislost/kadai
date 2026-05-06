interface Props {
  id: string;
  className?: string;
}

export function IdPill({ id, className = '' }: Props) {
  return (
    <span className={`text-[11px] text-text-tertiary px-1.5 py-[1px] bg-white/[0.04] border border-white/[0.06] rounded ${className}`}>
      {id}
    </span>
  );
}
