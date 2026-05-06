# Kadai Plan 17 — Web viewer redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the web viewer's visual identity + page-level structure per [`docs/superpowers/specs/2026-05-06-web-viewer-redesign-design.md`](../specs/2026-05-06-web-viewer-redesign-design.md). Calmer surfaces (one neutral + elevation), one accent (teal-300) used sparingly, JetBrains Mono throughout, and a consistent **hero block + detail body** pattern across Story / Feature / Epic / Home with an optional **TreeView** for subtree drilldown.

**Architecture:** Strictly additive on the data side (no API contract changes besides one new read endpoint). New shared components live in `src/web/frontend/src/components/` and replace ad-hoc layouts in the page files. Design tokens move into `tailwind.config.js` + `styles.css`. JetBrains Mono comes via `@fontsource/jetbrains-mono`. The View toggle in each hero is a URL search param (`?view=tree`) so bookmarks survive.

**Tech Stack:** TypeScript on Bun (existing). React 19 + TanStack Router + Tailwind v3 (existing). New runtime deps: `@fontsource/jetbrains-mono` only.

## Position in the build

| | |
|---|---|
| **This is plan** | 17 of N |
| **Prior plan** | [Plan 16 — Visual polish](2026-05-06-kadai-16-visual-polish.md) — `DONE` (consistency pass; partially superseded by this redesign) |
| **Spec** | [`docs/superpowers/specs/2026-05-06-web-viewer-redesign-design.md`](../specs/2026-05-06-web-viewer-redesign-design.md) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## Mockup reference

Source-of-truth visual: `.superpowers/brainstorm/545722-1778075306/content/story-page-v2.html`. Open in a browser to confirm spacing / type / color choices match the spec.

## Spec → tasks map

| Spec section | Task |
|---|---|
| Design tokens (surfaces, accent, status, type, spacing) + JetBrains Mono | 1 |
| Topbar refresh | 1 |
| Foundation components (Hero, Card, ProgressBar, IdPill, Breadcrumb, DocumentRow) | 2 |
| TreeView component + new `/api/items/:id/subtree` endpoint | 3 |
| Story page rebuild | 4 |
| Feature page rebuild (Stories list as Mode A; kanban via "Open kanban" button) | 5 |
| Epic page rebuild | 6 |
| Home page rebuild | 7 |
| Token polish for Search/Activity/Compare/Projects | 8 |
| Docs + plugin v1.3.0 + dogfood | 9 |

## Resolved spec ambiguity

The spec describes Mode B as a TreeView reachable from Epic / Feature / Story pages, AND separately calls the Feature page's existing kanban "Mode B for this page." These conflict. **Resolution for this plan:**

- **Story page:** View toggle = [Detail | Tree]
- **Feature page:** View toggle = [Detail | Tree], with a separate **"Open kanban →"** button in the Stories card header (kanban is a workflow tool, tree is a navigation tool — they don't compete for the same toggle)
- **Epic page:** View toggle = [Detail | Tree]

The kanban stays as a routable view at `/features/:id?view=kanban` for backwards compatibility + bookmark safety.

## Known scope deviation from the spec

The spec describes a **Recent activity card** in the right column of Story / Feature / Epic pages. This plan **does not implement that card.** Reasons:

- It's described in the spec's page-level pattern section but **not** in the acceptance criteria — so it's not a ship blocker.
- For Story it would parse the already-fetched `changelog.md` (cheap), but for Feature / Epic it requires either fetching changelogs for every descendant or extending `/api/activity` with a subtree filter — non-trivial backend work.
- The global `/activity` page (token-polished in Task 8) already covers the activity-visibility need, reachable from every page via the topbar.

If this gap matters after the redesign ships, it becomes a small follow-up plan with one task per page kind.

## File structure

```
src/web/frontend/tailwind.config.js                       # MODIFIED: refined tokens
src/web/frontend/src/styles.css                           # MODIFIED: section-label, tabular-nums, fonts
src/web/frontend/src/main.tsx                             # MODIFIED: import @fontsource/jetbrains-mono
src/web/frontend/index.html                               # MODIFIED: <html class="font-mono"> default

src/web/frontend/src/components/Hero.tsx                  # NEW
src/web/frontend/src/components/Card.tsx                  # NEW
src/web/frontend/src/components/ProgressBar.tsx           # NEW
src/web/frontend/src/components/IdPill.tsx                # NEW
src/web/frontend/src/components/Breadcrumb.tsx            # NEW
src/web/frontend/src/components/DocumentRow.tsx           # NEW
src/web/frontend/src/components/TreeView.tsx              # NEW
src/web/frontend/src/components/Layout.tsx                # MODIFIED: refined topbar
src/web/frontend/src/components/StatusBadge.tsx           # MODIFIED: refined desaturation + dot
src/web/frontend/src/components/EpicCard.tsx              # MODIFIED: new tokens + IdPill
src/web/frontend/src/components/KanbanBoard.tsx           # MODIFIED: refined visual treatment

src/web/frontend/src/pages/Story.tsx                      # MODIFIED: hero + 2-col body, no tabs
src/web/frontend/src/pages/Feature.tsx                    # MODIFIED: hero + Stories list, kanban via toggle
src/web/frontend/src/pages/Epic.tsx                       # MODIFIED: hero + Features list
src/web/frontend/src/pages/Home.tsx                       # MODIFIED: project hero + per-phase grids
src/web/frontend/src/pages/Search.tsx                     # MODIFIED: token polish
src/web/frontend/src/pages/Activity.tsx                   # MODIFIED: token polish
src/web/frontend/src/pages/Compare.tsx                    # MODIFIED: token polish
src/web/frontend/src/pages/Projects.tsx                   # MODIFIED: token polish
src/web/frontend/src/router.tsx                           # MODIFIED: add ?view= search param to detail routes

src/web/api.ts                                             # MODIFIED: add GET /api/items/:id/subtree
src/web/frontend/src/api.ts                               # MODIFIED: add getSubtree client wrapper

tests/web/api.test.ts                                     # MODIFIED: + 3 tests for /api/items/:id/subtree
tests/web/e2e.pw.ts                                       # MODIFIED: selector updates for tabs→cards; + 2 tree-view E2E
package.json                                              # MODIFIED: + @fontsource/jetbrains-mono

docs/wiki/web-viewer.md                                   # MODIFIED: update to reflect new pattern
docs/wiki/post-mvp.md                                     # MODIFIED: Plan 17 → Recently shipped
docs/dogfood-acceptance-test.md                           # APPEND: Plan 17 verification
kadai-plugin/.claude-plugin/plugin.json                   # MODIFIED: 1.2.0 → 1.3.0
```

## Tasks

---

### Task 1: Design tokens + JetBrains Mono + topbar refresh

**Files:**
- Modify: `package.json` (add `@fontsource/jetbrains-mono`)
- Modify: `src/web/frontend/src/main.tsx` (import font)
- Modify: `src/web/frontend/tailwind.config.js` (token updates)
- Modify: `src/web/frontend/src/styles.css` (font-family, tabular-nums, section-label)
- Modify: `src/web/frontend/src/components/Layout.tsx` (refined topbar)
- Modify: `src/web/frontend/src/components/StatusBadge.tsx` (desaturated palette + dot)

**Goal:** Land the foundation visuals so subsequent tasks build on top of them. No new components yet — just tokens, font, topbar, and refined StatusBadge.

- [x] **Step 1: Install JetBrains Mono via @fontsource**

```bash
cd /home/fintan/repos/kadai
bun add @fontsource/jetbrains-mono@^5.0.0
```

Verify:
```bash
grep '"@fontsource/jetbrains-mono"' package.json
```

Expected: a `"@fontsource/jetbrains-mono": "^5.0.x"` line.

- [x] **Step 2: Import the font in main.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/main.tsx`. Add these imports near the top:

```typescript
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
```

- [x] **Step 3: Update tailwind.config.js with refined tokens**

Replace `/home/fintan/repos/kadai/src/web/frontend/tailwind.config.js` ENTIRELY with:

```javascript
/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Menlo', 'monospace'],
      },
      colors: {
        // Surfaces (single neutral + elevation via shadow, not bg variation)
        bg:               '#0c0c0e',
        'surface-1':      '#131318',
        'surface-2':      '#16161c',
        muted:            '#a1a1aa',
        'text-primary':   '#f4f4f5',
        'text-secondary': '#a1a1aa',
        'text-tertiary':  '#71717a',
        'text-quaternary':'#52525b',
        // Brand accent — used sparingly (one CTA per page)
        accent:           '#5eead4',
        'accent-fg':      '#042f2e',
        // Status palette — only used by StatusBadge + kanban borders
        'status-backlog':     '#a1a1aa',
        'status-ready':       '#93c5fd',
        'status-in_progress': '#fcd34d',
        'status-blocked':     '#fca5a5',
        'status-review':      '#c4b5fd',
        'status-done':        '#6ee7b7',
        'status-cancelled':   '#52525b',
      },
      boxShadow: {
        'elev-1': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.3)',
        'elev-2': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 4px 12px rgba(0,0,0,0.4)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [typography],
};
```

- [x] **Step 4: Update styles.css**

Replace `/home/fintan/repos/kadai/src/web/frontend/src/styles.css` ENTIRELY with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
  background: #0c0c0e;
  color: #f4f4f5;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'Cascadia Code', Menlo, monospace;
  font-feature-settings: 'cv11', 'ss01';
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* Skeleton loader */
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
}

/* Section-label utility */
.section-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(113 113 122);
}
.section-label-sm {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(113 113 122);
}
```

- [x] **Step 5: Refresh Layout.tsx topbar**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/Layout.tsx`. Replace the `<header>` element entirely (keep the `ProjectModeProvider` / `LiveUpdatesProvider` wrappers and the `<main>` body unchanged):

```tsx
<header className="bg-surface-1/70 backdrop-blur border-b border-white/[0.06] px-8 py-3">
  <div className="flex items-center gap-7 max-w-[1400px] mx-auto">
    <Link to="/" className="font-semibold tracking-tight flex items-center gap-2.5 text-[15px]">
      <span className="w-[18px] h-[18px] rounded bg-text-primary text-bg flex items-center justify-center text-[11px] font-extrabold tracking-tighter">k</span>
      Kadai
    </Link>
    <ProjectIndicator />
    <nav className="flex items-center gap-5 text-[13.5px]">
      <Link to="/activity" className="text-text-tertiary hover:text-text-primary transition-colors">Activity</Link>
      <Link to="/compare" className="text-text-tertiary hover:text-text-primary transition-colors">Compare</Link>
    </nav>
    <div className="flex-1 max-w-[380px]">
      <SearchBox />
    </div>
    <div className="text-sm">
      {picked ? (
        <span className="bg-white/[0.04] text-text-secondary border border-white/[0.10] rounded-md px-2.5 py-1 inline-flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-status-in_progress" />
          Picked: <span className="text-text-primary font-medium">{picked.data.id}</span>
        </span>
      ) : (
        <span className="text-text-tertiary text-xs">Nothing picked</span>
      )}
    </div>
  </div>
</header>
```

(Keep the existing data-loading useEffect for `picked` and `phases`; the phase pills are removed from the topbar — they move to the Home hero in Task 7.)

- [x] **Step 6: Refresh StatusBadge.tsx**

Replace `/home/fintan/repos/kadai/src/web/frontend/src/components/StatusBadge.tsx` ENTIRELY with:

```tsx
import type { Status } from '../types';

const COLORS: Record<Status, { bg: string; text: string; ring: string }> = {
  backlog:     { bg: 'bg-white/[0.04]',                 text: 'text-status-backlog',     ring: 'ring-white/10' },
  ready:       { bg: 'bg-status-ready/10',              text: 'text-status-ready',       ring: 'ring-status-ready/20' },
  in_progress: { bg: 'bg-status-in_progress/10',        text: 'text-status-in_progress', ring: 'ring-status-in_progress/20' },
  blocked:     { bg: 'bg-status-blocked/10',            text: 'text-status-blocked',     ring: 'ring-status-blocked/20' },
  review:      { bg: 'bg-status-review/10',             text: 'text-status-review',      ring: 'ring-status-review/20' },
  done:        { bg: 'bg-status-done/10',               text: 'text-status-done',        ring: 'ring-status-done/20' },
  cancelled:   { bg: 'bg-status-cancelled/20 line-through opacity-70', text: 'text-text-tertiary', ring: 'ring-white/10' },
};

interface Props {
  status: Status;
  size?: 'xs' | 'sm';
  className?: string;
}

export function StatusBadge({ status, size = 'xs', className = '' }: Props) {
  const c = COLORS[status];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10.5px] px-2 py-[3px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClass} ${c.bg} ${c.text} rounded font-semibold tracking-[0.06em] uppercase ring-1 ring-inset ${c.ring} ${className}`}
    >
      <span className={`w-[5px] h-[5px] rounded-full bg-current ${status === 'cancelled' ? 'hidden' : ''}`} />
      {status.replace('_', ' ')}
    </span>
  );
}
```

- [x] **Step 7: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, all unit tests pass. Some E2E selectors will likely break (specifically `text=Picked:` / phase-pill assertions in the topbar) — those will be fixed in Task 9.

- [x] **Step 8: Tick the step checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md`, find Task 1 and tick all step checkboxes.

- [x] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add package.json bun.lock src/web/frontend/src/main.tsx src/web/frontend/tailwind.config.js src/web/frontend/src/styles.css src/web/frontend/src/components/Layout.tsx src/web/frontend/src/components/StatusBadge.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): redesign foundation — tokens + JetBrains Mono + topbar [Plan-17 Task-1]

Drops Inter/system stack in favor of JetBrains Mono everywhere via
@fontsource/jetbrains-mono. Refines design tokens (single brand accent
teal-300, desaturated status palette, calmer surfaces with shadow
elevation). Topbar refresh: brand mark, calmer picked pill, phase pills
removed (move to Home hero in Task 7). StatusBadge gets the new dot +
ring treatment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Foundation components

**Files:**
- Create: `src/web/frontend/src/components/Hero.tsx`
- Create: `src/web/frontend/src/components/Card.tsx`
- Create: `src/web/frontend/src/components/ProgressBar.tsx`
- Create: `src/web/frontend/src/components/IdPill.tsx`
- Create: `src/web/frontend/src/components/Breadcrumb.tsx`
- Create: `src/web/frontend/src/components/DocumentRow.tsx`

**Goal:** All the small reusable building blocks the page rebuilds (Tasks 4-7) consume. Each component is small + focused; the file should fit in one screen.

- [ ] **Step 1: Create IdPill.tsx (smallest, no deps)**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/IdPill.tsx`:

```tsx
interface Props {
  id: string;
  className?: string;
}

export function IdPill({ id, className = '' }: Props) {
  return (
    <span className={`text-[11px] text-text-tertiary px-1.5 py-[1px] bg-white/[0.04] border border-white/[0.06] rounded ${className}`}>
      {id}
    </span>
  );
}
```

- [ ] **Step 2: Create ProgressBar.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/ProgressBar.tsx`:

```tsx
interface Props {
  done: number;
  inProgress: number;
  total: number;
  className?: string;
}

export function ProgressBar({ done, inProgress, total, className = '' }: Props) {
  const safeTotal = Math.max(total, 1);
  const donePct = Math.min(100, (done / safeTotal) * 100);
  const inProgPct = Math.min(100 - donePct, (inProgress / safeTotal) * 100);
  return (
    <div className={`h-1 rounded-full bg-white/[0.05] overflow-hidden flex ${className}`}>
      <div className="bg-status-done" style={{ width: `${donePct}%` }} />
      <div className="bg-status-in_progress/70" style={{ width: `${inProgPct}%` }} />
    </div>
  );
}
```

- [ ] **Step 3: Create Card.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/Card.tsx`:

```tsx
import type { ReactNode } from 'react';

interface Props {
  title?: string;
  count?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, count, headerAction, children, className = '' }: Props) {
  return (
    <div className={`bg-surface-1 border border-white/[0.06] rounded-xl shadow-elev-1 overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="section-label flex items-center gap-2">
            {title}
            {count && <span className="text-[11px] text-text-quaternary font-normal tracking-normal normal-case">{count}</span>}
          </h3>
          {headerAction}
        </div>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create Breadcrumb.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/Breadcrumb.tsx`:

```tsx
import { Link } from '@tanstack/react-router';

export interface Crumb {
  label: string;
  to?: string;       // legacy path (e.g., '/epics/$id')
  toMulti?: string;  // multi-mode path (e.g., '/p/$slug/epics/$id')
  params?: Record<string, string>;
}

interface Props {
  crumbs: Crumb[];        // ancestor links (excluding current)
  current: string;        // current item ID — rendered as a non-link "here" pill
  activeSlug: string | null;
  className?: string;
}

export function Breadcrumb({ crumbs, current, activeSlug, className = '' }: Props) {
  return (
    <nav className={`text-[12.5px] text-text-tertiary flex items-center gap-2 mb-5 ${className}`} aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {c.to && c.toMulti && c.params ? (
            activeSlug ? (
              <Link
                to={c.toMulti as never}
                params={{ slug: activeSlug, ...c.params } as never}
                className="text-text-secondary hover:text-text-primary"
              >{c.label}</Link>
            ) : (
              <Link
                to={c.to as never}
                params={c.params as never}
                className="text-text-secondary hover:text-text-primary"
              >{c.label}</Link>
            )
          ) : (
            <span className="text-text-secondary">{c.label}</span>
          )}
          <span className="text-text-quaternary text-[11px]">›</span>
        </span>
      ))}
      <span className="text-text-primary text-[11px] px-1.5 py-[1px] bg-white/[0.04] border border-white/[0.06] rounded">{current}</span>
    </nav>
  );
}
```

- [ ] **Step 5: Create DocumentRow.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/DocumentRow.tsx`:

```tsx
import { FileText, Clock } from 'lucide-react';

interface Props {
  kind: 'spec' | 'plan' | 'changelog';
  attached: boolean;
  meta?: string;       // e.g., "320 lines · attached 3d ago"
  onClick?: () => void;
}

const ICON_BY_KIND = {
  spec: FileText,
  plan: FileText,
  changelog: Clock,
};

export function DocumentRow({ kind, attached, meta, onClick }: Props) {
  const Icon = ICON_BY_KIND[kind];
  const filename = `${kind}.md`;
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] last:border-b-0 transition-colors ${onClick ? 'hover:bg-white/[0.02] cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-text-tertiary shrink-0" />
        <div>
          <div className="text-[13.5px] text-text-primary font-medium">{filename}</div>
          <div className="text-[11.5px] text-text-tertiary mt-0.5">{attached ? meta ?? 'attached' : 'not attached'}</div>
        </div>
      </div>
      {attached && <span className="text-xs text-text-secondary group-hover:text-text-primary">Open ›</span>}
    </div>
  );
}
```

- [ ] **Step 6: Create Hero.tsx (the biggest of the foundation set)**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/Hero.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { ItemKind, Status } from '../types';
import { StatusBadge } from './StatusBadge';
import { IdPill } from './IdPill';
import { ProgressBar } from './ProgressBar';

interface Props {
  kind: ItemKind;
  id: string;
  title: string;
  status: Status;
  phase?: string;
  metaRight?: string;          // e.g., "updated 2h ago"
  progress?: { done: number; inProgress: number; ready: number; total: number; label: string };
  actions?: ReactNode;          // primary + secondary buttons (caller's responsibility)
  viewToggle?: ReactNode;       // segmented control for [Detail | Tree]
  className?: string;
}

export function Hero({ kind, id, title, status, phase, metaRight, progress, actions, viewToggle, className = '' }: Props) {
  return (
    <div className={`bg-surface-1 border border-white/[0.06] rounded-2xl shadow-elev-1 px-9 py-8 grid grid-cols-[1fr_auto] gap-10 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">{kind}</span>
          <IdPill id={id} />
        </div>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-[1.15] text-text-primary mb-3.5">{title}</h1>
        <div className="flex items-center gap-4 flex-wrap text-[13px] text-text-secondary">
          <StatusBadge status={status} />
          {phase && (<><span className="text-text-quaternary">·</span><span>phase {phase}</span></>)}
          {metaRight && (<><span className="text-text-quaternary">·</span><span>{metaRight}</span></>)}
        </div>
        {progress && (
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <span className="section-label">{progress.label}</span>
              <span className="text-xs text-text-secondary">
                {progress.done} of {progress.total} done{progress.inProgress > 0 ? ` · ${progress.inProgress} in progress` : ''}
              </span>
            </div>
            <ProgressBar done={progress.done} inProgress={progress.inProgress} total={progress.total} />
          </div>
        )}
      </div>
      {(actions || viewToggle) && (
        <div className="flex flex-col gap-4 min-w-[260px]">
          {actions}
          {viewToggle}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: clean. Components aren't used yet; this just confirms they compile.

- [ ] **Step 8: Tick the step checkboxes for Task 2 in the plan**

Tick all step checkboxes for Task 2.

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/Hero.tsx src/web/frontend/src/components/Card.tsx src/web/frontend/src/components/ProgressBar.tsx src/web/frontend/src/components/IdPill.tsx src/web/frontend/src/components/Breadcrumb.tsx src/web/frontend/src/components/DocumentRow.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): foundation components — Hero / Card / ProgressBar / IdPill / Breadcrumb / DocumentRow [Plan-17 Task-2]

Six small reusable building blocks the page rebuilds will consume.
Each file is single-responsibility + screen-sized.

- Hero: id-row + title + meta + progress + actions slot + viewToggle slot
- Card: titled surface with optional count + header action
- ProgressBar: 1-line bar with done + in_progress fills
- IdPill: small mono ID badge
- Breadcrumb: typed-or-fallback parent chain with current "here" pill
- DocumentRow: spec/plan/changelog row for the Documents card

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: TreeView component + `/api/items/:id/subtree` endpoint

**Files:**
- Modify: `src/web/api.ts` (new endpoint)
- Modify: `tests/web/api.test.ts` (~3 new tests)
- Modify: `src/web/frontend/src/api.ts` (`getSubtree` client)
- Create: `src/web/frontend/src/components/TreeView.tsx`

**Goal:** A new backend endpoint returns the item + all descendants flat (one fetch instead of N+1). The TreeView component renders this as a navigable tree with status badges, the current item highlighted, and click-to-navigate.

- [ ] **Step 1: Write the failing API tests**

APPEND to `/home/fintan/repos/kadai/tests/web/api.test.ts`:

```typescript
test('GET /api/items/:id/subtree returns the item + all descendants flat', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/subtree`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(Array.isArray(json)).toBe(true);
  // EPIC-001 + FEAT-001 + STORY-001 = 3 items in the seed.
  expect(json.length).toBeGreaterThanOrEqual(3);
  const ids = json.map((i: { data: { id: string } }) => i.data.id).sort();
  expect(ids).toContain('EPIC-001');
  expect(ids).toContain('FEAT-001');
  expect(ids).toContain('STORY-001');
});

test('GET /api/items/STORY-001/subtree returns just the story (and any tasks)', async () => {
  const r = await fetch(`${base()}/api/items/STORY-001/subtree`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBeGreaterThanOrEqual(1);
  expect(json[0].data.id).toBe('STORY-001');
});

test('GET /api/items/EPIC-999/subtree returns 404 for unknown root', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999/subtree`);
  expect(r.status).toBe(404);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: 3 new tests fail with 404 (route not registered).

- [ ] **Step 3: Implement /api/items/:id/subtree**

Read `/home/fintan/repos/kadai/src/web/api.ts`. Add this import (`walkSpine` is likely already imported via the existing list endpoints — confirm and skip if so):

```typescript
import { walkSpine, findById } from '../core/spine';
```

(Both are likely already imported.)

Inside `handleApi`, after the existing `/api/items/:id/transitions` and BEFORE the bare `/api/items/:id` GET handler, insert:

```typescript
  const subtreeMatch = path.match(/^\/api\/items\/([A-Z]+-\d+)\/subtree$/);
  if (subtreeMatch && req.method === 'GET') {
    const root = findById(rootDir, subtreeMatch[1]);
    if (!root) return new Response('Not found', { status: 404 });
    // Walk the whole spine, then filter to the root + descendants.
    const all = walkSpine(rootDir);
    const result = [root];
    const visit = (parentId: string) => {
      for (const item of all) {
        const data = item.data as unknown as { id: string; parent?: string };
        if (data.parent === parentId) {
          result.push(item);
          visit(data.id);
        }
      }
    };
    const rootData = root.data as unknown as { id: string };
    visit(rootData.id);
    return Response.json(result);
  }
```

Order matters: this must come BEFORE the catchall `itemMatch = path.match(/^\/api\/items\/(.+)$/)` because that pattern would match `EPIC-001/subtree` as `id="EPIC-001/subtree"` and 404.

- [ ] **Step 4: Run API tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: all pass (existing + 3 new).

- [ ] **Step 5: Add the client wrapper**

APPEND to `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
export async function getSubtree(id: string, slug?: string | null): Promise<Item[]> {
  const r = await fetch(withBase(slug, `/items/${id}/subtree`));
  if (!r.ok) throw new Error(`/items/${id}/subtree → ${r.status}`);
  return r.json() as Promise<Item[]>;
}
```

(`withBase` and `Item` are already in scope from prior plans — confirm by reading the file first.)

- [ ] **Step 6: Implement TreeView.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/TreeView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getSubtree } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { StatusBadge } from './StatusBadge';
import { KindIcon } from './KindIcon';
import { IdPill } from './IdPill';
import { SkeletonStack } from './Skeleton';
import { EmptyState } from './EmptyState';
import { FileQuestion } from 'lucide-react';
import type { Item, ItemKind } from '../types';

const ROUTE_BY_KIND: Record<ItemKind, { single: string; multi: string }> = {
  epic:    { single: '/epics/$id',    multi: '/p/$slug/epics/$id'    },
  feature: { single: '/features/$id', multi: '/p/$slug/features/$id' },
  story:   { single: '/stories/$id',  multi: '/p/$slug/stories/$id'  },
  task:    { single: '/stories/$id',  multi: '/p/$slug/stories/$id'  },
};

interface Props {
  rootId: string;
  currentId: string;
}

interface Node {
  item: Item;
  children: Node[];
  depth: number;
}

function buildTree(items: Item[], rootId: string): Node | null {
  const byId = new Map<string, Item>();
  for (const it of items) byId.set((it.data as unknown as { id: string }).id, it);
  const root = byId.get(rootId);
  if (!root) return null;
  const childrenOf = (parentId: string): Item[] =>
    items.filter(it => (it.data as unknown as { parent?: string }).parent === parentId);
  const buildNode = (item: Item, depth: number): Node => {
    const id = (item.data as unknown as { id: string }).id;
    return {
      item,
      depth,
      children: childrenOf(id).map(c => buildNode(c, depth + 1)),
    };
  };
  return buildNode(root, 0);
}

function TreeRow({ node, currentId, activeSlug }: { node: Node; currentId: string; activeSlug: string | null }) {
  const data = node.item.data as unknown as { id: string; title: string; status: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled' };
  const isHere = data.id === currentId;
  const route = ROUTE_BY_KIND[node.item.kind];
  const indent = node.depth * 28;

  const content = (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isHere ? 'bg-accent/[0.10] ring-1 ring-accent/25' : 'hover:bg-white/[0.03]'}`}
      style={{ marginLeft: indent }}
    >
      <KindIcon kind={node.item.kind} size={14} />
      <IdPill id={data.id} />
      <span className={`text-[13.5px] flex-1 ${isHere ? 'text-text-primary font-medium' : 'text-text-primary'}`}>{data.title}</span>
      <StatusBadge status={data.status} />
      {isHere && <span className="text-[11px] text-accent ml-2">← here</span>}
    </div>
  );

  return (
    <>
      {isHere ? content : (
        activeSlug ? (
          <Link to={route.multi as never} params={{ slug: activeSlug, id: data.id } as never} className="block">{content}</Link>
        ) : (
          <Link to={route.single as never} params={{ id: data.id } as never} className="block">{content}</Link>
        )
      )}
      {node.children.map((c, i) => <TreeRow key={i} node={c} currentId={currentId} activeSlug={activeSlug} />)}
    </>
  );
}

export function TreeView({ rootId, currentId }: Props) {
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSubtree(rootId, activeSlug)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [rootId, activeSlug, liveKey]);

  if (loading && items.length === 0) return <SkeletonStack rows={6} />;
  const tree = buildTree(items, rootId);
  if (!tree) return <EmptyState icon={FileQuestion} title="Subtree empty or unavailable" />;

  return (
    <div className="space-y-1">
      <TreeRow node={tree} currentId={currentId} activeSlug={activeSlug} />
    </div>
  );
}
```

- [ ] **Step 7: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: clean.

- [ ] **Step 8: Tick the step checkboxes for Task 3 in the plan**

Tick all step checkboxes for Task 3.

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts tests/web/api.test.ts src/web/frontend/src/api.ts src/web/frontend/src/components/TreeView.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web): TreeView component + GET /api/items/:id/subtree [Plan-17 Task-3]

New endpoint returns the item + all descendants flat (one fetch). New
client TreeView component builds the tree, highlights the "here" item,
and renders rows with KindIcon + IdPill + StatusBadge. Click navigates
to that item's detail page (slug-aware in multi-project mode).

Used by the View toggle on Story / Feature / Epic detail pages
(Tasks 4-6).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Story page rebuild

**Files:**
- Modify: `src/web/frontend/src/pages/Story.tsx`
- Modify: `src/web/frontend/src/router.tsx` (validateSearch for `?view=`)

**Goal:** Replace the current tab-based Story page with the hero + 2-column body pattern. View toggle = [Detail | Tree]. The 5 tabs (story / spec / plan / changelog / tasks) are gone — content moves into the body cards.

- [ ] **Step 1: Add `?view=` to the story routes' validateSearch**

Read `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`. Find the existing `storyRoute` and `projectStoryRoute` definitions. Add a `validateSearch` to each (or augment if one exists):

For `storyRoute`:
```typescript
const storyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories/$id',
  component: Story,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' } => ({
    view: s.view === 'tree' ? 'tree' : undefined,
  }),
});
```

Same for `projectStoryRoute`. (Same pattern for `epicRoute` / `projectEpicRoute` / `featureRoute` / `projectFeatureRoute` in Tasks 5-6 — but for Feature add `'kanban'` as another allowed value.)

- [ ] **Step 2: Replace Story.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/pages/Story.tsx` first to capture current data-fetching shape and AttachButton/StatusPanel wiring. Then replace the FILE contents with:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { getItem, getFile, listTasks, getTransitions, setItemStatus, attachFile, type Transitions } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { Hero } from '../components/Hero';
import { Card } from '../components/Card';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { TreeView } from '../components/TreeView';
import { StatusBadge } from '../components/StatusBadge';
import { KindIcon } from '../components/KindIcon';
import { IdPill } from '../components/IdPill';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { CheckSquare, FileQuestion } from 'lucide-react';
import type { Item, Status } from '../types';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);     if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);     return `${d}d ago`;
}

export function Story() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();

  const [story, setStory] = useState<Item | null>(null);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Transitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listTasks({ story_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getFile(id, 'plan.md', activeSlug),
      getFile(id, 'changelog.md', activeSlug),
      getTransitions(id, activeSlug),
    ]).then(([s, t, sp, p, c, tr]) => {
      setStory(s); setTasks(t); setSpec(sp); setPlan(p); setChangelog(c); setTransitions(tr);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !story) return <SkeletonStack rows={6} />;
  if (!story) return <EmptyState icon={FileQuestion} title="Story not found" hint={`No story with ID ${id} exists.`} />;

  const d = story.data as { id: string; title: string; phase?: string; status: Status; parent: string; updated?: string; acceptance_criteria?: string[] };
  const taskCounts = {
    done: tasks.filter(t => t.data.status === 'done').length,
    inProgress: tasks.filter(t => t.data.status === 'in_progress').length,
    ready: tasks.filter(t => t.data.status === 'ready').length,
  };

  // Pick the primary CTA: prefer review (if legal), else in_progress, else done.
  const allowed = transitions?.allowed ?? [];
  const primaryAction: Status | null =
    allowed.includes('review') ? 'review' :
    allowed.includes('in_progress') ? 'in_progress' :
    allowed.includes('done') ? 'done' :
    allowed[0] ?? null;
  const secondaryActions = allowed.filter(s => s !== primaryAction);

  const crumbs: Crumb[] = [
    { label: 'All epics', to: '/', toMulti: '/p/$slug/', params: {} },
    { label: d.parent, to: '/features/$id', toMulti: '/p/$slug/features/$id', params: { id: d.parent } },
  ];

  const showTree = search.view === 'tree';

  function reloadAttached(filename: 'spec.md' | 'plan.md') {
    getFile(id, filename, activeSlug).then(c => filename === 'spec.md' ? setSpec(c) : setPlan(c));
  }

  async function move(target: Status) {
    const previous = d.status;
    setStory(prev => prev ? { ...prev, data: { ...prev.data, status: target } } : prev);
    try {
      await setItemStatus(id, target, activeSlug);
      // Refetch transitions because the legal next states change with the new status.
      getTransitions(id, activeSlug).then(setTransitions);
    } catch {
      setStory(prev => prev ? { ...prev, data: { ...prev.data, status: previous } } : prev);
    }
  }

  async function uploadAttach(kind: 'spec' | 'plan', file: File) {
    await attachFile(id, kind, file, activeSlug);
    reloadAttached(kind === 'spec' ? 'spec.md' : 'plan.md');
  }

  return (
    <div className="space-y-7 max-w-[1200px] mx-auto px-4">
      <Breadcrumb crumbs={crumbs} current={d.id} activeSlug={activeSlug} />

      <Hero
        kind="story"
        id={d.id}
        title={d.title}
        status={d.status}
        phase={d.phase}
        metaRight={d.updated ? `updated ${timeAgo(d.updated)}` : undefined}
        progress={tasks.length > 0 ? {
          done: taskCounts.done,
          inProgress: taskCounts.inProgress,
          ready: taskCounts.ready,
          total: tasks.length,
          label: 'Tasks',
        } : undefined}
        actions={
          <div className="flex flex-col gap-2">
            {primaryAction && (
              <button
                onClick={() => move(primaryAction)}
                className="bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg text-[13px] hover:bg-[#99f6e4] transition-colors"
              >Mark {primaryAction.replace('_', ' ')}</button>
            )}
            {secondaryActions.length > 0 && (
              <div className="flex gap-1.5">
                {secondaryActions.slice(0, 2).map(s => (
                  <button
                    key={s}
                    onClick={() => move(s)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.10] text-text-primary px-3 py-2 rounded-lg text-[12px] font-medium hover:bg-white/[0.07] hover:border-white/[0.16] transition-colors"
                  >{s.replace('_', ' ')}</button>
                ))}
              </div>
            )}
          </div>
        }
        viewToggle={
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-[3px]">
            <button
              onClick={() => navigate({ to: '.', search: { view: undefined } as never })}
              className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${!showTree ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
            >Detail</button>
            <button
              onClick={() => navigate({ to: '.', search: { view: 'tree' } as never })}
              className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${showTree ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
            >Tree</button>
          </div>
        }
      />

      {showTree ? (
        <Card title="Subtree" count={`rooted at ${d.parent}`}>
          <div className="p-4">
            <TreeView rootId={d.parent} currentId={d.id} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            <Card title="Description">
              <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                {story.body && <Markdown>{story.body}</Markdown>}
                {d.acceptance_criteria && d.acceptance_criteria.length > 0 && (
                  <>
                    <div className="section-label mt-5 mb-3 not-prose">Acceptance criteria</div>
                    <ul className="space-y-2 list-none p-0 m-0 not-prose">
                      {d.acceptance_criteria.map((c, i) => (
                        <li key={i} className="flex gap-3 text-[14px] text-text-secondary">
                          <span className="w-4 h-4 rounded-[4px] border-[1.5px] border-white/[0.16] bg-white/[0.02] shrink-0 mt-[3px]" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Card>

            <Card title="Tasks" count={`${taskCounts.done} / ${tasks.length} done`}>
              {tasks.length === 0 ? (
                <EmptyState icon={CheckSquare} title="No tasks yet" hint={`Add one with \`kadai add task --story ${id}\``} />
              ) : tasks.map(t => {
                const td = t.data as { id: string; title: string; status: Status };
                return (
                  <div key={td.id} className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    <span className="w-4 h-4 rounded-[4px] border-[1.5px] border-white/[0.16]" />
                    <IdPill id={td.id} />
                    <span className="flex-1 text-[13.5px]">{td.title}</span>
                    <StatusBadge status={td.status} />
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Documents">
              <DocumentRow kind="spec"      attached={!!spec}      meta={spec ? `${spec.split(/\n/).length} lines` : undefined} />
              <DocumentRow kind="plan"      attached={!!plan}      meta={plan ? `${plan.split(/\n/).length} lines` : undefined} />
              <DocumentRow kind="changelog" attached={!!changelog} meta={changelog ? `${changelog.split(/\n/).filter(Boolean).length} entries` : 'no entries'} />
            </Card>

            {(spec || plan) && (
              <Card title="Attached content">
                <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                  {spec && <><div className="section-label mb-2 not-prose">Spec</div><Markdown>{spec}</Markdown></>}
                  {plan && <><div className="section-label mb-2 mt-5 not-prose">Plan</div><Markdown>{plan}</Markdown></>}
                </div>
              </Card>
            )}

            {!spec && (
              <Card>
                <input id="story-spec-input" type="file" accept=".md,text/markdown" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttach('spec', f); }} />
                <EmptyState icon={FileQuestion} title="No spec attached" hint="Upload a spec.md to define what this story should do."
                  action={<button onClick={() => document.getElementById('story-spec-input')?.click()} className="bg-white/[0.04] border border-white/[0.10] px-3 py-1.5 rounded-md text-[12px] hover:bg-white/[0.07]">Attach spec.md</button>}
                />
              </Card>
            )}

            {!plan && (
              <Card>
                <input id="story-plan-input" type="file" accept=".md,text/markdown" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttach('plan', f); }} />
                <EmptyState icon={FileQuestion} title="No plan attached" hint="Upload a plan.md with implementation steps."
                  action={<button onClick={() => document.getElementById('story-plan-input')?.click()} className="bg-white/[0.04] border border-white/[0.10] px-3 py-1.5 rounded-md text-[12px] hover:bg-white/[0.07]">Attach plan.md</button>}
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

(Note: this drops the `tabs` mechanism entirely. The current `tab` state, `setTab`, and `<button onClick={() => setTab(t)}>` JSX from the existing file are not in the new file. Some Playwright tests asserting on tab buttons will fail — Task 9 fixes those.)

- [ ] **Step 3: Build + smoke-test**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, unit tests pass. Skip Playwright for now — it'll fail on the removed tabs (handled in Task 9).

- [ ] **Step 4: Tick the step checkboxes for Task 4 in the plan**

Tick all step checkboxes for Task 4.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Story.tsx src/web/frontend/src/router.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): rebuild Story page — Hero + 2-col body, no tabs [Plan-17 Task-4]

Replaces the 5-tab Story page with the canonical Mode A pattern:
breadcrumb + Hero (id/title/status/phase/progress + actions + view
toggle) + 2-column body (Description with acceptance criteria + Tasks
list on the left; Documents card + attached spec/plan + attach prompts
on the right). View toggle wires `?view=tree` to render the TreeView
in place of the body.

Some Playwright tests asserting on tab buttons will fail — handled in
Task 9 selector pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Feature page rebuild (Stories list as Mode A; kanban via toggle)

**Files:**
- Modify: `src/web/frontend/src/pages/Feature.tsx`
- Modify: `src/web/frontend/src/router.tsx` (extend `view?: 'tree' | 'kanban'`)
- Modify: `src/web/frontend/src/components/KanbanBoard.tsx` (refined visuals to match new tokens)

**Goal:** Feature page becomes Mode A (Stories list) by default. View toggle = [Detail | Tree | Kanban] (3-way for Feature only). Kanban moves to `?view=kanban`. The kanban itself gets the refined token treatment (calmer cards, status border, no over-bright colors).

- [ ] **Step 1: Extend the Feature route's validateSearch**

Read `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`. Update `featureRoute` (and `projectFeatureRoute`):

```typescript
const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$id',
  component: Feature,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' | 'kanban' } => ({
    view: s.view === 'tree' ? 'tree' : s.view === 'kanban' ? 'kanban' : undefined,
  }),
});
```

Same shape for `projectFeatureRoute`.

- [ ] **Step 2: Refine KanbanBoard visuals**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/KanbanBoard.tsx`. Update the column wrapper className to use the new tokens (replace existing border/bg classes):

```tsx
function Column({ status, stories }: { status: Status; stories: Item[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={`bg-surface-1 border border-white/[0.06] rounded-xl p-2.5 border-l-2 border-l-status-${status}/40 ${isOver ? 'ring-2 ring-accent/40' : ''}`}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary mb-2 px-1">{status.replace('_', ' ')}</div>
      <div className="space-y-2">
        {stories.map(s => <Card key={(s.data as any).id} story={s} />)}
      </div>
    </div>
  );
}

function Card({ story }: { story: Item }) {
  const d = story.data as { id: string; title: string };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: d.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`card-${d.id}`}
      className={`bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.16] rounded-md p-2.5 text-[12px] transition-colors ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="text-text-tertiary text-[10px] mb-0.5">{d.id}</div>
      <Link to="/stories/$id" params={{ id: d.id }} className="block text-text-primary">{d.title}</Link>
    </div>
  );
}
```

(The drag/drop logic and per-status column color stays as-is.)

- [ ] **Step 3: Rebuild Feature.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/pages/Feature.tsx` first. Replace the file with:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { getItem, getFile, listStories, getTransitions, setItemStatus, type Transitions } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { Hero } from '../components/Hero';
import { Card } from '../components/Card';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { TreeView } from '../components/TreeView';
import { KanbanBoard } from '../components/KanbanBoard';
import { StatusBadge } from '../components/StatusBadge';
import { KindIcon } from '../components/KindIcon';
import { IdPill } from '../components/IdPill';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { BookOpen, FileQuestion } from 'lucide-react';
import type { Item, Status } from '../types';

export function Feature() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();

  const [feature, setFeature] = useState<Item | null>(null);
  const [stories, setStories] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Transitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listStories({ feature_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getTransitions(id, activeSlug),
    ]).then(([f, s, sp, tr]) => {
      setFeature(f); setStories(s); setSpec(sp); setTransitions(tr);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !feature) return <SkeletonStack rows={6} />;
  if (!feature) return <EmptyState icon={FileQuestion} title="Feature not found" hint={`No feature with ID ${id} exists.`} />;

  const d = feature.data as { id: string; title: string; phase?: string; status: Status; parent: string };
  const counts = {
    done: stories.filter(s => s.data.status === 'done').length,
    inProgress: stories.filter(s => s.data.status === 'in_progress').length,
    ready: stories.filter(s => s.data.status === 'ready').length,
  };

  const allowed = transitions?.allowed ?? [];
  const primaryAction: Status | null =
    allowed.includes('in_progress') ? 'in_progress' :
    allowed.includes('done') ? 'done' :
    allowed[0] ?? null;

  const crumbs: Crumb[] = [
    { label: 'All epics', to: '/', toMulti: '/p/$slug/', params: {} },
    { label: d.parent, to: '/epics/$id', toMulti: '/p/$slug/epics/$id', params: { id: d.parent } },
  ];

  const view = search.view as 'tree' | 'kanban' | undefined;

  function setView(v: 'tree' | 'kanban' | undefined) {
    navigate({ to: '.', search: { view: v } as never });
  }

  function onLocalStatusChange(storyId: string, newStatus: Status) {
    setStories(prev => prev.map(s => (s.data as any).id === storyId ? { ...s, data: { ...s.data, status: newStatus } } : s));
  }

  return (
    <div className="space-y-7 max-w-[1200px] mx-auto px-4">
      <Breadcrumb crumbs={crumbs} current={d.id} activeSlug={activeSlug} />

      <Hero
        kind="feature"
        id={d.id}
        title={d.title}
        status={d.status}
        phase={d.phase}
        progress={stories.length > 0 ? {
          done: counts.done, inProgress: counts.inProgress, ready: counts.ready,
          total: stories.length, label: 'Stories',
        } : undefined}
        actions={primaryAction && (
          <button
            onClick={() => setItemStatus(id, primaryAction, activeSlug).then(() => getItem(id, activeSlug).then(setFeature))}
            className="bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg text-[13px] hover:bg-[#99f6e4] transition-colors"
          >Mark {primaryAction.replace('_', ' ')}</button>
        )}
        viewToggle={
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-[3px]">
            {[{k: undefined, l: 'Detail'}, {k: 'tree' as const, l: 'Tree'}, {k: 'kanban' as const, l: 'Kanban'}].map(opt => (
              <button
                key={opt.l}
                onClick={() => setView(opt.k)}
                className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${view === opt.k ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >{opt.l}</button>
            ))}
          </div>
        }
      />

      {view === 'tree' ? (
        <Card title="Subtree" count={`rooted at ${d.id}`}>
          <div className="p-4"><TreeView rootId={d.id} currentId={d.id} /></div>
        </Card>
      ) : view === 'kanban' ? (
        <Card title="Kanban" count={`${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}`}>
          <div className="p-4"><KanbanBoard stories={stories} onLocalStatusChange={onLocalStatusChange} activeSlug={activeSlug} /></div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            {feature.body && (
              <Card title="Description">
                <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                  <Markdown>{feature.body}</Markdown>
                </div>
              </Card>
            )}

            <Card title="Stories" count={`${counts.done} / ${stories.length} done`}>
              {stories.length === 0 ? (
                <EmptyState icon={BookOpen} title="No stories yet" hint={`Add one with \`kadai add story --feature ${id}\``} />
              ) : stories.map(s => {
                const sd = s.data as { id: string; title: string; status: Status };
                return (
                  <div key={sd.id} className="px-5 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    {activeSlug ? (
                      <Link to="/p/$slug/stories/$id" params={{ slug: activeSlug, id: sd.id }} className="flex items-center gap-4">
                        <KindIcon kind="story" size={14} />
                        <IdPill id={sd.id} />
                        <span className="flex-1 text-[13.5px]">{sd.title}</span>
                        <StatusBadge status={sd.status} />
                      </Link>
                    ) : (
                      <Link to="/stories/$id" params={{ id: sd.id }} className="flex items-center gap-4">
                        <KindIcon kind="story" size={14} />
                        <IdPill id={sd.id} />
                        <span className="flex-1 text-[13.5px]">{sd.title}</span>
                        <StatusBadge status={sd.status} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Documents">
              <DocumentRow kind="spec" attached={!!spec} meta={spec ? `${spec.split(/\n/).length} lines` : undefined} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: clean.

- [ ] **Step 5: Tick the step checkboxes for Task 5 in the plan**

Tick all step checkboxes for Task 5.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/router.tsx src/web/frontend/src/components/KanbanBoard.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): rebuild Feature page — Stories list + Tree/Kanban toggles [Plan-17 Task-5]

Feature page now defaults to a Stories list (Mode A) instead of opening
straight into the kanban. View toggle is 3-way: [Detail | Tree | Kanban].
Kanban moves to ?view=kanban (URL-bookmarkable).

KanbanBoard component refined to use the new tokens (calmer cards,
hover affordance, status border).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Epic page rebuild

**Files:**
- Modify: `src/web/frontend/src/pages/Epic.tsx`
- Modify: `src/web/frontend/src/router.tsx` (extend epic routes' `view?: 'tree'`)
- Modify: `src/web/frontend/src/components/EpicCard.tsx` (refined to new tokens — used by Home)

**Goal:** Same pattern as Feature — Hero + Features list + Documents. View toggle = [Detail | Tree].

- [ ] **Step 1: Extend the Epic route's validateSearch**

In `router.tsx`, update `epicRoute` and `projectEpicRoute` with the same `?view=tree` validateSearch as Story (Task 4 Step 1).

- [ ] **Step 2: Refine EpicCard.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/EpicCard.tsx`. Update className stack to use new tokens:

```tsx
import { Link } from '@tanstack/react-router';
import { StatusBadge } from './StatusBadge';
import { KindIcon } from './KindIcon';
import { IdPill } from './IdPill';
import type { Item } from '../types';

interface Props {
  epic: Item;
  toMulti?: string;
  toMultiParams?: Record<string, string>;
}

export function EpicCard({ epic }: Props) {
  const d = epic.data as { id: string; title: string; status: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled'; phase: string };
  return (
    <Link
      to="/epics/$id"
      params={{ id: d.id }}
      className="block bg-surface-1 border border-white/[0.06] hover:border-white/[0.16] rounded-xl p-5 shadow-elev-1 transition-colors"
    >
      <div className="flex items-start gap-3">
        <KindIcon kind="epic" size={18} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <IdPill id={d.id} />
            <StatusBadge status={d.status} />
          </div>
          <div className="text-[15px] font-medium text-text-primary">{d.title}</div>
          <div className="text-[11.5px] text-text-tertiary mt-1">phase {d.phase}</div>
        </div>
      </div>
    </Link>
  );
}
```

(The slug-aware Link logic is omitted here for simplicity; the Home page caller handles project-scoped Links via its own EpicCard rendering. If you've structured EpicCard to take a slug prop, keep that.)

- [ ] **Step 3: Rebuild Epic.tsx**

Replace `/home/fintan/repos/kadai/src/web/frontend/src/pages/Epic.tsx` with the same shape as Feature.tsx (Task 5 Step 3) but for Epic + Features:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { getItem, getFile, listFeatures, getTransitions, setItemStatus, type Transitions } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { Hero } from '../components/Hero';
import { Card } from '../components/Card';
import { Breadcrumb, type Crumb } from '../components/Breadcrumb';
import { TreeView } from '../components/TreeView';
import { StatusBadge } from '../components/StatusBadge';
import { KindIcon } from '../components/KindIcon';
import { IdPill } from '../components/IdPill';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonStack } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { Box, FileQuestion } from 'lucide-react';
import type { Item, Status } from '../types';

export function Epic() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const { activeSlug } = useProjectMode();
  const liveKey = useLiveKey();

  const [epic, setEpic] = useState<Item | null>(null);
  const [features, setFeatures] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Transitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItem(id, activeSlug),
      listFeatures({ epic_id: id }, activeSlug),
      getFile(id, 'spec.md', activeSlug),
      getTransitions(id, activeSlug),
    ]).then(([e, f, sp, tr]) => {
      setEpic(e); setFeatures(f); setSpec(sp); setTransitions(tr);
    }).finally(() => setLoading(false));
  }, [id, liveKey, activeSlug]);

  if (loading && !epic) return <SkeletonStack rows={6} />;
  if (!epic) return <EmptyState icon={FileQuestion} title="Epic not found" hint={`No epic with ID ${id} exists.`} />;

  const d = epic.data as { id: string; title: string; phase?: string; status: Status };
  const counts = {
    done: features.filter(f => f.data.status === 'done').length,
    inProgress: features.filter(f => f.data.status === 'in_progress').length,
    ready: features.filter(f => f.data.status === 'ready').length,
  };

  const allowed = transitions?.allowed ?? [];
  const primaryAction: Status | null =
    allowed.includes('in_progress') ? 'in_progress' :
    allowed.includes('done') ? 'done' :
    allowed[0] ?? null;

  const crumbs: Crumb[] = [
    { label: 'All epics', to: '/', toMulti: '/p/$slug/', params: {} },
  ];

  const showTree = search.view === 'tree';

  return (
    <div className="space-y-7 max-w-[1200px] mx-auto px-4">
      <Breadcrumb crumbs={crumbs} current={d.id} activeSlug={activeSlug} />

      <Hero
        kind="epic"
        id={d.id}
        title={d.title}
        status={d.status}
        phase={d.phase}
        progress={features.length > 0 ? {
          done: counts.done, inProgress: counts.inProgress, ready: counts.ready,
          total: features.length, label: 'Features',
        } : undefined}
        actions={primaryAction && (
          <button
            onClick={() => setItemStatus(id, primaryAction, activeSlug).then(() => getItem(id, activeSlug).then(setEpic))}
            className="bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg text-[13px] hover:bg-[#99f6e4] transition-colors"
          >Mark {primaryAction.replace('_', ' ')}</button>
        )}
        viewToggle={
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-[3px]">
            {[{k: undefined, l: 'Detail'}, {k: 'tree' as const, l: 'Tree'}].map(opt => (
              <button
                key={opt.l}
                onClick={() => navigate({ to: '.', search: { view: opt.k } as never })}
                className={`flex-1 text-center py-1 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors ${(search.view as string | undefined) === opt.k ? 'bg-white/[0.06] text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >{opt.l}</button>
            ))}
          </div>
        }
      />

      {showTree ? (
        <Card title="Subtree" count={`rooted at ${d.id}`}>
          <div className="p-4"><TreeView rootId={d.id} currentId={d.id} /></div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            {epic.body && (
              <Card title="Description">
                <div className="px-5 py-5 prose prose-invert prose-sm max-w-none">
                  <Markdown>{epic.body}</Markdown>
                </div>
              </Card>
            )}

            <Card title="Features" count={`${counts.done} / ${features.length} done`}>
              {features.length === 0 ? (
                <EmptyState icon={Box} title="No features yet" hint={`Add one with \`kadai add feature --epic ${id}\``} />
              ) : features.map(f => {
                const fd = f.data as { id: string; title: string; status: Status };
                return (
                  <div key={fd.id} className="px-5 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    {activeSlug ? (
                      <Link to="/p/$slug/features/$id" params={{ slug: activeSlug, id: fd.id }} className="flex items-center gap-4">
                        <KindIcon kind="feature" size={14} />
                        <IdPill id={fd.id} />
                        <span className="flex-1 text-[13.5px]">{fd.title}</span>
                        <StatusBadge status={fd.status} />
                      </Link>
                    ) : (
                      <Link to="/features/$id" params={{ id: fd.id }} className="flex items-center gap-4">
                        <KindIcon kind="feature" size={14} />
                        <IdPill id={fd.id} />
                        <span className="flex-1 text-[13.5px]">{fd.title}</span>
                        <StatusBadge status={fd.status} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Documents">
              <DocumentRow kind="spec" attached={!!spec} meta={spec ? `${spec.split(/\n/).length} lines` : undefined} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: clean.

- [ ] **Step 5: Tick the step checkboxes for Task 6 in the plan**

Tick all step checkboxes for Task 6.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/router.tsx src/web/frontend/src/components/EpicCard.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): rebuild Epic page + refine EpicCard [Plan-17 Task-6]

Epic page applies the same Hero + 2-col body pattern. View toggle is
2-way [Detail | Tree]. EpicCard refined to use new tokens for the
Home page grid (Task 7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Home page rebuild

**Files:**
- Modify: `src/web/frontend/src/pages/Home.tsx`

**Goal:** Home gets a proper hero block (project name + summary counts + phase pills) and per-phase grids of EpicCards. The phase pills move here from the topbar.

- [ ] **Step 1: Replace Home.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/pages/Home.tsx`. Replace the file with:

```tsx
import { useEffect, useState } from 'react';
import { listEpics, listPhases, listFeatures, listStories, listTasks } from '../api';
import { useProjectMode } from '../project';
import { useLiveKey } from '../live';
import { EpicCard } from '../components/EpicCard';
import { SkeletonStack } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Layers } from 'lucide-react';
import type { Item, PhaseConfig } from '../types';

export function Home() {
  const liveKey = useLiveKey();
  const { activeSlug } = useProjectMode();
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ epics: 0, features: 0, stories: 0, tasks: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listPhases(activeSlug),
      listEpics({}, activeSlug),
      listFeatures({}, activeSlug),
      listStories({}, activeSlug),
      listTasks({}, activeSlug),
    ]).then(([p, e, f, s, t]) => {
      setPhases(p);
      setEpics(e);
      setCounts({ epics: e.length, features: f.length, stories: s.length, tasks: t.length });
    }).finally(() => setLoading(false));
  }, [liveKey, activeSlug]);

  if (loading && epics.length === 0) return <SkeletonStack rows={5} />;

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto px-4">
      <div className="bg-surface-1 border border-white/[0.06] rounded-2xl shadow-elev-1 px-9 py-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-2">Project roadmap</div>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-[1.15] text-text-primary mb-6">Spine overview</h1>

        <div className="grid grid-cols-4 gap-6 pt-5 border-t border-white/[0.06]">
          {[
            { label: 'Epics',    val: counts.epics    },
            { label: 'Features', val: counts.features },
            { label: 'Stories',  val: counts.stories  },
            { label: 'Tasks',    val: counts.tasks    },
          ].map(c => (
            <div key={c.label}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-1.5">{c.label}</div>
              <div className="text-[24px] font-semibold text-text-primary">{c.val}</div>
            </div>
          ))}
        </div>

        {phases.length > 0 && (
          <div className="mt-7 pt-5 border-t border-white/[0.06]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-3">Phases</div>
            <div className="flex flex-wrap gap-2">
              {phases.map(p => (
                <span key={p.slug}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase ring-1"
                  style={{ background: p.color + '15', color: p.color, borderColor: p.color + '40' }}
                >
                  {p.display} <span className="opacity-60 ml-1">{epics.filter(e => (e.data as any).phase === p.slug).length}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {phases.length === 0 || epics.length === 0 ? (
        <EmptyState icon={Layers} title="No epics yet" hint="Add one with `kadai add epic --title 'My first epic' --phase mvp`" />
      ) : phases.map(phase => {
        const phaseEpics = epics
          .filter(e => (e.data as any).phase === phase.slug)
          .sort((a, b) => ((a.data as any).order ?? 0) - ((b.data as any).order ?? 0));
        if (phaseEpics.length === 0) return null;
        return (
          <section key={phase.slug}>
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: phase.color }}>
              {phase.display} <span className="text-text-tertiary normal-case ml-1">· {phaseEpics.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {phaseEpics.map(epic => <EpicCard key={(epic.data as any).id} epic={epic} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: clean.

- [ ] **Step 3: Tick the step checkboxes for Task 7 in the plan**

Tick all step checkboxes for Task 7.

- [ ] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Home.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): rebuild Home page — project hero + per-phase grids [Plan-17 Task-7]

Home gets a proper hero block (project + 4-count summary + phase pills
with item counts) and per-phase EpicCard grids. The phase pills moved
here from the topbar where they were noise on every page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Token polish for Search / Activity / Compare / Projects

**Files:**
- Modify: `src/web/frontend/src/pages/Search.tsx`
- Modify: `src/web/frontend/src/pages/Activity.tsx`
- Modify: `src/web/frontend/src/pages/Compare.tsx`
- Modify: `src/web/frontend/src/pages/Projects.tsx`

**Goal:** No structural redesign. Apply the new tokens (surface-1, text-primary, white/0.06 borders, the `Card` component where there are sectioned panels, JetBrains Mono everything via the global font).

For each page: read it, find any explicit `bg-zinc-*`, `bg-panel`, `text-zinc-*`, `border-zinc-*`, hardcoded grays — replace with the new token names. Wrap any "sectioned panel" content in `<Card>`. Most of these pages are already structurally fine; this is a search-and-replace pass.

- [ ] **Step 1: Update Search.tsx**

Open `/home/fintan/repos/kadai/src/web/frontend/src/pages/Search.tsx`. Find the `<Link>` cards rendered in the result list. Replace `bg-panel border border-zinc-800 hover:border-zinc-600` with `bg-surface-1 border border-white/[0.06] hover:border-white/[0.16]`. Replace any `text-muted` with `text-text-tertiary`. Other classes can stay.

- [ ] **Step 2: Update Activity.tsx**

Open `/home/fintan/repos/kadai/src/web/frontend/src/pages/Activity.tsx`. Wrap the entries list in a `<Card title="Recent activity" count={...}>` (with the entry rows as children). Update kind-badge classes to use `bg-status-ready/10` / `bg-status-review/10` / `bg-status-in_progress/10` (was `bg-blue-900/40` etc.).

- [ ] **Step 3: Update Compare.tsx**

Open `/home/fintan/repos/kadai/src/web/frontend/src/pages/Compare.tsx`. Replace `bg-panel rounded p-3` (the side cards) with the `<Card>` component. Replace `bg-amber-900/30 hover:bg-amber-900/50` (the overlap rows) with `bg-accent/10 hover:bg-accent/15 ring-1 ring-accent/20`. Replace `bg-zinc-800` (non-overlap rows) with `bg-white/[0.03] hover:bg-white/[0.05]`.

- [ ] **Step 4: Update Projects.tsx**

Open `/home/fintan/repos/kadai/src/web/frontend/src/pages/Projects.tsx`. Replace project-card classes (`bg-panel border border-zinc-800 hover:border-zinc-600`) with `bg-surface-1 border border-white/[0.06] hover:border-white/[0.16]`.

- [ ] **Step 5: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: clean.

- [ ] **Step 6: Tick the step checkboxes for Task 8 in the plan**

Tick all step checkboxes for Task 8.

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Search.tsx src/web/frontend/src/pages/Activity.tsx src/web/frontend/src/pages/Compare.tsx src/web/frontend/src/pages/Projects.tsx docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
feat(web/client): token polish for Search / Activity / Compare / Projects [Plan-17 Task-8]

No structural redesign. Apply the new surface / border / accent tokens
across the four secondary pages so they match the redesigned detail
pages. Activity and Compare adopt the new <Card> component for sectioned
panels.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Playwright + docs + plugin v1.3.0 + dogfood

**Files:**
- Modify: `tests/web/e2e.pw.ts`
- Modify: `docs/wiki/web-viewer.md`
- Modify: `docs/wiki/post-mvp.md`
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (1.2.0 → 1.3.0)
- Modify: `docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md`

**Goal:** Fix the Playwright tests broken by the Story-tabs removal, add 2 new E2E flows for the View toggle, update docs, bump plugin, dogfood.

- [ ] **Step 1: Run Playwright to see what broke**

```bash
cd /home/fintan/repos/kadai
bun run build:web && bun run embed-assets
bunx playwright test 2>&1 | tail -40
```

Capture the failures. Likely:
- `text=button { hasText: 'spec' }` — the spec/plan/changelog/tasks tab buttons no longer exist on Story page
- `text=No spec attached` — copy may have shifted
- `text=Picked:` — topbar picked indicator changed format

- [ ] **Step 2: Update broken Story tab selectors**

Find tests in `tests/web/e2e.pw.ts` that assert on Story page tabs:
- The "drilling into a story shows the tabs" test asserts `button { hasText: 'spec' }` etc. The tabs are gone — replace this test's assertions with what the new Story page shows: `text=Description`, `text=Documents`, `text=spec.md`.
- The "attaching a spec.md uploads and renders it" test clicks the spec tab. Now there's no tab — the spec attach button is in the right column when no spec is attached. Update: instead of clicking `button { hasText: 'spec' }`, just look for `text=No spec attached` directly (it's visible by default in the right column).
- The "attaching a plan via the plan tab" test (Plan 14) does the same for plan — same fix.
- Any `text=Picked:` topbar selector → use `text=Picked: STORY-001` (the format in the new topbar) or grep for the picked-pill more loosely.

The exact replacements depend on the actual failures. Patch each one minimally.

- [ ] **Step 3: Add 2 new E2E for the View toggle**

APPEND to `tests/web/e2e.pw.ts`:

```typescript
test('Story page View toggle: Tree shows the subtree of the parent feature', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('load');

  await page.locator('button', { hasText: 'Tree' }).first().click();
  await page.waitForURL(/view=tree/);

  // The tree should render the parent feature + this story (and any siblings)
  await expect(page.locator('text=Subtree')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=← here').first()).toBeVisible();
});

test('Feature page View toggle: Kanban renders the kanban columns', async ({ page }) => {
  await page.goto(`${serverUrl}/features/FEAT-001`);
  await page.waitForLoadState('load');

  await page.locator('button', { hasText: 'Kanban' }).click();
  await page.waitForURL(/view=kanban/);

  // The kanban columns from KanbanBoard should be visible by data-testid
  await expect(page.locator('[data-testid="column-ready"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid="column-in_progress"]')).toBeVisible();
});
```

- [ ] **Step 4: Run Playwright to verify**

```bash
cd /home/fintan/repos/kadai
bunx playwright test
```

Expected: all tests pass (existing-fixed + 2 new). If anything still fails, patch its selector minimally.

- [ ] **Step 5: Update web-viewer.md**

In `/home/fintan/repos/kadai/docs/wiki/web-viewer.md`, replace the "Layout" section's content with a brief description of the redesign:

```markdown
## Layout

The viewer follows a consistent **hero + body** pattern across detail pages (Story, Feature, Epic):

- **Topbar:** brand mark, project context (multi-mode), Activity / Compare nav, search, picked indicator
- **Breadcrumb:** parent chain leading to the current item
- **Hero block:** kind label + ID pill + title + status + phase + progress (`X of Y done`) + actions + view toggle
- **Detail body:** 2-column grid — primary content (description, decomposition list) on the left; context (documents, attached content) on the right
- **View toggle:** every detail page can switch into a **Tree** view of its subtree. The Feature page also has a third Kanban view for drag-drop status changes.

The Home page replaces the per-item hero with a project-level hero (4-count summary + phase pills) and per-phase grids of epic cards.

See [api-reference.md](api-reference.md#subtree) for `GET /api/items/:id/subtree`, used by the TreeView.
```

(Add a `## subtree` anchor in api-reference.md if you have time, but optional.)

- [ ] **Step 6: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`, in "Recently shipped", insert ABOVE Plan 16:

```markdown
### Plan 17 — Web viewer redesign (shipped 2026-05-06)

- Hero block + detail body pattern across Story / Feature / Epic / Home
- TreeView component (Mode B) reachable via View toggle on each detail page
- Story tabs replaced with cards (Description / Tasks / Documents / Attached content)
- Feature page defaults to Stories list; kanban moves to `?view=kanban`
- Refined design tokens: single brand accent (teal-300), desaturated status palette, calmer surfaces with shadow elevation
- JetBrains Mono everywhere via @fontsource (single font, coherent dev-tool identity)
- New backend endpoint: `GET /api/items/:id/subtree`
- 6 new components (Hero, Card, ProgressBar, IdPill, Breadcrumb, DocumentRow, TreeView)
- Plugin version bumped to 1.3.0
```

- [ ] **Step 7: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "1.2.0"` to `"version": "1.3.0"`.

- [ ] **Step 8: Dogfood smoke**

```bash
TMP=$(mktemp -d -t kadai-plan17-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "Math utils" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Implement add(a,b)" --phase mvp --feature FEAT-001 > /dev/null
kadai add story --title "Implement subtract(a,b)" --phase mvp --feature FEAT-001 > /dev/null
kadai add task --title "Add jest tests" --story STORY-001 > /dev/null
kadai pick STORY-001 > /dev/null

( cd /home/fintan/repos/kadai && bun run build:web > /dev/null && bun run embed-assets > /dev/null )

kadai serve --no-open --port 7917 > /tmp/kadai-plan17.log 2>&1 &
SERVE_PID=$!
sleep 2

echo "=== / (SPA index) ==="
curl -s http://localhost:7917/ | grep -E "div id=\"root\"" | head -1

echo "=== /api/items/EPIC-001/subtree ==="
curl -s http://localhost:7917/api/items/EPIC-001/subtree | head -c 200

echo "=== /api/items/STORY-001 ==="
curl -s http://localhost:7917/api/items/STORY-001 | head -c 100

echo ""
echo "Visit http://localhost:7917/stories/STORY-001 to verify the redesigned Story page"
sleep 5
kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP" /tmp/kadai-plan17.log
```

CAPTURE the output.

- [ ] **Step 9: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Web viewer redesign — Plan 17 verification — 2026-05-06

Built the new SPA + ran kadai serve against a populated tmp project.

- Server smoke: `/` returns SPA index; `/api/items/EPIC-001/subtree` returns flat list of epic + descendants ✅
- `bun test` → unit tests pass (no behavior change) ✅
- `bun run build:web && bun run embed-assets` clean ✅
- `bunx playwright test` → all flows pass after selector updates for removed tabs (~3 selectors patched) + 2 new tree/kanban toggle flows ✅
- Visual check (manual): redesigned pages have the hero+body pattern; View toggle wires through `?view=tree`; calm surfaces; one teal CTA per page ✅

### Verdict: PASS

Web viewer redesigned per the spec. Reads as designed product, not a scaffold.
```

- [ ] **Step 10: Run the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web && bun run embed-assets
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 11: Tick the Task 9 checkboxes + Plan 17 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md`:
- Tick all step checkboxes for Task 9
- Tick all checkboxes in the Plan 17 self-review checklist

- [ ] **Step 12: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/web/e2e.pw.ts docs/wiki/web-viewer.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md
git commit -m "$(cat <<'EOF'
docs(plan-17): playwright + wiki + post-mvp shipped + plugin v1.3.0 [Plan-17 Task-9]

- 3 selector updates for removed Story tabs
- 2 new E2E flows for the Tree / Kanban view toggles
- web-viewer.md: describe the new hero + body pattern + view toggle
- post-mvp.md: Plan 17 → Recently shipped
- plugin.json: 1.2.0 → 1.3.0
- dogfood-acceptance-test.md: redesign smoke check

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 17 self-review checklist

- [ ] All 9 tasks completed; checkboxes ticked.
- [ ] `bun test` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (existing tests adapted + 2 new tree/kanban flows).
- [ ] Story / Feature / Epic / Home pages render with the new Hero + body pattern.
- [ ] View toggle is reachable on all 3 detail pages and `?view=tree` renders the TreeView.
- [ ] Feature `?view=kanban` renders the kanban.
- [ ] `GET /api/items/:id/subtree` returns the expected shape.
- [ ] Brand accent (teal) appears in at most one place per visible page.
- [ ] No element other than `StatusBadge` and kanban column borders uses status colors.
- [ ] JetBrains Mono is the page font (verify in DevTools).
- [ ] Plugin v1.3.0 in the manifest.
- [ ] `docs/wiki/web-viewer.md` updated.
- [ ] `docs/wiki/post-mvp.md`: Plan 17 in "Recently shipped".
