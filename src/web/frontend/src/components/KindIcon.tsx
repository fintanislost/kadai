import { Layers, Box, BookOpen, CheckSquare, type LucideIcon } from 'lucide-react';
import type { ItemKind } from '../types';

const ICON_BY_KIND: Record<ItemKind, LucideIcon> = {
  epic: Layers,
  feature: Box,
  story: BookOpen,
  task: CheckSquare,
};

const COLOR_BY_KIND: Record<ItemKind, string> = {
  epic: 'text-violet-400',
  feature: 'text-sky-400',
  story: 'text-emerald-400',
  task: 'text-zinc-400',
};

interface Props {
  kind: ItemKind;
  size?: number;
  className?: string;
  colored?: boolean;
}

export function KindIcon({ kind, size = 14, className = '', colored = true }: Props) {
  const Icon = ICON_BY_KIND[kind];
  const colorClass = colored ? COLOR_BY_KIND[kind] : 'text-zinc-400';
  return <Icon size={size} className={`${colorClass} shrink-0 ${className}`} aria-label={kind} />;
}
