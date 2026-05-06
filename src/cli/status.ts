import { Command } from 'commander';
import pc from 'picocolors';
import { walkSpine } from '../core/spine';
import { readPicked } from '../core/picked';
import type { Item } from '../core/types';
import { getId, getTitle } from '../core/item-helpers';

export interface StatusReport {
  picked: Item | null;
  readyStories: Item[];
  inProgress: Item[];
}

export function computeStatus(rootDir: string): StatusReport {
  const items = walkSpine(rootDir);
  const pickedId = readPicked(rootDir);
  const picked = pickedId ? (items.find(i => i.data.id === pickedId) ?? null) : null;
  const readyStories = items.filter(i => i.kind === 'story' && i.data.status === 'ready');
  const inProgress = items.filter(i => i.data.status === 'in_progress');
  return { picked, readyStories, inProgress };
}

export const statusCommand = new Command('status')
  .description('Show picked story, queue, and in-progress items')
  .action(() => {
    const s = computeStatus(process.cwd());
    if (s.picked) {
      console.log(pc.bold('Picked: ') + pc.green(getId(s.picked)) + ' — ' + getTitle(s.picked));
    } else {
      console.log(pc.bold('Picked: ') + pc.dim('(nothing)'));
    }

    console.log('\n' + pc.bold('In progress (' + s.inProgress.length + '):'));
    for (const item of s.inProgress) {
      console.log('  ' + getId(item).padEnd(12) + ' ' + getTitle(item));
    }

    console.log('\n' + pc.bold('Ready stories (' + s.readyStories.length + '):'));
    for (const item of s.readyStories) {
      console.log('  ' + getId(item).padEnd(12) + ' ' + getTitle(item));
    }
  });
