import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listCommits, type Commit, type ListCommitsOptions } from './git';
import { findById } from './spine';
import { setStatus } from './operations';
import { isLegalTransition } from './state-machine';
import { loadConfig } from '../config/load';

export interface SyncOptions extends ListCommitsOptions {
  dryRun?: boolean;
}

export interface SyncResult {
  scanned: number;
  appended: number;
  byId: Record<string, number>;
  transitionedToDone: string[];
}

const ID_PATTERN = /\b(?:EPIC|FEAT|STORY|TASK)-\d+\b/g;
const PR_MERGE_PATTERN = /^Merge pull request #\d+/;

export function extractIdRefs(text: string): string[] {
  const matches = text.match(ID_PATTERN);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

function changelogPath(rootDir: string, itemId: string): string | null {
  const item = findById(rootDir, itemId);
  if (!item) return null;
  return join(dirname(item.path), 'changelog.md');
}

function alreadyHasSha(path: string, sha: string): boolean {
  if (!existsSync(path)) return false;
  const short = sha.slice(0, 7);
  const text = readFileSync(path, 'utf8');
  return text.includes(`\`commit\` ${short}`) || text.includes(`\`commit\` ${sha}`);
}

function buildChangelogLine(commit: Commit): string {
  const short = commit.sha.slice(0, 7);
  return `- ${commit.dateIso} \`commit\` ${short} ${commit.subject}\n`;
}

export function syncChangelogs(rootDir: string, opts: SyncOptions = {}): SyncResult {
  const commits = listCommits(rootDir, opts);
  const result: SyncResult = { scanned: commits.length, appended: 0, byId: {}, transitionedToDone: [] };
  const config = loadConfig(rootDir);
  const autoDone = config.auto_transitions.pr_merge_marks_story_done;

  for (const c of commits) {
    const refs = extractIdRefs(`${c.subject}\n${c.body}`);
    for (const id of refs) {
      const path = changelogPath(rootDir, id);
      if (!path) continue;  // ID doesn't resolve to an item — skip
      if (alreadyHasSha(path, c.sha)) continue;

      if (!opts.dryRun) {
        appendFileSync(path, buildChangelogLine(c), 'utf8');
      }
      result.appended += 1;
      result.byId[id] = (result.byId[id] ?? 0) + 1;
    }

    if (autoDone && PR_MERGE_PATTERN.test(c.subject)) {
      for (const id of refs) {
        if (!id.startsWith('STORY-')) continue;
        const item = findById(rootDir, id);
        if (!item) continue;
        if (item.data.status === 'done') continue;
        if (!isLegalTransition('story', item.data.status, 'done')) continue;
        if (!opts.dryRun) {
          setStatus(rootDir, id, 'done');
        }
        result.transitionedToDone.push(id);
      }
    }
  }

  return result;
}
