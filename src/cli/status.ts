import { Command } from 'commander';
import pc from 'picocolors';
import { walkSpine } from '../core/spine';
import { readPicked } from '../core/picked';
import type { Item } from '../core/types';

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
      const d = s.picked.data as any;
      console.log(pc.bold('Picked: ') + pc.green(d.id) + ' — ' + d.title);
    } else {
      console.log(pc.bold('Picked: ') + pc.dim('(nothing)'));
    }

    console.log('\n' + pc.bold('In progress (' + s.inProgress.length + '):'));
    for (const item of s.inProgress) {
      const d = item.data as any;
      console.log('  ' + d.id.padEnd(12) + ' ' + d.title);
    }

    console.log('\n' + pc.bold('Ready stories (' + s.readyStories.length + '):'));
    for (const item of s.readyStories) {
      const d = item.data as any;
      console.log('  ' + d.id.padEnd(12) + ' ' + d.title);
    }
  });
