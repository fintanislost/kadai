import { Command } from 'commander';
import pc from 'picocolors';
import { setStatus } from '../core/operations';
import type { Status } from '../core/state-machine';

const STATUS_VALUES = [
  'backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled',
] as const;

export function runSetStatus(rootDir: string, id: string, status: Status): void {
  setStatus(rootDir, id, status);
}

export const setStatusCommand = new Command('set-status')
  .description('Update the status of any kadai item, validated against the state machine')
  .argument('<id>', 'item ID like EPIC-001 or STORY-042')
  .argument('<status>', `target status (${STATUS_VALUES.join('|')})`)
  .option('-r, --reason <text>', 'reason for the change (logged but not persisted in this MVP)')
  .action((id: string, status: string, opts: { reason?: string }) => {
    if (!STATUS_VALUES.includes(status as Status)) {
      console.error(pc.red(`Invalid status: ${status}. Must be one of: ${STATUS_VALUES.join(', ')}`));
      process.exit(2);
    }
    try {
      runSetStatus(process.cwd(), id, status as Status);
      const reasonNote = opts.reason ? ` (reason: ${opts.reason})` : '';
      console.log(pc.green(`✓ ${id} → ${status}${reasonNote}`));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(pc.red(msg));
      process.exit(1);
    }
  });
