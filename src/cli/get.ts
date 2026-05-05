import { Command } from 'commander';
import pc from 'picocolors';
import { findById } from '../core/spine';

export const getCommand = new Command('get')
  .description('Fetch a single item by ID and print as JSON')
  .argument('<id>', 'item ID like EPIC-001 or STORY-042')
  .action((id: string) => {
    const item = findById(process.cwd(), id);
    if (!item) {
      console.error(pc.red(`Item not found: ${id}`));
      process.exit(1);
    }
    console.log(JSON.stringify(item, null, 2));
  });
