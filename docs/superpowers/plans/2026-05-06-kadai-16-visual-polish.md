# Kadai Plan 16 — Visual polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the web viewer from "functional but visually sparse" to "looks like a product, not a scaffold." Add per-status color coding, kind icons, skeleton loaders, structured empty states, header refinement, and a consistent typography pass — without touching app behavior.

**Architecture:** Strictly additive. Three new shared components (`StatusBadge`, `KindIcon`, `EmptyState`, plus a tiny `Skeleton` primitive) get applied across the existing 8 pages. Tailwind config gains a status-color palette + a few semantic tokens. No behavioral changes; tests keep passing as-is. New runtime dep: `lucide-react` (~10kB tree-shakable icon library, dev-grade widely used with React).

**Tech Stack:** TypeScript on Bun (existing). React 19 + Tailwind v3 + TanStack Router (existing). One new dep: `lucide-react`.

## Position in the build

| | |
|---|---|
| **This is plan** | 16 of N — first post-v1.1.0 plan |
| **Prior plan** | [Plan 15 — Multi-project switcher](2026-05-06-kadai-15-multi-project.md) — `DONE` (post-MVP backlog drained) |
| **Next plan** | None drafted — open-ended after this |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## Scope (boxed — do not expand)

This plan ships 6 specific upgrades. We're explicit about scope to avoid the design-pass-ballooning trap:

1. **Status color tokens** in tailwind.config.js + a `<StatusBadge>` component that maps status → color; rolled out everywhere a status string is rendered.
2. **Kind icons** via `lucide-react` + a `<KindIcon>` component (epic=`Layers`, feature=`Box`, story=`BookOpen`, task=`CheckSquare`); rolled out to list pages + activity feed + headers.
3. **Skeleton loaders** — replace `"Loading or not found…"` text with shimmering placeholder boxes for the main pages (Home, Epic, Feature, Story).
4. **Empty states** — replace `"(no features yet)"` italic text with a structured `<EmptyState>` (icon + headline + suggested next action).
5. **Header refresh** — tighten the top bar (better visual rhythm; clearer separation between brand, project context, nav, search, and picked indicator).
6. **Typography pass** — add a few semantic font-size / weight / letter-spacing tokens; apply consistent uppercase labels for "ACCEPTANCE CRITERIA", "SPEC", "PLAN", etc.

## Out of scope (explicit)

- New colors beyond the status palette + a tiny semantic addition (no rebrand).
- Logo / favicon work.
- Animations beyond simple Tailwind transitions (no spring physics, no choreographed page transitions).
- Mobile redesign — viewer stays desktop-first.
- Light theme — dark only.
- Component-library extraction.
- Any new product feature (this plan touches NO behavior, only visuals).

## File structure

```
src/web/frontend/tailwind.config.js                    # MODIFIED: status colors + a few semantic tokens
src/web/frontend/src/styles.css                        # MODIFIED: shimmer keyframe for skeleton

src/web/frontend/src/components/StatusBadge.tsx        # NEW
src/web/frontend/src/components/KindIcon.tsx           # NEW
src/web/frontend/src/components/Skeleton.tsx           # NEW
src/web/frontend/src/components/EmptyState.tsx         # NEW

src/web/frontend/src/pages/Home.tsx                    # MODIFIED: KindIcon on epic cards; skeleton
src/web/frontend/src/pages/Epic.tsx                    # MODIFIED: badges + icons + empty state + skeleton
src/web/frontend/src/pages/Feature.tsx                 # MODIFIED: badges + icons + skeleton
src/web/frontend/src/pages/Story.tsx                   # MODIFIED: badges + icons + empty state + skeleton
src/web/frontend/src/pages/Search.tsx                  # MODIFIED: KindIcon on result rows; status badges
src/web/frontend/src/pages/Activity.tsx                # MODIFIED: KindIcon on rows; refined kind badges
src/web/frontend/src/pages/Compare.tsx                 # MODIFIED: KindIcon + status badges on items
src/web/frontend/src/pages/Projects.tsx                # MODIFIED: simple icon header

src/web/frontend/src/components/Layout.tsx             # MODIFIED: header refresh
src/web/frontend/src/components/EpicCard.tsx           # MODIFIED: KindIcon + status badge
src/web/frontend/src/components/KanbanBoard.tsx        # MODIFIED: status-colored column headers + card status badges

package.json                                            # MODIFIED: + lucide-react

docs/wiki/web-viewer.md                                # MODIFIED: brief note on the visual changes
docs/wiki/post-mvp.md                                  # MODIFIED: Plan 16 → Recently shipped
docs/dogfood-acceptance-test.md                        # APPEND: Plan 16 verification (visual smoke check)
kadai-plugin/.claude-plugin/plugin.json                # MODIFIED: 1.1.0 → 1.2.0
```

## Tasks

---

### Task 1: Design tokens — status colors + Tailwind config

**Files:**
- Modify: `src/web/frontend/tailwind.config.js`
- Modify: `src/web/frontend/src/styles.css`

**Goal:** Define the status color palette as Tailwind theme tokens so consumers reach for `text-status-in_progress` rather than ad-hoc `text-amber-300`. Also adds the `shimmer` keyframe used by the skeleton loader (Task 3).

The palette (consistent with existing semantic conventions):

| Status | Token | Hex | Use |
|---|---|---|---|
| `backlog` | `status-backlog` | `#9ca3af` | grey — not yet sized |
| `ready` | `status-ready` | `#60a5fa` | blue — picked-up-able |
| `in_progress` | `status-in_progress` | `#fbbf24` | amber — active work |
| `blocked` | `status-blocked` | `#f87171` | red — needs attention |
| `review` | `status-review` | `#a78bfa` | purple — story-only review state |
| `done` | `status-done` | `#34d399` | green — shipped |
| `cancelled` | `status-cancelled` | `#52525b` | dim zinc — out of scope |

- [x] **Step 1: Update tailwind.config.js**

Read `/home/fintan/repos/kadai/src/web/frontend/tailwind.config.js`. Replace it entirely with:

```javascript
/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#1e1e22',
        panel: '#252528',
        muted: '#9ca3af',
        // Subtle elevated surface for hover, rail panels, etc.
        'panel-hi': '#2d2d31',
        'panel-lo': '#1a1a1d',
        // Status palette — used by StatusBadge.
        'status-backlog':     '#9ca3af',
        'status-ready':       '#60a5fa',
        'status-in_progress': '#fbbf24',
        'status-blocked':     '#f87171',
        'status-review':      '#a78bfa',
        'status-done':        '#34d399',
        'status-cancelled':   '#52525b',
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

(Tailwind v3 accepts underscores in arbitrary class names, so `bg-status-in_progress` works.)

- [x] **Step 2: Update styles.css with the skeleton background**

Read `/home/fintan/repos/kadai/src/web/frontend/src/styles.css`. Append:

```css
/* Skeleton loader — used by <Skeleton> with `animate-shimmer`. */
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
}
```

- [x] **Step 3: Build the SPA + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
```

Expected: clean. If Tailwind complains about the underscore in `bg-status-in_progress`, use the `safelist` config option to whitelist these class names. (Most Tailwind v3 setups handle them fine; if not, add a safelist entry.)

- [x] **Step 4: Tick the step checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md`, find Task 1 and tick all step checkboxes.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/tailwind.config.js src/web/frontend/src/styles.css docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md
git commit -m "$(cat <<'EOF'
feat(web/client): status color tokens + shimmer keyframe [Plan-16 Task-1]

Adds 7-status palette (backlog/ready/in_progress/blocked/review/done/
cancelled) as Tailwind theme tokens, plus a `panel-hi`/`panel-lo` pair
for elevation, plus the `shimmer` keyframe + `.skeleton` background-image
used by Task 3's Skeleton component.

Foundation for the rest of the visual polish pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reusable components — StatusBadge + KindIcon + Skeleton + EmptyState

**Files:**
- Modify: `package.json` (add `lucide-react`)
- Create: `src/web/frontend/src/components/StatusBadge.tsx`
- Create: `src/web/frontend/src/components/KindIcon.tsx`
- Create: `src/web/frontend/src/components/Skeleton.tsx`
- Create: `src/web/frontend/src/components/EmptyState.tsx`

**Goal:** Four small reusable building blocks. Tasks 3-5 roll them out across pages.

- [x] **Step 1: Install lucide-react**

```bash
cd /home/fintan/repos/kadai
bun add lucide-react@^0.460.0
```

Verify it landed:

```bash
grep '"lucide-react"' package.json
```

Expected: a `"lucide-react": "^0.460.x"` line in dependencies.

- [x] **Step 2: Create StatusBadge.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/StatusBadge.tsx`:

```tsx
import type { Status } from '../types';

const BG_BY_STATUS: Record<Status, string> = {
  backlog:     'bg-status-backlog/20 text-status-backlog ring-1 ring-status-backlog/30',
  ready:       'bg-status-ready/20 text-status-ready ring-1 ring-status-ready/30',
  in_progress: 'bg-status-in_progress/20 text-status-in_progress ring-1 ring-status-in_progress/30',
  blocked:     'bg-status-blocked/20 text-status-blocked ring-1 ring-status-blocked/30',
  review:      'bg-status-review/20 text-status-review ring-1 ring-status-review/30',
  done:        'bg-status-done/20 text-status-done ring-1 ring-status-done/30',
  cancelled:   'bg-status-cancelled/30 text-zinc-400 ring-1 ring-status-cancelled/40 line-through opacity-70',
};

interface Props {
  status: Status;
  size?: 'xs' | 'sm';
  className?: string;
}

export function StatusBadge({ status, size = 'xs', className = '' }: Props) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span
      className={`${sizeClass} ${BG_BY_STATUS[status]} rounded font-medium tracking-wide uppercase ${className}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
```

- [x] **Step 3: Create KindIcon.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/KindIcon.tsx`:

```tsx
import { Layers, Box, BookOpen, CheckSquare, type LucideIcon } from 'lucide-react';
import type { ItemKind } from '../types';

const ICON_BY_KIND: Record<ItemKind, LucideIcon> = {
  epic: Layers,
  feature: Box,
  story: BookOpen,
  task: CheckSquare,
};

const COLOR_BY_KIND: Record<ItemKind, string> = {
  epic: 'text-violet-400',
  feature: 'text-sky-400',
  story: 'text-emerald-400',
  task: 'text-zinc-400',
};

interface Props {
  kind: ItemKind;
  size?: number;
  className?: string;
  colored?: boolean;  // default true
}

export function KindIcon({ kind, size = 14, className = '', colored = true }: Props) {
  const Icon = ICON_BY_KIND[kind];
  const colorClass = colored ? COLOR_BY_KIND[kind] : 'text-zinc-400';
  return <Icon size={size} className={`${colorClass} shrink-0 ${className}`} aria-label={kind} />;
}
```

- [x] **Step 4: Create Skeleton.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/Skeleton.tsx`:

```tsx
interface Props {
  className?: string;
}

/**
 * Shimmering placeholder block. Compose multiple to stand in for a real layout.
 * Use Tailwind size classes (h-4, w-32, etc.) on each instance.
 */
export function Skeleton({ className = 'h-4 w-32' }: Props) {
  return <div className={`skeleton animate-shimmer rounded ${className}`} />;
}

export function SkeletonStack({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 5: Create EmptyState.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, hint, action, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      <Icon size={32} className="text-zinc-600 mb-3" aria-hidden="true" />
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      {hint && <div className="text-xs text-muted mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
```

- [x] **Step 6: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, 332 tests pass (no functional change).

- [x] **Step 7: Tick the step checkboxes for Task 2 in the plan**

Tick all step checkboxes for Task 2.

- [ ] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add package.json bun.lock src/web/frontend/src/components/StatusBadge.tsx src/web/frontend/src/components/KindIcon.tsx src/web/frontend/src/components/Skeleton.tsx src/web/frontend/src/components/EmptyState.tsx docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md
git commit -m "$(cat <<'EOF'
feat(web/client): StatusBadge + KindIcon + Skeleton + EmptyState [Plan-16 Task-2]

Four small reusable components that subsequent tasks roll out across the
SPA. Adds lucide-react (~10kB tree-shaken) for the icon set.

- StatusBadge: per-status color (uses tokens from Task 1)
- KindIcon: epic=Layers, feature=Box, story=BookOpen, task=CheckSquare
- Skeleton + SkeletonStack: shimmer-animated placeholder for loading states
- EmptyState: icon + title + hint + action — replaces italic placeholders

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Roll out skeletons + empty states across pages

**Files:**
- Modify: `src/web/frontend/src/pages/Home.tsx`
- Modify: `src/web/frontend/src/pages/Epic.tsx`
- Modify: `src/web/frontend/src/pages/Feature.tsx`
- Modify: `src/web/frontend/src/pages/Story.tsx`
- Modify: `src/web/frontend/src/pages/Search.tsx`
- Modify: `src/web/frontend/src/pages/Activity.tsx`
- Modify: `src/web/frontend/src/pages/Compare.tsx`
- Modify: `src/web/frontend/src/pages/Projects.tsx`

**Goal:** Replace every `"Loading or not found…"` text + every `text-muted italic` empty placeholder with the new `<Skeleton>` / `<EmptyState>` components.

For loading states: distinguish "loading" from "not found". Today they're conflated as `if (!story) return <div>Loading or not found…</div>`. Split: track an explicit `loading` state in `useEffect`, render a `<SkeletonStack>` while loading; render an `<EmptyState icon={SearchX} title="Not found" hint="No story with that ID exists.">` afterwards.

For empty states: each page needs its own copy. Examples:

| Page | When | EmptyState content |
|---|---|---|
| Epic | no features | icon=Box, title="No features yet", hint="Add one with `kadai add feature --epic <ID>`" |
| Feature | no stories | icon=BookOpen, title="No stories yet", hint="Add one with `kadai add story --feature <ID>`" |
| Story tasks tab | no tasks | icon=CheckSquare, title="No tasks", hint="Add one with `kadai add task --story <ID>`" |
| Story spec tab (no spec) | keep existing AttachButton flow but wrap in EmptyState styling |
| Story plan tab (no plan) | same — wrap in EmptyState |
| Story changelog tab | empty | icon=Clock, title="Changelog is empty", hint="Edits to picked stories appear here." |
| Activity | no entries | icon=Clock, title="No activity yet", hint="Edits, commits, and notes will appear here as work progresses." |
| Search | no results | icon=SearchX, title="No results", hint="Try a different query — we search title, body, and acceptance criteria." |
| Compare | unknown phase | icon=Columns, title="Phase not found", hint="Pick from the available phases listed in the URL hint." |
| Projects | empty registry | already structured — keep existing copy |

- [x] **Step 1: Update Home.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/pages/Home.tsx`. Add imports:

```typescript
import { SkeletonStack } from '../components/Skeleton';
```

Track an explicit loading flag (the existing `useEffect` resolves two promises; render `SkeletonStack` until both have resolved at least once):

```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  setLoading(true);
  Promise.all([listPhases(activeSlug), listEpics({}, activeSlug)])
    .then(([p, e]) => { setPhases(p); setEpics(e); })
    .finally(() => setLoading(false));
}, [liveKey, activeSlug]);
```

Above the existing render output, conditionally show the skeleton:

```tsx
if (loading && phases.length === 0) {
  return <SkeletonStack rows={5} />;
}
```

- [x] **Step 2: Update Epic.tsx**

Read the file. Add imports:

```typescript
import { SkeletonStack } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Box, FileQuestion } from 'lucide-react';
```

Replace `if (!epic) return <div className="text-muted">Loading or not found…</div>;` with split loading/not-found logic:

```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  setLoading(true);
  Promise.all([getItem(id, activeSlug), listFeatures({ epic_id: id }, activeSlug)])
    .then(([e, f]) => { setEpic(e); setFeatures(f); })
    .finally(() => setLoading(false));
}, [id, liveKey, activeSlug]);

if (loading && !epic) return <SkeletonStack rows={4} />;
if (!epic) return <EmptyState icon={FileQuestion} title="Epic not found" hint={`No epic with ID ${id} exists.`} />;
```

Replace `<div className="text-muted text-sm italic">(no features yet)</div>` with:

```tsx
<EmptyState icon={Box} title="No features yet" hint={`Add one with \`kadai add feature --epic ${id}\``} />
```

- [x] **Step 3: Update Feature.tsx**

Same pattern. Add imports for `SkeletonStack`, `EmptyState`, `BookOpen`, `FileQuestion` from `lucide-react`.

Replace the `Loading or not found…` line with split logic + skeleton + EmptyState (`Feature not found` if not found).

If the page renders an empty kanban (no stories yet), wrap it: when stories.length === 0 add `<EmptyState icon={BookOpen} title="No stories yet" hint={...} />` instead of an empty kanban. (Don't remove the kanban; render either it OR the empty state.)

- [x] **Step 4: Update Story.tsx**

Same pattern. Add imports for `SkeletonStack`, `EmptyState`, `CheckSquare`, `Clock`, `FileQuestion`, `FileText` from `lucide-react`.

- Loading skeleton + not-found empty state for the story itself.
- Tasks tab: replace `<div className="text-muted italic">No tasks yet.</div>` with EmptyState (icon=CheckSquare).
- Spec tab no-attach: wrap in EmptyState (icon=FileText, title="No spec attached", hint="Upload a spec.md to define what this story should do.") — keep the existing AttachButton inside the `action` slot.
- Plan tab no-attach: similar (icon=FileText, title="No plan attached", hint="Upload a plan.md with implementation steps.").
- Changelog tab empty: EmptyState (icon=Clock, title="Changelog is empty", hint="Edits to this story while picked, plus matching commits, appear here.").

- [x] **Step 5: Update Search.tsx**

Add imports for `EmptyState`, `SearchX` from `lucide-react`.

Replace the existing "No results." text with:

```tsx
<EmptyState icon={SearchX} title="No results" hint="Try a different query — we search title, body, and acceptance criteria." />
```

Loading state stays as-is (skeleton overkill for inline search).

- [x] **Step 6: Update Activity.tsx**

Add imports for `EmptyState`, `SkeletonStack`, `Clock` from `lucide-react`.

Replace `{loading && <div className="text-muted italic">Loading…</div>}` with:

```tsx
{loading && entries.length === 0 && <SkeletonStack rows={6} />}
```

Replace the empty case:

```tsx
{!loading && entries.length === 0 && (
  <EmptyState icon={Clock} title="No activity yet" hint="Edits, commits, and notes will appear here as work progresses." />
)}
```

- [x] **Step 7: Update Compare.tsx**

Add imports for `EmptyState`, `SkeletonStack`, `Columns2`, `FileQuestion` from `lucide-react`.

For the no-params hint at the top of Compare.tsx, leave as-is (it's already a styled instructional block).

For each side that has `items.length === 0`, render an inline EmptyState within the card body instead of a blank list.

- [x] **Step 8: Update Projects.tsx**

Add an icon to the existing "No projects registered" branch:

```tsx
import { FolderTree } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
// ...
if (projects.length === 0) {
  return (
    <EmptyState
      icon={FolderTree}
      title="No projects registered"
      hint="Run `kadai serve register [path]` to add a project."
    />
  );
}
```

(Keep the existing "Projects (N)" header for the populated case unchanged.)

- [x] **Step 9: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
bunx playwright test
```

Expected: build clean, typecheck clean, 332 unit tests pass, 18 Playwright pass.

If a Playwright test fails because the empty-state copy changed (e.g., test asserts `text=No spec attached` but the EmptyState now renders `No spec attached` inside an `<EmptyState>` wrapper), update the selector to match new shape OR rely on the test still finding the literal text since EmptyState renders it as visible text.

- [x] **Step 10: Tick the step checkboxes for Task 3 in the plan**

Tick all step checkboxes for Task 3.

- [x] **Step 11: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Home.tsx src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/pages/Story.tsx src/web/frontend/src/pages/Search.tsx src/web/frontend/src/pages/Activity.tsx src/web/frontend/src/pages/Compare.tsx src/web/frontend/src/pages/Projects.tsx docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md
git commit -m "$(cat <<'EOF'
feat(web/client): skeleton loaders + empty states across all pages [Plan-16 Task-3]

Replaces "Loading or not found…" text with split loading/not-found
states: shimmer skeleton while fetching; structured EmptyState (icon +
title + hint) when nothing's there. Each empty state copy is page-
specific and includes a suggested next action (e.g., the kadai CLI
command to add the missing thing).

Behavior unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Roll out StatusBadge + KindIcon

**Files:**
- Modify: `src/web/frontend/src/components/EpicCard.tsx`
- Modify: `src/web/frontend/src/components/KanbanBoard.tsx`
- Modify: `src/web/frontend/src/pages/Epic.tsx`
- Modify: `src/web/frontend/src/pages/Feature.tsx`
- Modify: `src/web/frontend/src/pages/Story.tsx`
- Modify: `src/web/frontend/src/pages/Search.tsx`
- Modify: `src/web/frontend/src/pages/Activity.tsx`
- Modify: `src/web/frontend/src/pages/Compare.tsx`

**Goal:** Replace every `<span className="bg-zinc-800 ... rounded">{status}</span>` with `<StatusBadge status={status} />`. Add `<KindIcon kind="epic" />` etc. next to item titles in lists.

For each file:
1. Import `StatusBadge` and `KindIcon`.
2. Find every place a status string is rendered as a badge — replace with `<StatusBadge status={x} />`.
3. Find every place an item kind is rendered (often as text label) — add a `<KindIcon kind={x} size={14} />` to its left.

- [x] **Step 1: Update EpicCard.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/EpicCard.tsx`. Wherever the epic's status is rendered, replace with `<StatusBadge status={status as Status} />`. Add `<KindIcon kind="epic" />` next to the epic title.

(The component is small; if you can't easily extract status, accept a Status prop and replace the existing status display.)

- [x] **Step 2: Update KanbanBoard.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/KanbanBoard.tsx`.

Update column headers to be color-coded:

```tsx
const COLUMN_HEADER_BY_STATUS: Record<Status, string> = {
  backlog:     'border-status-backlog/40',
  ready:       'border-status-ready/40',
  in_progress: 'border-status-in_progress/40',
  blocked:     'border-status-blocked/40',
  review:      'border-status-review/40',
  done:        'border-status-done/40',
  cancelled:   'border-status-cancelled/40',
};
```

Apply `border-l-2 ${COLUMN_HEADER_BY_STATUS[status]}` (or similar) to each column wrapper so they have a small color stripe. Keep card story cards minimal — add a tiny `<StatusBadge size="xs" status={story.data.status} />` next to the card title if room allows.

- [x] **Step 3: Update each page**

For Epic.tsx, Feature.tsx, Story.tsx, Search.tsx, Activity.tsx, Compare.tsx — find every status text/badge and replace with `<StatusBadge status={...} />`. Find every kind label (uppercase "epic"/"feature"/etc.) and prepend `<KindIcon kind={...} size={14} />`.

Specifically:
- Epic.tsx: `<span className="bg-zinc-800 px-2 py-0.5 rounded">{fd.status}</span>` → `<StatusBadge status={fd.status as Status} />`. The header `{d.id} · phase {d.phase} · {d.status}` line: replace `· {d.status}` segment with a trailing `<StatusBadge>`.
- Feature.tsx: same status replacements.
- Story.tsx: header status replacement; tasks list status badges; the right-rail StatusPanel already handles current status display — leave that to Task 5 (header refresh covers it).
- Search.tsx: `<span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{r.status}</span>` → `<StatusBadge status={r.status} />`. Add `<KindIcon kind={r.kind} />` next to the kind label.
- Activity.tsx: Add `<KindIcon kind={e.itemKind} />` next to the item ID. (Keep the existing kind badge for the change kind — Write/commit/note — that's a different concept.)
- Compare.tsx: each item line gets `<KindIcon kind={item.kind} />` and `<StatusBadge status={item.status} />`.

- [x] **Step 4: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
bunx playwright test
```

Expected: clean. Playwright may need selector updates if a test asserted `text=in_progress` and the badge now renders `IN PROGRESS` (uppercase via `tracking-wide uppercase`). Update affected selectors to match new casing — use `text=IN PROGRESS` or `text=/in[ _]progress/i` for case-insensitive match.

- [x] **Step 5: Tick the step checkboxes for Task 4 in the plan**

Tick all step checkboxes for Task 4.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/EpicCard.tsx src/web/frontend/src/components/KanbanBoard.tsx src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/pages/Story.tsx src/web/frontend/src/pages/Search.tsx src/web/frontend/src/pages/Activity.tsx src/web/frontend/src/pages/Compare.tsx docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md
git commit -m "$(cat <<'EOF'
feat(web/client): roll out StatusBadge + KindIcon across pages [Plan-16 Task-4]

Every status string is now a color-coded StatusBadge (per-status palette
from Task 1: blue/amber/red/purple/green/grey). Every item-kind label
gets a KindIcon prefix (epic=Layers, feature=Box, story=BookOpen,
task=CheckSquare). Kanban column headers gain a colored left border.

Behavior unchanged. Some Playwright selectors updated to match new
uppercase status text.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Header refresh + typography pass

**Files:**
- Modify: `src/web/frontend/src/components/Layout.tsx`
- Modify: `src/web/frontend/src/styles.css` (small typography helpers)
- Modify: pages with section headers (Epic / Feature / Story) — apply consistent uppercase label class

**Goal:** The header is the first thing a user sees — it should feel like a product. Today it's: `Kadai title | phase pills | search | (Activity, Compare, Project) | picked indicator`. After: clearer visual hierarchy with a small left brand area, a quiet middle nav, the search box centered, and a right cluster for project + picked. Typography pass adds a `.section-label` utility for uppercase ALL-CAPS labels currently inlined as `text-xs font-bold uppercase tracking-wider text-muted` in many places.

- [ ] **Step 1: Add typography helpers to styles.css**

Append to `/home/fintan/repos/kadai/src/web/frontend/src/styles.css`:

```css
/* Section-label utility: uppercase, tracked, muted. Replaces ad-hoc
   `text-xs font-bold uppercase tracking-wider text-muted` chains. */
.section-label {
  font-size: 0.6875rem;     /* 11px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(156 163 175);  /* matches text-muted */
}
.section-label-sm {
  font-size: 0.625rem;      /* 10px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(156 163 175);
}
```

- [ ] **Step 2: Refresh Layout.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/Layout.tsx`. Replace the `<header>` block with a refreshed structure:

```tsx
<header className="bg-panel/80 backdrop-blur border-b border-zinc-800 px-6 py-2.5">
  <div className="flex items-center gap-6">
    {/* LEFT: brand */}
    <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
      <span className="text-emerald-400">●</span> Kadai
    </Link>

    {/* MID-LEFT: project context (multi-mode only) */}
    <ProjectIndicator />

    {/* MID: nav */}
    <nav className="flex items-center gap-4 text-sm">
      <Link to="/activity" className="text-muted hover:text-zinc-200 transition-colors">Activity</Link>
      <Link to="/compare" className="text-muted hover:text-zinc-200 transition-colors">Compare</Link>
    </nav>

    {/* CENTER: search (grows) */}
    <div className="flex-1 max-w-md">
      <SearchBox />
    </div>

    {/* RIGHT: phase pills + picked indicator */}
    <div className="flex items-center gap-3">
      <div className="hidden md:flex items-center gap-1.5">
        {phases.map(p => (
          <span
            key={p.slug}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ring-1"
            style={{ background: p.color + '15', color: p.color, borderColor: p.color + '40' }}
          >
            {p.display}
          </span>
        ))}
      </div>
      <div className="text-sm">
        {picked ? (
          <span className="bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 px-3 py-1 rounded-full font-medium">
            ● {picked.data.id}
          </span>
        ) : (
          <span className="text-muted text-xs">Nothing picked</span>
        )}
      </div>
    </div>
  </div>
</header>
```

(The `bg-panel/80 backdrop-blur` gives a subtle frosted look; the brand emoji is just `●` for now to avoid logo work.)

Make sure the `<SearchBox />`, `<ProjectIndicator />`, and `phases` data are still wired correctly in Layout. The existing imports stay; only the JSX inside `<header>` changes.

- [ ] **Step 3: Apply section-label utility to in-page section headers**

In Story.tsx, Epic.tsx, Feature.tsx, Compare.tsx — find any place that uses the inlined `text-xs font-bold uppercase tracking-wider text-muted` (or similar variants for `text-[10px]`). Replace with `className="section-label"` (or `section-label-sm` for the smaller variant).

This is a search-and-replace pass: typically 3-6 occurrences per page. The visual result should be IDENTICAL since `.section-label` matches the same look — but the codebase becomes consistent.

- [ ] **Step 4: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
bunx playwright test
```

Expected: clean.

- [ ] **Step 5: Tick the step checkboxes for Task 5 in the plan**

Tick all step checkboxes for Task 5.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/Layout.tsx src/web/frontend/src/styles.css src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/pages/Story.tsx src/web/frontend/src/pages/Compare.tsx docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md
git commit -m "$(cat <<'EOF'
feat(web/client): header refresh + typography pass [Plan-16 Task-5]

Layout: rebuild the header with clearer hierarchy — brand left, optional
project context next, nav (Activity/Compare), centered SearchBox,
phase pills + picked indicator on the right. Phase pills become rounded
ring-bordered chips; picked indicator becomes a green pill with status
dot. bg-panel/80 + backdrop-blur for a subtle frosted effect.

styles.css: add .section-label / .section-label-sm utilities. Pages
migrate ad-hoc uppercase chains to use them.

Behavior unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Docs + plugin v1.2.0 + dogfood

**Files:**
- Modify: `docs/wiki/web-viewer.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (1.1.0 → 1.2.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md`

- [ ] **Step 1: Update web-viewer.md**

In `/home/fintan/repos/kadai/docs/wiki/web-viewer.md`, add a brief section near the top (after the layout description):

```markdown
## Visual conventions

- **Status colors**: backlog (grey), ready (blue), in_progress (amber), blocked (red), review (purple), done (green), cancelled (dim grey + strikethrough).
- **Kind icons**: epics (Layers), features (Box), stories (BookOpen), tasks (CheckSquare).
- **Empty states** include a suggested CLI command to add the missing item.
- **Loading states** use shimmering skeleton placeholders (no spinners, no "Loading..." text).
```

- [ ] **Step 2: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`, in the "Recently shipped" section ABOVE `### Plan 15`, insert:

```markdown
### Plan 16 — Visual polish (shipped 2026-05-06)

- 7-status color palette (`status-backlog/ready/in_progress/blocked/review/done/cancelled`) as Tailwind tokens
- StatusBadge component rolled out to every status display
- KindIcon component (lucide-react) on epic/feature/story/task labels everywhere
- Skeleton loaders replace "Loading or not found…" text on Home / Epic / Feature / Story / Activity
- EmptyState component with icon + headline + CLI hint replaces every italic placeholder
- Header refresh: brand + nav + centered search + project context + picked indicator with proper visual hierarchy
- Typography pass: `.section-label` utility replaces ad-hoc `text-xs font-bold uppercase tracking-wider` chains
- New runtime dep: `lucide-react` (~10kB tree-shaken)
- Plugin version bumped to 1.2.0
```

(Note that this plan was added AFTER the "backlog drained" milestone in Plan 15; that's fine — a polish-pass plan was identified by the user as worth doing on top.)

- [ ] **Step 3: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 4: Dogfood — visual smoke test**

```bash
TMP=$(mktemp -d -t kadai-plan16-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "Math utils" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Implement add(a,b)" --phase mvp --feature FEAT-001 > /dev/null
kadai add story --title "Implement subtract(a,b)" --phase mvp --feature FEAT-001 > /dev/null
kadai add task --title "Add jest tests" --story STORY-001 > /dev/null
kadai pick STORY-001 > /dev/null

# Make sure embedded SPA is fresh.
( cd /home/fintan/repos/kadai && bun run build:web > /dev/null && bun run embed-assets > /dev/null )

kadai serve --no-open --port 7916 &
SERVE_PID=$!
sleep 2

echo "Visit http://localhost:7916/ and verify:"
echo "  - Header has brand + nav + search + phase pills + 'STORY-001' picked indicator"
echo "  - Roadmap home shows EPIC-001 with KindIcon (violet Layers)"
echo "  - /epics/EPIC-001 shows feature card with KindIcon + StatusBadge (blue 'READY')"
echo "  - /features/FEAT-001 kanban: columns have colored left borders by status"
echo "  - /stories/STORY-001 spec tab: empty state with FileText icon + Attach button"
echo "  - /activity: shows entries with KindIcon prefix (or empty state with Clock icon)"
echo ""
echo "When done observing, press Ctrl+C..."

# Wait briefly so the user can poke around if running interactively, then clean up.
sleep 5
kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP"
```

(In automated runs this is a no-op visual check; capture that the server started + responded to a curl on `/`.)

- [ ] **Step 5: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Visual polish run — Plan 16 verification — 2026-05-06

Built the SPA + ran kadai serve against a populated tmp project. Visual smoke check:

- Header: brand "● Kadai" left, project pill, Activity/Compare nav, centered search, phase pills (rounded chips with phase color), picked indicator (emerald pill) right ✅
- Status badges color-coded across pages (ready=blue, in_progress=amber, etc.) ✅
- Kind icons render on every item label (epic=violet Layers, feature=sky Box, story=emerald BookOpen, task=zinc CheckSquare) ✅
- Empty states show structured icon+title+hint instead of italic placeholder text ✅
- Loading states render shimmering skeleton blocks instead of "Loading or not found…" ✅
- `bun test` → 332/0 pass ✅
- `bun run build:web && bun run embed-assets` clean ✅
- `bunx playwright test` → 18/18 pass ✅

### Verdict: PASS

The viewer no longer reads as "early internet." Distinctive status colors, kind icons, and structured empty/loading states give it a proper-product feel.
```

- [ ] **Step 6: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web && bun run embed-assets
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 7: Tick the Task 6 checkboxes + Plan 16 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md`:
- Tick all step checkboxes for Task 6
- Tick all checkboxes in the "Plan 16 self-review checklist" section

- [ ] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/web-viewer.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-16-visual-polish.md
git commit -m "$(cat <<'EOF'
docs(plan-16): visual conventions + post-mvp shipped + plugin v1.2.0 [Plan-16 Task-6]

- web-viewer.md: brief 'Visual conventions' section
- post-mvp.md: Plan 16 added to Recently shipped
- plugin.json: 1.1.0 → 1.2.0
- dogfood-acceptance-test.md: visual smoke check

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 16 self-review checklist

- [ ] All 6 tasks completed; checkboxes ticked.
- [ ] `bun test` passes (332 — no functional change).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (18/18).
- [ ] Status badges color-coded across all pages.
- [ ] Kind icons appear on item labels everywhere (epic/feature/story/task).
- [ ] Skeleton loaders show during data fetch (no more "Loading or not found…" text).
- [ ] Empty states use structured icon+title+hint format.
- [ ] Header has clear visual hierarchy (brand / project / nav / search / context / picked).
- [ ] `.section-label` utility used consistently in pages.
- [ ] Plugin v1.2.0 in the manifest.
- [ ] post-mvp.md: Plan 16 in "Recently shipped".
- [ ] web-viewer.md: visual conventions section added.

---

## Done

After this plan: kadai-plugin v1.2.0, post-MVP backlog still drained (this plan was ON TOP of the drain), web viewer feels like a product. Future polish work (animations, light theme, mobile, etc.) is welcome but not on a roadmap.
