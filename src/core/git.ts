import { execFileSync } from 'node:child_process';

export interface Commit {
  sha: string;
  dateIso: string;
  subject: string;
  body: string;
}

export interface ListCommitsOptions {
  since?: string;
  branch?: string;
}

const FIELD_SEP = '\x1e';
const COMMIT_SEP = '\x1f';

/**
 * Run `git log` once and return parsed commits. Returns [] if the directory
 * isn't a git repo or has no commits. Newest-first (git's default).
 */
export function listCommits(rootDir: string, opts: ListCommitsOptions = {}): Commit[] {
  const args = [
    'log',
    `--pretty=format:%H${FIELD_SEP}%aI${FIELD_SEP}%s${FIELD_SEP}%b${COMMIT_SEP}`,
  ];
  if (opts.since) {
    const head = opts.branch ?? 'HEAD';
    args.push(`${opts.since}..${head}`);
  } else if (opts.branch) {
    args.push(opts.branch);
  }

  let raw: string;
  try {
    raw = execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return [];
  }

  return parseGitLogOutput(raw);
}

export function parseGitLogOutput(raw: string): Commit[] {
  const trimmed = raw.replace(new RegExp(`${COMMIT_SEP}$`), '');
  if (!trimmed) return [];
  return trimmed.split(COMMIT_SEP).map(chunk => {
    const fields = chunk.split(FIELD_SEP);
    return {
      sha: (fields[0] ?? '').trim(),
      dateIso: (fields[1] ?? '').trim(),
      subject: fields[2] ?? '',
      body: (fields[3] ?? '').trim(),
    };
  }).filter(c => c.sha.length > 0);
}
