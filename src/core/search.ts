import { walkSpine } from './spine';
import type { Item } from './types';
import type { ItemKind, Status } from './state-machine';

export interface SearchResult {
  id: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  status: Status;
  matchType: 'title' | 'body' | 'acceptance';
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 50;
const SNIPPET_MAX = SNIPPET_BEFORE + SNIPPET_AFTER + 2;  // +2 for the two ellipsis chars
const MIN_QUERY = 2;

/**
 * Build a snippet ~80 chars long centered on the first case-insensitive match of
 * `query` inside `text`. Returns offsets into `snippet` (NOT into `text`) so the
 * caller can highlight without a second search.
 */
export function makeSnippet(text: string, query: string): { snippet: string; matchStart: number; matchEnd: number } {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) {
    return { snippet: text.slice(0, SNIPPET_MAX), matchStart: 0, matchEnd: 0 };
  }
  if (text.length <= SNIPPET_MAX) {
    return { snippet: text, matchStart: idx, matchEnd: idx + query.length };
  }
  const start = Math.max(0, idx - SNIPPET_BEFORE);
  const end = Math.min(text.length, idx + query.length + SNIPPET_AFTER);
  let snippet = text.slice(start, end);
  let matchStart = idx - start;
  if (start > 0) {
    snippet = '…' + snippet;
    matchStart += 1;
  }
  if (end < text.length) {
    snippet = snippet + '…';
  }
  return { snippet, matchStart, matchEnd: matchStart + query.length };
}

function buildResult(item: Item, query: string): SearchResult | null {
  const lq = query.toLowerCase();
  const data = item.data as { id: string; title: string; phase?: string; status: Status; acceptance_criteria?: string[] };

  if (data.title.toLowerCase().includes(lq)) {
    const s = makeSnippet(data.title, query);
    return {
      id: data.id,
      kind: item.kind,
      title: data.title,
      phase: data.phase,
      status: data.status,
      matchType: 'title',
      snippet: s.snippet,
      matchStart: s.matchStart,
      matchEnd: s.matchEnd,
    };
  }

  if (data.acceptance_criteria) {
    for (const criterion of data.acceptance_criteria) {
      if (criterion.toLowerCase().includes(lq)) {
        const s = makeSnippet(criterion, query);
        return {
          id: data.id,
          kind: item.kind,
          title: data.title,
          phase: data.phase,
          status: data.status,
          matchType: 'acceptance',
          snippet: s.snippet,
          matchStart: s.matchStart,
          matchEnd: s.matchEnd,
        };
      }
    }
  }

  if (item.body.toLowerCase().includes(lq)) {
    const s = makeSnippet(item.body, query);
    return {
      id: data.id,
      kind: item.kind,
      title: data.title,
      phase: data.phase,
      status: data.status,
      matchType: 'body',
      snippet: s.snippet,
      matchStart: s.matchStart,
      matchEnd: s.matchEnd,
    };
  }

  return null;
}

export function searchSpine(rootDir: string, query: string): SearchResult[] {
  if (query.length < MIN_QUERY) return [];
  const items = walkSpine(rootDir);
  const results: SearchResult[] = [];
  for (const item of items) {
    const r = buildResult(item, query);
    if (r) results.push(r);
  }
  // Sort: title matches first, then acceptance, then body.
  const order = { title: 0, acceptance: 1, body: 2 } as const;
  results.sort((a, b) => order[a.matchType] - order[b.matchType]);
  return results;
}
