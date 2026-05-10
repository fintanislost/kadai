import { Command } from 'commander';
import pc from 'picocolors';
import { findKadaiRoot } from '../core/find-root';
import {
  setDisabled,
  setGloballyDisabled,
  isGloballyDisabled,
  getDisabledInfo,
} from '../core/toggle';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface DisableOpts {
  reason?: string;
  global?: boolean;
}

export const disableCommand = new Command('disable')
  .description('Disable kadai — hooks no-op, mutations error, web shows banner')
  .option('--reason <text>', 'optional reason recorded in the disabled flag file')
  .option('--global', 'disable kadai globally (writes ~/.kadai/disabled — affects every project)')
  .action((opts: DisableOpts) => {
    if (opts.global) {
      if (isGloballyDisabled()) {
        process.stdout.write(pc.yellow(
          `kadai is already disabled globally (${join(homedir(), '.kadai', 'disabled')}). To change the reason, \`kadai enable --global\` first.\n`,
        ));
        return;
      }
      setGloballyDisabled(opts.reason);
      const reasonNote = opts.reason ? ` reason: "${opts.reason}"` : '';
      process.stdout.write(pc.green(`✓ kadai disabled globally.${reasonNote}\n`));
      process.stdout.write(pc.dim(`  Affects every kadai project for this user. Run \`kadai enable --global\` to restore.\n`));
      process.stdout.write(pc.dim(`  For a one-shot disable in the current shell, use: export KADAI_DISABLED=1\n`));
      return;
    }

    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project (use --global to disable globally)\n'); process.exit(1); }
    // Check the PROJECT file specifically — not isDisabled(), which is true if
    // global or env are set. The user explicitly said they want project-scope here.
    if (existsSync(`${root}/.kadai/disabled`)) {
      const info = getDisabledInfo(root);
      const reasonStr = info?.reason ? ` reason: ${info.reason}` : '';
      process.stdout.write(pc.yellow(`kadai is already disabled in this project (since ${info?.since};${reasonStr}). To change the reason, \`kadai enable\` first then \`kadai disable --reason "..."\`.\n`));
      return;
    }
    setDisabled(root, opts.reason);
    const reasonNote = opts.reason ? ` reason: "${opts.reason}"` : '';
    process.stdout.write(pc.green(`✓ kadai disabled in this project.${reasonNote}\n`));
    process.stdout.write(pc.dim(`  Hooks no-op, mutations refused, web shows banner. Run \`kadai enable\` to restore.\n`));
    if (isGloballyDisabled()) {
      process.stdout.write(pc.dim(`  (Note: kadai was already disabled globally — this adds a project-scope flag too.)\n`));
    }
  });
