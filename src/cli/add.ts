import { dirname } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import { nextId, parseId } from '../core/ids';
import { writeItem } from '../core/writer';
import { findById, walkSpine } from '../core/spine';
import { nextOrder } from '../core/ordering';
import type { ItemKind } from '../core/state-machine';
import type { AnyFrontmatter } from '../core/types';
import { getPhase, getParent, getOrder } from '../core/item-helpers';

export interface AddOptions {
  rootDir: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  order?: number;
  parent?: string;
  body?: string;
  acceptance_criteria?: string[];
  plan_step?: number;
}

const PARENT_KIND: Record<ItemKind, ItemKind | null> = {
  epic: null,
  feature: 'epic',
  story: 'feature',
  task: 'story',
};

export function runAdd(opts: AddOptions): string {
  const expectedParentKind = PARENT_KIND[opts.kind];
  if (expectedParentKind && !opts.parent) {
    throw new Error(`parent required for ${opts.kind}`);
  }
  let parentItem = null;
  if (opts.parent) {
    const parsed = parseId(opts.parent);
    if (!parsed) throw new Error(`invalid parent ID: ${opts.parent}`);
    if (parsed.kind !== expectedParentKind) {
      throw new Error(`parent must be a ${expectedParentKind} (got ${parsed.kind})`);
    }
    parentItem = findById(opts.rootDir, opts.parent);
    if (!parentItem) throw new Error(`parent not found: ${opts.parent}`);
  }

  const id = nextId(opts.kind, opts.rootDir);
  const today = new Date().toISOString().slice(0, 10);

  const data: Record<string, unknown> = {
    id,
    title: opts.title,
    status: 'ready',
    created: today,
    updated: today,
  };
  if (opts.parent) data.parent = opts.parent;

  if (opts.kind !== 'task') {
    if (!opts.phase) throw new Error(`phase required for ${opts.kind}`);
    data.phase = opts.phase;
    if (typeof opts.order === 'number') {
      data.order = opts.order;
    } else {
      const siblings = walkSpine(opts.rootDir).filter(
        i => i.kind === opts.kind && getPhase(i) === opts.phase
          && (!opts.parent || getParent(i) === opts.parent),
      ).map(i => ({ order: getOrder(i) ?? 0 }));
      data.order = nextOrder(siblings);
    }
  }

  if (opts.kind === 'story' && opts.acceptance_criteria) {
    data.acceptance_criteria = opts.acceptance_criteria;
  }
  if (opts.kind === 'task' && typeof opts.plan_step === 'number') {
    data.plan_step = opts.plan_step;
  }

  const ctx = { rootDir: opts.rootDir, parentPath: parentItem ? dirname(parentItem.path) : undefined };
  const body = opts.body ?? '## Description\n\n_Add a description here._\n';
  writeItem(opts.kind, data as unknown as AnyFrontmatter, body, ctx);
  return id;
}

export const addCommand = new Command('add')
  .description('Create an epic, feature, story, or task')
  .argument('<kind>', 'kind of item (epic|feature|story|task)')
  .option('-t, --title <title>', 'title of the item')
  .option('-p, --phase <phase>', 'phase slug (e.g. mvp)')
  .option('-o, --order <n>', 'explicit order within phase', (v) => parseInt(v, 10))
  .option('--parent <id>', 'parent item ID (required except for epics)')
  .option('--epic <id>', 'parent epic ID — alias for --parent when adding a feature')
  .option('--feature <id>', 'parent feature ID — alias for --parent when adding a story')
  .option('--story <id>', 'parent story ID — alias for --parent when adding a task')
  .action(async (kind: string, opts: { title?: string; phase?: string; order?: number; parent?: string; epic?: string; feature?: string; story?: string }) => {
    if (!['epic', 'feature', 'story', 'task'].includes(kind)) {
      throw new Error(`unknown kind: ${kind}`);
    }
    const k = kind as ItemKind;
    let title = opts.title;
    let phase = opts.phase;
    // Resolve parent from --parent or kind-specific alias (--epic / --feature / --story).
    // First match wins; if multiple are given, prefer --parent for explicitness.
    let parent = opts.parent ?? opts.epic ?? opts.feature ?? opts.story;

    if (!title) {
      const r = await prompts({ type: 'text', name: 'title', message: `${k} title:` });
      title = r.title;
    }
    if (!title) throw new Error('title is required');

    if (k !== 'task' && !phase) {
      const r = await prompts({
        type: 'text', name: 'phase', message: 'phase slug:', initial: 'mvp',
      });
      phase = r.phase ?? 'mvp';
    }

    if (PARENT_KIND[k] && !parent) {
      const r = await prompts({
        type: 'text', name: 'parent', message: `parent ${PARENT_KIND[k]} ID:`,
      });
      parent = r.parent;
    }

    const id = runAdd({
      rootDir: process.cwd(),
      kind: k,
      title,
      phase,
      order: opts.order,
      parent,
    });
    console.log(pc.green(`✓ created ${id}`));
  });
