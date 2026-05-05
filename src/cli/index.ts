#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './init';
import { addCommand } from './add';

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(addCommand);

program.parseAsync(process.argv);
