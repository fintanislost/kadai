import { Command } from 'commander';
import pc from 'picocolors';
import { findKadaiRoot } from '../core/find-root';
import {
  clearDisabled,
  isGloballyDisabled,
  clearGloballyDisabled,
} from '../core/toggle';
import { existsSync } from 'node:fs';

interface EnableOpts {
  global?: boolean;
}

export const enableCommand = new Command('enable')
  .description('Re-enable kadai (clears the disabled flag)')
  .option('--global', 'clear the global disabled flag (~/.kadai/disabled)')
  .action((opts: EnableOpts) => {
    if (opts.global) {
      if (!isGloballyDisabled()) {
        process.stdout.write(pc.dim(`kadai is not disabled globally.\n`));
        return;
      }
      clearGloballyDisabled();
      process.stdout.write(pc.green(`✓ kadai re-enabled globally.\n`));
      if (process.env.KADAI_DISABLED === '1' || process.env.KADAI_DISABLED === 'true') {
        process.stdout.write(pc.yellow(`  Note: KADAI_DISABLED is still set in this shell — run \`unset KADAI_DISABLED\` to fully re-enable.\n`));
      }
      return;
    }

    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project (use --global to clear the global flag)\n'); process.exit(1); }
    // Check the PROJECT file specifically — symmetric with `disable` (no --global).
    if (!existsSync(`${root}/.kadai/disabled`)) {
      process.stdout.write(pc.dim(`kadai is already enabled in this project.\n`));
      if (isGloballyDisabled()) {
        process.stdout.write(pc.yellow(`  Note: kadai is still disabled GLOBALLY (~/.kadai/disabled). Run \`kadai enable --global\` to clear that.\n`));
      }
      return;
    }
    clearDisabled(root);
    process.stdout.write(pc.green(`✓ kadai re-enabled in this project.\n`));
    if (isGloballyDisabled()) {
      process.stdout.write(pc.yellow(`  Note: kadai is still disabled GLOBALLY (~/.kadai/disabled). Run \`kadai enable --global\` to clear that too.\n`));
    }
    if (process.env.KADAI_DISABLED === '1' || process.env.KADAI_DISABLED === 'true') {
      process.stdout.write(pc.yellow(`  Note: KADAI_DISABLED is set in this shell — run \`unset KADAI_DISABLED\` to fully re-enable.\n`));
    }
  });
