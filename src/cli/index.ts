#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './init';
import { addCommand } from './add';
import { listCommand } from './list';
import { statusCommand } from './status';
import { pickCommand, unpickCommand } from './pick';
import { phasesCommand } from './phases';
import { configCommand } from './config';
import { mcpCommand } from './mcp';
import { hookCommand } from './hook';
import { serveCommand } from './serve';
import { getCommand } from './get';

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
program.addCommand(phasesCommand);
program.addCommand(configCommand);
program.addCommand(mcpCommand);
program.addCommand(hookCommand);
program.addCommand(serveCommand);
program.addCommand(getCommand);

program.parseAsync(process.argv);
