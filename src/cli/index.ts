#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './init';
import { addCommand } from './add';
import { listCommand } from './list';
import { statusCommand } from './status';
import { pickCommand, unpickCommand } from './pick';
import { setStatusCommand } from './set-status';
import { phasesCommand } from './phases';
import { configCommand } from './config';
import { mcpCommand } from './mcp';
import { hookCommand } from './hook';
import { serveCommand } from './serve';
import { getCommand } from './get';
import { syncCommand } from './sync';
import { uninstallCommand } from './uninstall';
import { composeCommand } from './compose';
import { runCommand } from './run';
import { disableCommand } from './disable';
import { enableCommand } from './enable';
import { appendCallToCassette } from '../cassette/recorder';

let alreadyRecorded = false;
function recordOnce(exit: number) {
  if (alreadyRecorded) return;
  alreadyRecorded = true;
  appendCallToCassette({ argv: process.argv.slice(2), exit });
}

const originalExit = process.exit.bind(process);
process.exit = ((code?: number) => {
  recordOnce(code ?? 0);
  return originalExit(code);
}) as typeof process.exit;

process.on('exit', (code) => recordOnce(code));

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(statusCommand);
program.addCommand(pickCommand);
program.addCommand(unpickCommand);
program.addCommand(setStatusCommand);
program.addCommand(phasesCommand);
program.addCommand(configCommand);
program.addCommand(mcpCommand);
program.addCommand(hookCommand);
program.addCommand(serveCommand);
program.addCommand(getCommand);
program.addCommand(syncCommand);
program.addCommand(uninstallCommand);
program.addCommand(disableCommand);
program.addCommand(enableCommand);

const planCommand = new Command('plan')
  .description('Plan composition + analysis tools');
planCommand.addCommand(composeCommand);
program.addCommand(planCommand);
program.addCommand(runCommand);

program.parseAsync(process.argv);
