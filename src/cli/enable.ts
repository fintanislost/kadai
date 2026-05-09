import { Command } from 'commander';
import pc from 'picocolors';
import { findKadaiRoot } from '../core/find-root';
import { isDisabled, clearDisabled } from '../core/toggle';

export const enableCommand = new Command('enable')
  .description('Re-enable kadai in this project (clears the disabled flag)')
  .action(() => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }
    if (!isDisabled(root)) {
      process.stdout.write(pc.dim(`kadai is already enabled in this project.\n`));
      return;
    }
    clearDisabled(root);
    process.stdout.write(pc.green(`✓ kadai re-enabled in this project.\n`));
  });
