import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, hint, action, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      <Icon size={32} className="text-text-quaternary mb-3" aria-hidden="true" />
      <div className="text-sm font-medium text-text-primary">{title}</div>
      {hint && <div className="text-xs text-text-tertiary mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
