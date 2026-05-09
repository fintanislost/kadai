import { Command } from 'commander';
import pc from 'picocolors';
import { assertEnabled } from '../core/toggle';
import { setPicked, clearPicked } from '../core/picked';
import { setStatus } from '../core/operations';
import { findById } from '../core/spine';
import { parseId } from '../core/ids';

export function runPick(rootDir: string, storyId: string): void {
  const parsed = parseId(storyId);
  if (!parsed || parsed.kind !== 'story') {
    throw new Error(`Only stories can be picked (got ${storyId})`);
  }
  const item = findById(rootDir, storyId);
  if (!item) throw new Error(`Story not found: ${storyId}`);
  if (item.data.status !== 'in_progress') {
    setStatus(rootDir, storyId, 'in_progress');
  }
  setPicked(rootDir, storyId);
}

export function runUnpick(rootDir: string): void {
  clearPicked(rootDir);
}

export const pickCommand = new Command('pick')
  .description('Pick a story for active work (sets it as picked and transitions to in_progress)')
  .argument('<story-id>', 'story ID like STORY-042')
  .action((storyId: string) => {
    assertEnabled();
    runPick(process.cwd(), storyId);
    console.log(pc.green('✓ picked ' + storyId));
  });

export const unpickCommand = new Command('unpick')
  .description('Clear the picked story (does not change status)')
  .action(() => {
    assertEnabled();
    runUnpick(process.cwd());
    console.log(pc.green('✓ unpicked'));
  });
