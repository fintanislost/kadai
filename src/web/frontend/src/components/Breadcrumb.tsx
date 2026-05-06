import { Link } from '@tanstack/react-router';

export interface Crumb {
  label: string;
  to?: string;       // legacy path (e.g., '/epics/$id')
  toMulti?: string;  // multi-mode path (e.g., '/p/$slug/epics/$id')
  params?: Record<string, string>;
}

interface Props {
  crumbs: Crumb[];        // ancestor links (excluding current)
  current: string;        // current item ID — rendered as a non-link "here" pill
  activeSlug: string | null;
  className?: string;
}

export function Breadcrumb({ crumbs, current, activeSlug, className = '' }: Props) {
  return (
    <nav className={`text-[12.5px] text-text-tertiary flex items-center gap-2 mb-5 ${className}`} aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {c.to && c.toMulti && c.params ? (
            activeSlug ? (
              <Link
                to={c.toMulti as never}
                params={{ slug: activeSlug, ...c.params } as never}
                className="text-text-secondary hover:text-text-primary"
              >{c.label}</Link>
            ) : (
              <Link
                to={c.to as never}
                params={c.params as never}
                className="text-text-secondary hover:text-text-primary"
              >{c.label}</Link>
            )
          ) : (
            <span className="text-text-secondary">{c.label}</span>
          )}
          <span className="text-text-quaternary text-[11px]">›</span>
        </span>
      ))}
      <span className="text-text-primary text-[11px] px-1.5 py-[1px] bg-white/[0.04] border border-white/[0.06] rounded">{current}</span>
    </nav>
  );
}
