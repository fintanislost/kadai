import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Item, Status } from '../types';
import { setItemStatus } from '../api';
import { ProjectScopedLink } from '../project';

const COLUMNS: Status[] = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done'];

const COLUMN_BORDER_BY_STATUS: Record<Status, string> = {
  backlog:     'border-l-status-backlog/40',
  ready:       'border-l-status-ready/40',
  in_progress: 'border-l-status-in_progress/40',
  blocked:     'border-l-status-blocked/40',
  review:      'border-l-status-review/40',
  done:        'border-l-status-done/40',
  cancelled:   'border-l-status-cancelled/40',
};

interface Props {
  stories: Item[];
  onLocalStatusChange: (storyId: string, newStatus: Status) => void;
  activeSlug?: string | null;
}

export function KanbanBoard({ stories, onLocalStatusChange, activeSlug }: Props) {
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const storyId = String(e.active.id);
    const target = String(e.over.id) as Status;
    const story = stories.find(s => (s.data as any).id === storyId);
    if (!story || story.data.status === target) return;

    const previous = story.data.status;
    onLocalStatusChange(storyId, target);
    setError(null);
    try {
      await setItemStatus(storyId, target, activeSlug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      onLocalStatusChange(storyId, previous);
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-900/50 text-red-200 text-xs px-3 py-2 rounded">{error}</div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {COLUMNS.map(col => (
            <Column key={col} status={col} stories={stories.filter(s => s.data.status === col)} activeSlug={activeSlug ?? null} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ status, stories, activeSlug }: { status: Status; stories: Item[]; activeSlug: string | null }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={`bg-surface-1 border border-white/[0.06] rounded-xl p-2.5 border-l-2 ${COLUMN_BORDER_BY_STATUS[status]} ${isOver ? 'ring-2 ring-accent/40' : ''}`}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary mb-2 px-1">{status}</div>
      <div className="space-y-2">
        {stories.map(s => <Card key={(s.data as any).id} story={s} activeSlug={activeSlug} />)}
      </div>
    </div>
  );
}

function Card({ story, activeSlug }: { story: Item; activeSlug: string | null }) {
  const d = story.data as { id: string; title: string };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: d.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`card-${d.id}`}
      className={`bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.16] rounded-md p-2.5 text-[12px] transition-colors ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="text-text-tertiary text-[10px] mb-0.5">{d.id}</div>
      <ProjectScopedLink activeSlug={activeSlug} to="/stories/$id" params={{ id: d.id }} className="block text-text-primary">{d.title}</ProjectScopedLink>
    </div>
  );
}
