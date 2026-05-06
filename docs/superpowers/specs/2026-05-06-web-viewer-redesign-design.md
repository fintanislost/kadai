# Web viewer redesign — design spec

**Status:** Brainstormed and approved 2026-05-06. Ready for implementation planning.

## Motivation

The current web viewer (post-Plan-16) is consistent and functional but reads as "developer-tool grey." Two real problems beyond aesthetics:

1. **The pages don't tell you what they're for.** Story / Epic / Feature pages all open with a thin header + a wall of tabs or cards. There's no clear answer to "what is this and where does it stand?"
2. **The hierarchy isn't visible.** Users can't easily see how an epic decomposed into features, or how a story decomposed into tasks. Plans become "amazing docs that get hard to track" — and the viewer's stated job is to make the decomposition concrete.

The redesign solves both: a consistent **hero block + detail body** pattern that makes every page open with the page's "answer" (id + title + status + progress + parent chain + decomposition counts), with an optional **tree view** for users who want to see the whole subtree at once.

The visual treatment is calmer than today: one neutral surface with elevation via shadow + border (not background variation), one brand accent used sparingly, desaturated status colors, lifted typography, tabular-figure mono for IDs.

## Audience

The viewer serves two audiences with the same need:

- **Future agents** who land on a page and need to instantly orient — what is this, where does it fit, what's it supposed to do.
- **The user** who wants progress visibility beyond `git log` — what's done, what's in flight, what's next.

Both want hierarchy + progress + document links visible at every level.

## Design principles

1. **Hierarchy is always visible** — breadcrumbs (parent chain) and decomposition (children + their counts) on every page.
2. **Progress is structural, not decorative** — every container item shows its descendant completion as a calm one-line bar plus a precise count ("0 of 2 done · 1 in progress").
3. **Plans, specs, and changelogs are first-class** — when an item has an attached document, it's a primary affordance in a Documents card, not buried in a tab.
4. **Calm density** — show a lot, but organized into clear blocks with breathing room. The hermes-agent.nousresearch.com aesthetic (airy, sophisticated, designed) applied to data.

## Design tokens

These replace / augment the tokens from Plan 16. Updated tokens go into `tailwind.config.js` + `styles.css`.

### Surfaces

| Token | Value | Use |
|---|---|---|
| `surface-0` | `#0c0c0e` | Page background |
| `surface-1` | `#131318` | Card surface (single neutral; elevation via shadow + inset highlight, not bg variation) |
| `border-subtle` | `rgba(255,255,255,0.06)` | Card outlines, row dividers |
| `border-default` | `rgba(255,255,255,0.10)` | Buttons, inputs |
| `border-strong` | `rgba(255,255,255,0.16)` | Hover states, emphasized borders |

Elevation is implemented as `box-shadow: 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.3);` — a subtle inset highlight at the top edge plus a soft drop shadow. No multiple-surface-color stacks.

### Brand accent

ONE accent, used SPARINGLY — only by primary CTAs, no other element.

| Token | Value | Notes |
|---|---|---|
| `accent` | `#5eead4` (teal-300) | Distinct from `status-done` emerald so the brand doesn't double as a status |
| `accent-fg` | `#042f2e` | Dark text on the accent button |
| `accent-soft` | `rgba(94, 234, 212, 0.10)` | Subtle background tint where needed |
| `accent-ring` | `rgba(94, 234, 212, 0.25)` | Focus rings |

### Text scale

Strict 4-level hierarchy. No ad-hoc grays.

| Token | Value | Use |
|---|---|---|
| `text-primary` | `#f4f4f5` | Headings, primary content |
| `text-secondary` | `#a1a1aa` | Body copy, descriptions |
| `text-tertiary` | `#71717a` | Labels, metadata, IDs |
| `text-quaternary` | `#52525b` | Inactive elements, separators |

### Status palette (refined)

Slightly desaturated from Plan 16 — calmer, less neon. Used ONLY by `StatusBadge` and the kanban column-header borders.

| Token | Value (was) | Notes |
|---|---|---|
| `status-backlog` | `#a1a1aa` (was `#9ca3af`) | grey, slight nudge |
| `status-ready` | `#93c5fd` (was `#60a5fa`) | softer blue |
| `status-in_progress` | `#fcd34d` (was `#fbbf24`) | softer amber |
| `status-blocked` | `#fca5a5` (was `#f87171`) | softer red |
| `status-review` | `#c4b5fd` (was `#a78bfa`) | softer purple |
| `status-done` | `#6ee7b7` (was `#34d399`) | softer green; distinct from accent |
| `status-cancelled` | `#52525b` (unchanged) | dim |

### Typography

| Element | Size / weight | Notes |
|---|---|---|
| Page h1 | 32px / 600 / -0.025em | Lifted from current 24px |
| Section h2 (in card body) | 18px / 600 | New — for sub-headings within section bodies |
| Section label (`.section-label`) | 11px / 700 / uppercase / 0.08em tracking | Replaces ad-hoc `text-xs font-bold uppercase tracking-wider` |
| Body | 14.5px / 1.65 line-height | Lifted from current 14px |
| Small / metadata | 12.5px | Crumbs, timestamps |
| Mono (IDs, SHAs, paths) | JetBrains Mono / `font-variant-numeric: tabular-nums` | New — IDs and dates need tabular figures so they align |

Font stack: `'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif`. Inter is loaded by adding `@fontsource/inter` (variable weights) as a runtime dep and importing the relevant weights in `src/web/frontend/src/main.tsx`. If the import fails or the user blocks fonts, the system stack falls back to native sans-serif.

Mono font: `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`, loaded via `@fontsource/jetbrains-mono` the same way. Used for IDs, SHAs, file paths, and timestamps.

### Spacing

Use Tailwind's default 4px scale. Conventions:
- Card padding: `p-6` (24px) standard, `px-7 py-8` (28px / 32px) for hero blocks
- Section spacing: `gap-6` (24px) between cards
- Page padding: `px-12 py-7` (48px / 28px) on the page body container

### Border radius

| Element | Radius |
|---|---|
| Cards | `rounded-xl` (12px) |
| Hero block | `rounded-2xl` (14px) |
| Buttons | `rounded-lg` (8px) |
| Badges | `rounded` (5px) |
| Inputs | `rounded-lg` (8px) |
| ID pills | `rounded` (4px) |

## Page-level pattern (Mode A — Detail)

Every detail-style page (Epic, Feature, Story) follows the same structure:

```
[Topbar — unchanged in concept; refined visuals]
  Brand    Activity Compare    [search]                Picked: STORY-001
─────────────────────────────────────────────────────────────────────────
  [Body, max-width: 1200px, generous side padding]

  Breadcrumb: All epics › EPIC-001 · Authentication › FEAT-001 · Email login › STORY-001

  ┌─────────────────────────────────────────────────────────────────────┐
  │ HERO BLOCK                                                          │
  │ ┌─ id-row (mono pill + kind label) ──────────────────────────────┐ │
  │ │ STORY  STORY-001                                                │ │
  │ ├─────────────────────────────────────────────────────────────────┤ │
  │ │ <h1>Magic link delivery</h1>                                    │ │
  │ │ [in progress] · phase mvp · updated 2h ago                      │ │
  │ │ ─────────────────────────────────────────────────────────────── │ │
  │ │ TASKS  0 of 2 done · 1 in progress                              │ │
  │ │ ▰▱▱▱▱▱▱▱▱▱  (progress bar)                                       │ │
  │ └─────────────────────────────────────────────────────────────────┘ │
  │                                ┌─ Actions (right column) ─────────┐ │
  │                                │ [ Mark for review ] (primary)    │ │
  │                                │ [ Block ] [ Unpick ]             │ │
  │                                │                                  │ │
  │                                │ View: [Detail] [ Tree ]          │ │
  │                                └──────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─ 2-column grid (2fr / 1fr) ─────────────────────────────────────────┐
  │  LEFT COLUMN (primary content)           RIGHT COLUMN (context)     │
  │  ┌────────────────────────────────┐      ┌─────────────────────────┐│
  │  │ Description                    │      │ Documents               ││
  │  │  ─ acceptance criteria         │      │  spec.md          Open ›││
  │  │  ─ body                        │      │  plan.md          Open ›││
  │  └────────────────────────────────┘      │  changelog.md     Open ›││
  │  ┌────────────────────────────────┐      └─────────────────────────┘│
  │  │ Tasks  0/2 done   + Add task   │      ┌─────────────────────────┐│
  │  │  ▢ TASK-001  …    [in progress]│      │ Recent activity         ││
  │  │  ▢ TASK-002  …    [ready]      │      │  2h ago  write  …       ││
  │  └────────────────────────────────┘      │  3h ago  commit f2c1a09 ││
  │                                          │  yesterday note …       ││
  │                                          └─────────────────────────┘│
  └─────────────────────────────────────────────────────────────────────┘
```

### Per-page content adaptations

The pattern is the same; what fills each section adapts to the page's kind.

#### Story page (the canonical example, mocked above)

- **Left column:** Description card (body + acceptance criteria), Tasks card (decomposition with status)
- **Right column:** Documents card (spec / plan / changelog with sub-line metadata), Recent activity card (5 most recent changelog entries with kind badges)
- **Hero progress bar:** task completion (`X of Y tasks done`)
- **Primary action:** "Mark for review" (or "Mark done" depending on transition rules)

#### Feature page

- **Left column:** Description card, **Stories** card with each story as a row (id, title, status badge) — replaces the current full kanban as the default view
- **Right column:** Documents card (spec only — features don't have plans), Recent activity card (across all child stories)
- **Hero progress bar:** story completion (`X of Y stories done · N in progress`)
- **Primary action:** "Mark in progress" / "Mark done" depending on current state
- **Mode B for this page** is the existing kanban (drag-drop status changes) — accessed via the View toggle

#### Epic page

- **Left column:** Description card, **Features** card with each feature as a row (id, title, status badge, story-count summary)
- **Right column:** Documents card (spec only), Recent activity card (across all descendant stories)
- **Hero progress bar:** feature completion (`X of Y features done`); secondary line: rolled-up story count across all features
- **Primary action:** typically "Mark in progress" — epics rarely change status often

#### Home (`/`) — special case

Home doesn't have a single "item" so there's no hero block in the per-item sense. Instead:

```
[Topbar]
  Breadcrumb: (none — this is the root)
  ┌─ HOME HERO ───────────────────────────────────────────────────────┐
  │ <h1>Project</h1>                                                   │
  │ Subtitle: from .kadai/README.md product description                │
  │ ─────────────────────────────────────────────────────────────────  │
  │ EPICS · FEATURES · STORIES · TASKS  (4-column count summary)       │
  │ Phase pills (mvp · v1 · future · parking-lot) with item counts     │
  └────────────────────────────────────────────────────────────────────┘
  
  Per phase: a section with epics laid out as cards (current EpicCard,
  refined to match the new tokens — id pill, status badge, story count).
```

#### Search / Activity / Compare / Projects

These keep their current layouts but adopt:
- The refined topbar
- The refined design tokens (surfaces, type, spacing)
- The refined StatusBadge / KindIcon styling

No structural redesign.

## Mode B (Tree view)

A toggle in the hero block top-right lets users switch the **detail body** (not the hero) into a tree view of the item + its descendants:

```
EPIC-001  Authentication                    [in progress]   3 of 12 stories done
├─ FEAT-001  Email login                    [in progress]   1 of 3 stories done
│  ├─ STORY-001  Magic link delivery        [in progress]   ← you are here
│  │  ├─ TASK-001  Wire up SES path         [in progress]
│  │  └─ TASK-002  Add expiration check     [ready]
│  ├─ STORY-002  Password reset             [ready]
│  └─ STORY-003  Token rotation             [backlog]
└─ FEAT-002  OAuth                          [backlog]       0 of 4 stories done
```

- Reachable from any of Epic / Feature / Story page (per-item toggle, not global mode)
- The current item is highlighted (`← you are here` marker, distinct background)
- Lines use `box-drawing` characters or CSS borders for the tree
- Click on any node navigates to that item's page
- This is implemented as ONE shared `<TreeView itemId={...}>` component used by all three page types

The tree is the answer to "I lost the plot — show me everything in this subtree at once."

## Component inventory

### New components

| Component | Purpose |
|---|---|
| `<Hero>` | The reusable hero block. Props: `kind`, `id`, `title`, `status`, `phase?`, `breadcrumb?`, `progress?`, `actions`, `viewToggle?` |
| `<Card>` | The single-surface card primitive. Props: `title`, `count?`, `headerAction?`, `children` |
| `<TreeView>` | Mode B — recursive tree of an item + descendants. Props: `rootId`, `currentId` |
| `<Breadcrumb>` | Parent chain. Props: `items: { id, label, href }[]`, `current` |
| `<ProgressBar>` | One-line bar with done + in_progress fills. Props: `done`, `inProgress`, `total` |
| `<IdPill>` | Mono ID with subtle pill background. Props: `id` |
| `<DocumentRow>` | Row in the Documents card. Props: `kind: 'spec' \| 'plan' \| 'changelog'`, `attached: boolean`, `meta?: string`, `onClick?` |

### Updated components (refined to new tokens)

- `Layout.tsx` — refined topbar (brand mark, calmer picked pill, picker spacing)
- `StatusBadge.tsx` — desaturated colors, dot indicator, tighter padding
- `KindIcon.tsx` — keep as-is, refined per usage
- `EmptyState.tsx` — keep structure, refine spacing + type
- `Skeleton.tsx` — keep as-is
- `EpicCard.tsx` — refactor to use new tokens + `IdPill`
- `KanbanBoard.tsx` — refined column-header borders, calmer cards (only used in Mode B for Feature)

### Removed concerns

- The current Story page tabs (`story / spec / plan / changelog / tasks`) are replaced by the 2-column body. No tabs in Mode A.
- The phase pills in the topbar (currently right-aligned) move to the **Home page hero only** — they were noise on every page.

## What changes vs. what doesn't

### Visual changes

- All design tokens (surfaces, accent, status palette, type scale)
- `Layout.tsx` topbar
- `Story.tsx`, `Feature.tsx`, `Epic.tsx`, `Home.tsx` page structure
- New components per inventory above

### NOT changing

- All app behavior (routing, data loading, API contracts, hooks, SSE)
- All non-page test assertions (any test that asserts on data, status logic, etc.)
- `Search.tsx`, `Activity.tsx`, `Compare.tsx`, `Projects.tsx` page structures (only token / topbar polish)
- Multi-project mode logic
- Plugin / CLI surface

Some Playwright tests may need selector updates if they assert on tab text (`button { hasText: 'spec' }`) since the tabs are removed in favor of the Documents card. Acceptable scope for the implementation plan.

## Out of scope

- Light theme — dark only.
- Mobile redesign — viewer stays desktop-first (`max-width: 1200px` body works at desktop sizes).
- Logo / favicon work beyond the small "k" mark in the topbar.
- Animations beyond Tailwind transitions (no Framer Motion, no spring physics).
- Component-library extraction — components live in `src/web/frontend/src/components/`.
- A complete design-system documentation site / Storybook.
- Any new product feature.

## Acceptance criteria

This redesign ships when:

1. `bun run build:web && bun run embed-assets` succeeds.
2. `bun test` passes (unit tests unaffected by visual changes).
3. `bunx playwright test` passes — selector updates allowed for removed tabs but no regressions.
4. The 4 redesigned pages (Story, Feature, Epic, Home) all open with a clear visual hero answering "what is this and where does it stand."
5. The Mode B tree view is reachable from each detail page and renders the item's subtree with status indicators.
6. The breadcrumb shows the parent chain on every detail page.
7. The brand accent (teal-300) appears in at most ONE place per visible page (the primary CTA).
8. No element other than `StatusBadge` and the kanban column-borders uses status colors.

## Implementation notes for the planning phase

- The work is one cohesive plan; no sub-decomposition needed.
- Suggested task ordering:
  1. **Tokens + new components** — Hero, Card, TreeView, Breadcrumb, ProgressBar, IdPill, DocumentRow + all visual updates to existing components in one pass
  2. **Story page rebuild** — apply the pattern (most complex page, biggest test of the system)
  3. **Feature page rebuild** — including Mode B = existing kanban
  4. **Epic page rebuild**
  5. **Home page rebuild** + topbar refresh
  6. **Search / Activity / Compare / Projects** — token-only polish pass
  7. **TreeView component finishing** + wire to all 3 detail pages
  8. **Playwright selector updates + dogfood + plugin v1.3.0**

- The tabs-to-cards transition on the Story page may break Playwright tests asserting on tab buttons; expect ~3-4 selector updates.

## References

- Companion mockups (persisted): `.superpowers/brainstorm/545722-1778075306/content/story-page-v1.html` (initial), `story-page-v2.html` (approved). These are the source of truth for visual direction.
- Inspiration: hermes-agent.nousresearch.com (airy, designed-feeling, calm density).
- Prior plans: Plans 4 (initial SPA), 7 (interactivity), 16 (consistency pass — to be partially superseded).

---

**Approved:** Brainstormed 2026-05-06 with the v2 mockup as the locked visual direction. Ready for `superpowers:writing-plans` to produce the implementation plan.
