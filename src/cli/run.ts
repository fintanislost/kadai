import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { findKadaiRoot } from '../core/find-root';
import { readState, writeState, transition } from '../runner/state';
import { runStory, type Dispatcher } from '../runner/dispatch';

export type RunOnceResult =
  | { kind: 'story-done' }
  | { kind: 'paused-review' }
  | { kind: 'paused-needs-feature'; description: string }
  | { kind: 'paused-blocked'; reason: string }
  | { kind: 'no-story-picked' }
  | { kind: 'resumed' };

export async function runOnce(rootDir: string, dispatcher: Dispatcher): Promise<RunOnceResult> {
  const pickedPath = join(rootDir, '.kadai/picked');
  if (!existsSync(pickedPath)) return { kind: 'no-story-picked' };
  const storyId = readFileSync(pickedPath, 'utf8').trim();

  let state = readState(rootDir);
  // If we're idle, transition to running.
  if (state.status === 'idle') {
    state = transition(state, { kind: 'start', storyId });
    writeState(rootDir, state);
  }

  const result = await runStory(rootDir, storyId, dispatcher);

  if (result.kind === 'story-done') {
    // Did this story have a paused-stack waiter (i.e., was this an unblocker)?
    if (state.pausedStack.length > 0) {
      // Resume the prior story. State is already 'running'; resume-paused is allowed
      // from 'running' precisely so this transition works without an intermediate step.
      const popped = transition(state, { kind: 'resume-paused' });
      writeState(rootDir, popped);
      return { kind: 'resumed' };
    }
    state = transition(state, { kind: 'story-done' });
    writeState(rootDir, state);
    return { kind: 'paused-review' };
  }

  if (result.kind === 'needs-feature') {
    state = transition(state, { kind: 'needs-feature', description: result.description });
    writeState(rootDir, state);
    return { kind: 'paused-needs-feature', description: result.description };
  }

  if (result.kind === 'blocked') {
    state = transition(state, { kind: 'block', blocker: result.blocker });
    writeState(rootDir, state);
    const reason = result.blocker.kind === 'generic' ? result.blocker.reason : result.blocker.description;
    return { kind: 'paused-blocked', reason };
  }

  // result.kind === 'error'
  return { kind: 'paused-blocked', reason: result.message };
}

export const runCommand = new Command('run')
  .description("Autonomous runner — execute the picked story's plan task-by-task")
  .option('--resume', 'resume from paused state instead of starting fresh')
  .option('--status', 'just print runner state, do nothing')
  .action(async (opts: { resume?: boolean; status?: boolean }) => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }

    if (opts.status) {
      const state = readState(root);
      process.stdout.write(JSON.stringify(state, null, 2) + '\n');
      return;
    }

    // The CLI version of the runner uses a no-op dispatcher placeholder — the real
    // dispatcher requires Claude Code's Task tool, which only runs inside a Claude
    // Code session. From the CLI, we just print the next-action prompt and exit.
    process.stdout.write(
      'kadai run from the CLI is informational only — it prints state.\n' +
      'To actually run, use the /kadai-run slash command from Claude Code.\n' +
      JSON.stringify(readState(root), null, 2) + '\n'
    );
  });
