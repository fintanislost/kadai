import type { ReactNode } from 'react';

interface Props {
  title?: string;
  count?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, count, headerAction, children, className = '' }: Props) {
  return (
    <div className={`bg-surface-1 border border-white/[0.06] rounded-xl shadow-elev-1 overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="section-label flex items-center gap-2">
            {title}
            {count && <span className="text-[11px] text-text-quaternary font-normal tracking-normal normal-case">{count}</span>}
          </h3>
          {headerAction}
        </div>
      )}
      {children}
    </div>
  );
}
