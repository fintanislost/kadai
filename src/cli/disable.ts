import { Command } from 'commander';
import pc from 'picocolors';
import { findKadaiRoot } from '../core/find-root';
import { isDisabled, setDisabled, getDisabledInfo } from '../core/toggle';

export const disableCommand = new Command('disable')
  .description('Disable kadai in this project — hooks no-op, mutations error, web shows banner')
  .option('--reason <text>', 'optional reason recorded in .kadai/disabled')
  .action((opts: { reason?: string }) => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }
    if (isDisabled(root)) {
      const info = getDisabledInfo(root);
      const reasonStr = info?.reason ? ` reason: ${info.reason}` : '';
      process.stdout.write(pc.yellow(`kadai is already disabled (since ${info?.since};${reasonStr}). To change the reason, \`kadai enable\` first then \`kadai disable --reason "..."\`.\n`));
      return;
    }
    setDisabled(root, opts.reason);
    const reasonNote = opts.reason ? ` reason: "${opts.reason}"` : '';
    process.stdout.write(pc.green(`✓ kadai disabled in this project.${reasonNote}\n`));
    process.stdout.write(pc.dim(`  Hooks no-op, mutations refused, web shows banner. Run \`kadai enable\` to restore.\n`));
  });
