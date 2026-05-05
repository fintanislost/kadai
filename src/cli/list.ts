import { Command } from 'commander';
import pc from 'picocolors';
import { walkSpine } from '../core/spine';
import type { Item } from '../core/types';
import type { ItemKind, Status } from '../core/state-machine';

export interface ListOptions {
  rootDir: string;
  kind: ItemKind;
  phase?: string;
  status?: Status;
  parent?: string;
}

export function runList(opts: ListOptions): Item[] {
  return walkSpine(opts.rootDir).filter(item => {
    if (item.kind !== opts.kind) return false;
    if (opts.phase && (item.data as any).phase !== opts.phase) return false;
    if (opts.status && item.data.status !== opts.status) return false;
    if (opts.parent && (item.data as any).parent !== opts.parent) return false;
    return true;
  });
}

export const listCommand = new Command('list')
  .description('List items in the spine')
  .argument('<kind>', 'kind of item (epic|feature|story|task)')
  .option('-p, --phase <phase>', 'filter by phase')
  .option('-s, --status <status>', 'filter by status')
  .option('--parent <id>', 'filter by parent ID')
  .action((kind: string, opts: { phase?: string; status?: Status; parent?: string }) => {
    const items = runList({
      rootDir: process.cwd(),
      kind: kind as ItemKind,
      phase: opts.phase,
      status: opts.status,
      parent: opts.parent,
    });
    if (items.length === 0) {
      console.log(pc.dim('(no items match)'));
      return;
    }
    for (const item of items) {
      const d = item.data as any;
      const phase = d.phase ? pc.cyan(d.phase) : pc.dim('—');
      const order = d.order ? String(d.order).padStart(3) : '   ';
      console.log(
        `${pc.bold(d.id.padEnd(12))} ${phase.padEnd(20)} ${order}  ${pc.yellow(d.status.padEnd(12))}  ${d.title}`,
      );
    }
  });
