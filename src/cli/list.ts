import { Command } from 'commander';
import pc from 'picocolors';
import { walkSpine } from '../core/spine';
import type { Item } from '../core/types';
import type { ItemKind, Status } from '../core/state-machine';
import { getPhase, getParent, getId, getTitle, getStatus, getOrder } from '../core/item-helpers';

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
    if (opts.phase && getPhase(item) !== opts.phase) return false;
    if (opts.status && item.data.status !== opts.status) return false;
    if (opts.parent && getParent(item) !== opts.parent) return false;
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
      const phase = getPhase(item) ? pc.cyan(getPhase(item)!) : pc.dim('—');
      const order = getOrder(item) ? String(getOrder(item)).padStart(3) : '   ';
      console.log(
        `${pc.bold(getId(item).padEnd(12))} ${phase.padEnd(20)} ${order}  ${pc.yellow(getStatus(item).padEnd(12))}  ${getTitle(item)}`,
      );
    }
  });
