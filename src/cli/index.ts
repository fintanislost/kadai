#!/usr/bin/env bun
import { Command } from 'commander';

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.parseAsync(process.argv);
