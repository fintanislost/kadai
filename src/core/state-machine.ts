export type Status =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'done'
  | 'cancelled';

export type ItemKind = 'epic' | 'feature' | 'story' | 'task';

const TRANSITIONS: Record<Status, ReadonlyArray<Status>> = {
  backlog:     ['ready', 'cancelled'],
  ready:       ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'review', 'done', 'cancelled'],
  blocked:     ['in_progress', 'cancelled'],
  review:      ['in_progress', 'done', 'cancelled'],
  done:        [],
  cancelled:   [],
};

function involvesReview(from: Status, to: Status): boolean {
  return from === 'review' || to === 'review';
}

export function isLegalTransition(kind: ItemKind, from: Status, to: Status): boolean {
  if (kind !== 'story' && involvesReview(from, to)) return false;
  return TRANSITIONS[from].includes(to);
}

export function legalNextStates(kind: ItemKind, from: Status): Status[] {
  return TRANSITIONS[from].filter(s => kind === 'story' || s !== 'review');
}
