import { appendFileSync } from 'node:fs';

export interface CallRecord {
  argv: string[];
  exit: number;
}

export function appendCallToCassette(record: CallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  try {
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Best-effort — if the cassette file isn't writable, don't crash the CLI.
  }
}
