import { Command } from 'commander';
import pc from 'picocolors';
import { syncChangelogs, type SyncResult, type SyncOptions } from '../core/sync';

export function runSync(rootDir: string, opts: SyncOptions): SyncResult {
  return syncChangelogs(rootDir, opts);
}

interface SyncCliOptions {
  since?: string;
  branch?: string;
  dryRun?: boolean;
}

export const syncCommand = new Command('sync')
  .description('Scan git log for kadai item references (EPIC-/FEAT-/STORY-/TASK-NNN) and append matching commits to changelog.md')
  .option('--since <ref>', 'only scan commits since this git ref (commit/tag/branch); equivalent to git log <ref>..HEAD')
  .option('--branch <name>', 'scan a specific branch instead of HEAD')
  .option('--dry-run', 'show what would be appended without writing')
  .action((opts: SyncCliOptions) => {
    const result = runSync(process.cwd(), {
      since: opts.since,
      branch: opts.branch,
      dryRun: opts.dryRun,
    });
    const verb = opts.dryRun ? 'Would append' : 'Appended';
    console.log(pc.green(`✓ Scanned ${result.scanned} commits — ${verb} ${result.appended} entries`));
    const ids = Object.keys(result.byId);
    if (ids.length > 0) {
      ids.sort();
      for (const id of ids) {
        console.log(`  ${pc.cyan(id)}: ${result.byId[id]}`);
      }
    }
    if (result.transitionedToDone.length > 0) {
      console.log(pc.green(`✓ Auto-transitioned to done: ${result.transitionedToDone.join(', ')}`));
    }
  });
