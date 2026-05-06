import { FileText, Clock } from 'lucide-react';

interface Props {
  kind: 'spec' | 'plan' | 'changelog';
  attached: boolean;
  meta?: string;       // e.g., "320 lines · attached 3d ago"
  onClick?: () => void;
}

const ICON_BY_KIND = {
  spec: FileText,
  plan: FileText,
  changelog: Clock,
};

export function DocumentRow({ kind, attached, meta, onClick }: Props) {
  const Icon = ICON_BY_KIND[kind];
  const filename = `${kind}.md`;
  return (
    <div
      onClick={onClick}
      className={`group flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] last:border-b-0 transition-colors ${onClick ? 'hover:bg-white/[0.02] cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-text-tertiary shrink-0" />
        <div>
          <div className="text-[13.5px] text-text-primary font-medium">{filename}</div>
          <div className="text-[11.5px] text-text-tertiary mt-0.5">{attached ? meta ?? 'attached' : 'not attached'}</div>
        </div>
      </div>
      {attached && <span className="text-xs text-text-secondary group-hover:text-text-primary">Open ›</span>}
    </div>
  );
}
