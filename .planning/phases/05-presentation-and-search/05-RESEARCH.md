# Phase 5: Presentation and Search - Research

**Researched:** 2026-03-10
**Domain:** Next.js App Router UI patterns, Supabase PostgreSQL full-text search, dnd-kit drag-and-drop persistence
**Confidence:** HIGH

## Summary

Phase 5 has two distinct technical domains: (1) a presentation mode — a captain-facing full-screen view at `/dashboard/present` with a drag-sortable queue, reviewed-item lifecycle, reference video side panel, and keyboard navigation; and (2) a global search bar with full-text search across four tables. Both features build heavily on existing code patterns already established in Phases 1–4.

The drag-and-drop library (dnd-kit) is already installed and already used in `ArticleEditor.tsx`, so the pattern is proven in this codebase. The queue sort order needs a new database column (`sort_order` on a join/pivot approach or directly on the comment rows) plus a new `is_reviewed`/`reviewed_at` column added to the `comments` table via a migration. Full-text search is best handled through a single PostgreSQL RPC function that uses `UNION ALL` across tables with `websearch_to_tsquery`, returns normalized result rows, and is called via `supabase.rpc()`. No new npm packages are required for either feature.

URL-addressability for the current item uses `useSearchParams` + `router.replace()` (shallow navigation) — the standard Next.js App Router pattern. Scroll preservation on the search results page uses `sessionStorage` to save/restore `scrollY` keyed on `pathname + search`.

**Primary recommendation:** Build the schema migration first (adds `is_reviewed`, `reviewed_at`, `sort_order` to comments), then the RPC search function, then the presentation mode component, then the global search bar. All patterns are proven; no spike or prototype needed.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Presentation Mode Layout**
- Split-pane layout: queue sidebar on the left, video player + item detail on the right
- Items grouped by sailor (collapsible sections), sorted chronologically within each sailor
- Entry via "Present" button in the existing review tab AND a dedicated route (/dashboard/present) that can be bookmarked
- Flagged comments and Q&A posts are visually distinguished with different icons/badges in the queue
- Keyboard shortcuts: arrow keys for prev/next item, R for mark reviewed, Escape to exit presentation mode
- Captain can reply to items directly from presentation mode — inline reply field below the current item, triggers notification to the sailor

**Item Lifecycle & Queue**
- "Mark as reviewed" removes the item from the active queue immediately
- Reviewed items accessible via an archived/reviewed view (toggle or tab)
- Items can be restored from the archived view back to the active queue
- Drag-to-reorder persists per session (each weekly session has its own queue order)
- Unreviewed items carry forward when a session closes — consistent with Phase 3 flagged comment carry-forward

**Reference Video Side Panel**
- Slide-out panel from the right side during presentation mode
- Panel shows reference video player + chapter list with seek-to-chapter support (reuses Phase 2/3 chapter UI)
- Captain finds reference videos via folder browser + search/filter field at the top of the panel
- Both practice video and reference video can play simultaneously — captain controls each independently for side-by-side comparison

**Search Experience**
- Global search bar in the top navigation, visible on every page (home and dashboard)
- Available to all users including unauthenticated visitors
- Results displayed grouped by content type: Videos, Comments, Articles, Q&A — each section shows top 3-5 results with "Show more"
- Clicking a result navigates directly to the content (video player, article page, etc.)
- Back button returns to the search page with scroll position preserved
- Comments in results show author, timestamp, and snippet; clicking opens the video at that timestamp

### Claude's Discretion
- URL-addressability of current item in presentation mode (query param approach)
- Search ranking/relevance algorithm (Supabase full-text search vs application-level)
- Search results page route structure
- Drag-to-reorder library choice for queue
- Presentation mode responsive behavior (optimized for big screen but should degrade)
- Loading states, empty states, and error handling throughout
- Keyboard shortcut key bindings beyond the decided arrows/R/Escape

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REV-01 | Captain can view review queue of all flagged comments and Q&A posts | DashboardView already fetches these; presentation mode reuses same data fetch with `is_reviewed=false` filter |
| REV-02 | Captain can filter/group review queue by individual sailor | DashboardView already has `reviewUserFilter` state; presentation mode groups by `author_id` → display name |
| REV-03 | Captain can respond to flagged comments and Q&A items | Reply API (`POST /api/comments`) already exists from Phase 3/4; inline reply field in presentation mode calls it |
| REV-04 | Presentation mode displays review queue on big screen, grouped by person | New `/dashboard/present` route + `PresentationMode.tsx` component; split-pane layout |
| REV-05 | Captain can reorder items in the presentation queue | dnd-kit already installed; `sort_order` column added to comments via migration; PATCH API persists new order |
| REV-06 | Captain can pull up reference videos during presentation mode | Slide-out panel reuses `ReferenceManager` + `VideoWatchView`; both players can run simultaneously |
| REV-07 | Captain can mark review items as "reviewed" to clear from active queue | `is_reviewed` + `reviewed_at` columns on comments; PATCH endpoint; archived toggle in UI |
| CONT-08 | Full-text search across videos, comments, articles, and Q&A | Supabase RPC function with UNION ALL + `websearch_to_tsquery`; `/api/search` route; `/search` page |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 (installed) | Drag context, sensors, collision detection | Already in package.json; used in ArticleEditor |
| @dnd-kit/sortable | ^10.0.0 (installed) | useSortable hook, SortableContext, arrayMove | Already in package.json; vertical list pattern proven |
| @dnd-kit/utilities | ^3.2.2 (installed) | CSS.Transform helper for drag styles | Already in package.json |
| next/navigation | built-in | useSearchParams, useRouter, usePathname | App Router standard; URL state for current item |
| supabase.rpc() | via @supabase/supabase-js ^2.47.10 | Call PostgreSQL search function | Already used; single call replaces N queries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sessionStorage (browser API) | native | Preserve scroll position for search results back-nav | Key: `pathname+search`, value: scrollY |
| lucide-react | ^0.471.0 (installed) | Icons: Presentation, Search, Archive, CheckCircle | Already used throughout |
| clsx | ^2.1.1 (installed) | Conditional class names for queue state (active/reviewed) | Already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase RPC UNION search | Application-level: parallel fetch + merge | RPC is one round-trip, handles ranking server-side; app-level requires 4 fetches, CORS-safe but slower |
| Supabase RPC UNION search | Third-party search (Algolia, Typesense) | Overkill for a ~50-person team; adds cost and external dependency |
| sessionStorage scroll restore | nuqs or next-scroll-restorer | nuqs is great for type-safe params but adds a dependency; sessionStorage + useEffect is 10 lines and zero deps |
| useSearchParams for item URL | Path-based routing `/present/[itemId]` | Query param (`?item=uuid`) avoids new route segment and keeps the layout stable |

**Installation:** No new packages needed. All dependencies are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure
```
app/
├── dashboard/
│   └── present/
│       └── page.tsx              # Server component; reads searchParams prop
├── search/
│   └── page.tsx                  # Public search results page; reads searchParams prop
app/api/
├── comments/[id]/
│   └── route.ts                  # Extend: PATCH adds is_reviewed, sort_order
├── search/
│   └── route.ts                  # GET ?q= calls supabase.rpc('search_all')
components/
├── PresentationMode.tsx          # Main split-pane presentation component
├── PresentationQueue.tsx         # Sortable queue sidebar (dnd-kit)
├── PresentationItem.tsx          # Single item card in queue
├── ReferenceSidePanel.tsx        # Slide-out reference video panel
├── GlobalSearchBar.tsx           # Top-nav search input
├── SearchResults.tsx             # Grouped results display
supabase-migration-phase5.sql     # Adds is_reviewed, reviewed_at, sort_order to comments
```

### Pattern 1: URL-Addressable Current Item
**What:** Store the active item's UUID in a query param so the URL is bookmarkable/shareable.
**When to use:** Any stateful UI where the current selection should survive page reload or be shared as a link.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/use-search-params
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

export function PresentationMode() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeItemId = searchParams.get('item')

  const setActiveItem = useCallback((itemId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('item', itemId)
    // router.replace (not push) so back button doesn't step through every item
    router.replace(pathname + '?' + params.toString())
  }, [router, pathname, searchParams])

  // ...
}
```

**Important:** Wrap any component using `useSearchParams` in a `<Suspense>` boundary — required for static-rendering routes and mandatory for production builds. The `/dashboard/present` page is fully dynamic (captain-only), so this is less critical there, but `/search` is public and statically rendered.

### Pattern 2: dnd-kit Sortable Queue with Database Persistence
**What:** Render queue items in a vertically sortable list; on drag end, optimistically update local state and persist new order to the database.
**When to use:** Any ordered list where user-defined order must survive page reload.
**Example:**
```typescript
// Source: dndkit.com/presets/sortable + existing ArticleEditor.tsx pattern
import { DndContext, closestCenter, PointerSensor, TouchSensor,
         useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy,
         useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// In the queue component:
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
)

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = items.findIndex(i => i.id === active.id)
  const newIndex = items.findIndex(i => i.id === over.id)
  const reordered = arrayMove(items, oldIndex, newIndex)
  setItems(reordered)  // optimistic update

  // Persist: PATCH /api/comments/reorder
  await fetch('/api/comments/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      order: reordered.map((item, idx) => ({ id: item.id, sort_order: idx }))
    })
  })
}
```

**Note on Next.js SSR:** `DndContext` can cause hydration mismatches on SSR. The `PresentationMode` component is captain-only and dynamically rendered, but if issues arise, wrap `DndContext` in a `useIsClient` guard that renders `null` on the server.

### Pattern 3: Supabase RPC Multi-Table Full-Text Search
**What:** Single PostgreSQL function using `UNION ALL` searches four tables, ranks by `ts_rank`, returns uniform result rows. Called from a Next.js API route via `supabase.rpc()`.
**When to use:** Cross-entity search where results from different tables need a unified ranked result set.
**Example SQL:**
```sql
-- Source: Supabase docs https://supabase.com/docs/guides/database/full-text-search
CREATE OR REPLACE FUNCTION search_all(search_query text, result_limit int DEFAULT 20)
RETURNS TABLE(
  id uuid,
  type text,
  title text,
  snippet text,
  url_hint text,
  rank real,
  created_at timestamptz
) AS $$
DECLARE
  q tsquery;
BEGIN
  q := websearch_to_tsquery('english', search_query);
  RETURN QUERY
    -- Session videos
    SELECT sv.id, 'video'::text,
           sv.title,
           left(sv.title, 200),
           sv.session_id::text,
           ts_rank(to_tsvector('english', sv.title), q),
           sv.created_at
    FROM session_videos sv
    WHERE to_tsvector('english', sv.title) @@ q

    UNION ALL

    -- Comments (top-level, not replies)
    SELECT c.id, 'comment'::text,
           u.display_name,
           left(c.comment_text, 200),
           COALESCE(c.video_id::text, c.session_id::text),
           ts_rank(to_tsvector('english', c.comment_text), q),
           c.created_at
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.parent_id IS NULL
      AND to_tsvector('english', c.comment_text) @@ q

    UNION ALL

    -- Articles (published only for unauthenticated; all for auth — filter in app layer)
    SELECT a.id, 'article'::text,
           a.title,
           left(a.title || ' ' || COALESCE(a.blocks::text, ''), 200),
           a.id::text,
           ts_rank(to_tsvector('english', a.title || ' ' || COALESCE(a.blocks::text, '')), q),
           a.created_at
    FROM articles a
    WHERE to_tsvector('english', a.title || ' ' || COALESCE(a.blocks::text, '')) @@ q

    UNION ALL

    -- Q&A posts (comments with no video_id and no parent_id)
    SELECT c.id, 'qa'::text,
           u.display_name,
           left(c.comment_text, 200),
           c.id::text,
           ts_rank(to_tsvector('english', c.comment_text), q),
           c.created_at
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.video_id IS NULL AND c.parent_id IS NULL
      AND to_tsvector('english', c.comment_text) @@ q

    ORDER BY rank DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// In /api/search/route.ts
const { data, error } = await supabase.rpc('search_all', {
  search_query: q,
  result_limit: 40
})
```

**Note on articles JSONB search:** `blocks` is JSONB. `to_tsvector` on `blocks::text` will cast the full JSON as text — it will find words but will include JSON syntax noise. For this team size this is acceptable; a GIN index on extracted text is an optimization for later.

### Pattern 4: Scroll Position Preservation for Search Back-Nav
**What:** Save `window.scrollY` to `sessionStorage` before navigating away from the search results page; restore on re-mount.
**When to use:** Any search/results page where the user drills in and then hits back.
**Example:**
```typescript
// In SearchResults.tsx
const SCROLL_KEY = typeof window !== 'undefined'
  ? `scroll:${window.location.pathname}${window.location.search}` : ''

// Save before navigate
function handleResultClick(url: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
  }
  router.push(url)
}

// Restore on mount
useEffect(() => {
  const saved = sessionStorage.getItem(SCROLL_KEY)
  if (saved) {
    window.scrollTo(0, parseInt(saved, 10))
    sessionStorage.removeItem(SCROLL_KEY)
  }
}, [])
```

### Anti-Patterns to Avoid
- **Fetching search results client-side on every keypress:** Use a debounce (300ms) or navigate to `/search?q=...` on submit — do NOT fire `fetch()` on every character.
- **Storing sort_order as a dense integer sequence and renumbering all rows:** When one item moves, only update the rows between old and new index (use `arrayMove` to compute the new sequence and send the whole reordered array's IDs in one request — bulk update, not N individual PATCHes).
- **Using `router.push` for item navigation in presentation mode:** Use `router.replace` so pressing back exits presentation mode rather than stepping back through every item.
- **Calling `to_tsvector` twice in a query (once in WHERE, once in `ts_rank`):** With small datasets this is fine, but prefer adding a generated `tsvector` column for tables that will grow (session_videos, comments). For this team size, inline `to_tsvector` in the RPC function is acceptable.
- **Playing two YouTube IFrame players simultaneously without independent player references:** The existing `VideoWatchView` manages one `playerRef`. The reference panel needs its own separate player ref — do not share the ref object.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag to reorder | Custom mouse/touch event listeners | dnd-kit (already installed) | Handles pointer/touch unification, keyboard accessibility, overlap detection, React state sync |
| Full-text search ranking | `LIKE '%query%'` or `toLowerCase().includes()` | PostgreSQL `to_tsvector` + `ts_rank` | Handles stemming, stop words, ranking by relevance; LIKE can't rank |
| Type-safe URL param parsing | Manual `searchParams.get()` + cast | `useSearchParams().get()` + explicit null checks | Sufficient for this scope; nuqs adds zero value here |
| Multi-table search merge | 4 parallel fetches + client-side merge | Supabase RPC UNION ALL | One DB round-trip; server handles ranking; avoids N fetch() calls |

**Key insight:** The presentation mode's complexity is in UI state management (which item is active, sidebar open/closed, keyboard shortcuts), not in novel algorithms. All the hard library problems (drag, video playback, folder browser) are already solved in this codebase.

---

## Common Pitfalls

### Pitfall 1: useSearchParams Without Suspense Boundary Breaks Production Build
**What goes wrong:** Component using `useSearchParams` on a statically-renderable page causes build error `Missing Suspense boundary with useSearchParams`.
**Why it happens:** Next.js App Router pre-renders static routes at build time; `useSearchParams` requires client-side hydration, which must be bounded by Suspense.
**How to avoid:** Wrap any component that calls `useSearchParams` in `<Suspense fallback={...}>`. The `/search` page is public and should be wrapped. `/dashboard/present` is captain-only (always dynamic), but still wrap for safety.
**Warning signs:** Build passes in dev (`next dev`) but fails in `next build`.

### Pitfall 2: DndContext Hydration Mismatch on SSR
**What goes wrong:** React throws a hydration error because `DndContext` renders different content server vs client.
**Why it happens:** dnd-kit generates unique IDs for accessibility that differ between SSR and client.
**How to avoid:** `PresentationMode` is a client component behind an auth redirect — it won't SSR in the traditional sense. If warnings appear, add `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` and render `DndContext` only when `mounted`.
**Warning signs:** Console error "Prop `aria-describedby` did not match" or "Text content does not match server-rendered HTML".

### Pitfall 3: Two YouTube Players Sharing a Single Global `onYouTubeReady` Callback
**What goes wrong:** The second player (reference side panel) fails to initialize because `youtube-api.ts` callback queue is exhausted or the second call to `onYouTubeIframeAPIReady` is ignored.
**Why it happens:** The YouTube IFrame API fires `onYouTubeIframeAPIReady` exactly once. The existing `youtube-api.ts` uses a callback queue (`onYouTubeReady()`) to handle late registrations — this pattern already handles multiple players.
**How to avoid:** Use the existing `onYouTubeReady(callback)` from `youtube-api.ts` for both players (practice video in main pane, reference video in side panel). Each player needs its own `playerRef` and its own `divId`. Do not create a second `<YouTubeLoader>` — one global loader is correct.
**Warning signs:** Reference panel video never starts; `window.YT` is undefined in reference panel component.

### Pitfall 4: Sort Order Drift Across Session Carry-Forward
**What goes wrong:** When a session closes and unreviewed items carry forward, the `sort_order` values from the old session collide or become meaningless in the new session context.
**Why it happens:** `sort_order` is a per-session integer, but after carry-forward items get mixed with items from the new session that start at `sort_order = 0`.
**How to avoid:** The carry-forward migration (session close) should reset `sort_order` for carried items to place them at the end of the new session's queue (e.g., `sort_order = MAX(existing) + 1, +2, +3...`). The presentation mode should always sort by `sort_order` within a session context, not globally.
**Warning signs:** Items appear in wrong order after session close; newly submitted items appear buried.

### Pitfall 5: Q&A Posts and Flagged Comments Are the Same DB Table
**What goes wrong:** Presentation mode query fetches comments using two different filter patterns (`send_to_captain=true` with `video_id NOT NULL` for flagged comments; `video_id IS NULL AND parent_id IS NULL` for Q&A). Applying wrong filters shows wrong item type or duplicates.
**Why it happens:** Both item types live in the `comments` table. Flagged comments have `video_id` + `send_to_captain=true`. Q&A posts have `video_id IS NULL` + `parent_id IS NULL` + `send_to_captain=true` (forced server-side in Phase 4).
**How to avoid:** A single queue query should use `send_to_captain=true AND parent_id IS NULL AND is_reviewed=false` to get both types in one pass. Item type is inferred from `video_id IS NULL` (Q&A) vs `video_id IS NOT NULL` (flagged comment). Document this in the API route.
**Warning signs:** Q&A posts missing from presentation queue; items appearing twice (once as Q&A, once as comment).

### Pitfall 6: Search on JSONB `blocks` Column Returns JSON Noise
**What goes wrong:** Article search returns fragments like `"type":"text","content":"` in snippets.
**Why it happens:** `blocks::text` casts the entire JSONB array to a string, including JSON keys and structural syntax.
**How to avoid:** In the snippet, extract only the `content` fields from text blocks using a subquery or application-level post-processing. For ranking, the noise doesn't affect correctness (terms are still found). For display, truncate snippets server-side at 200 chars in the RPC function and strip JSON syntax in the API route before returning to client.
**Warning signs:** Search result previews for articles show `{"type":"text","content":` instead of readable text.

---

## Code Examples

### Schema Migration (Phase 5)
```sql
-- supabase-migration-phase5.sql
-- Add presentation/review fields to comments

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS is_reviewed   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sort_order    INTEGER;

-- Index for fast queue fetch per session
CREATE INDEX IF NOT EXISTS idx_comments_queue
  ON comments(session_id, is_reviewed, sort_order)
  WHERE send_to_captain = true AND parent_id IS NULL;

-- Initialize sort_order for existing flagged comments (per-session sequence)
UPDATE comments
SET sort_order = sub.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) - 1 AS rn
  FROM comments
  WHERE send_to_captain = true AND parent_id IS NULL
) sub
WHERE comments.id = sub.id;
```

### PATCH Endpoint for Mark Reviewed
```typescript
// app/api/comments/[id]/route.ts — extend existing
// PATCH: body can include { is_reviewed: true } or { sort_order: N }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Captain only' }, { status: 403 })
  }
  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.is_reviewed === 'boolean') {
    updates.is_reviewed = body.is_reviewed
    updates.reviewed_at = body.is_reviewed ? new Date().toISOString() : null
  }
  if (typeof body.sort_order === 'number') {
    updates.sort_order = body.sort_order
  }
  const { error } = await supabase
    .from('comments')
    .update(updates)
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### Bulk Reorder Endpoint
```typescript
// app/api/comments/reorder/route.ts (new file)
export async function PATCH(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Captain only' }, { status: 403 })
  }
  const { session_id, order } = await req.json()
  // order: Array<{ id: string; sort_order: number }>
  // Use upsert or loop — supabase-js doesn't support bulk UPDATE directly;
  // use an RPC or individual updates in a Promise.all
  await Promise.all(
    order.map(({ id, sort_order }: { id: string; sort_order: number }) =>
      supabase.from('comments').update({ sort_order }).eq('id', id).eq('session_id', session_id)
    )
  )
  return NextResponse.json({ ok: true })
}
```

### Global Search Bar Component Skeleton
```typescript
// components/GlobalSearchBar.tsx
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function GlobalSearchBar() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search videos, comments, articles..."
        className="pl-9 pr-4 py-1.5 text-sm rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 focus:w-72 transition-all"
      />
    </form>
  )
}
```

### Layout Integration for Global Search Bar
The current `app/layout.tsx` has no nav bar — it just wraps `{children}`. The search bar needs to appear in both the public home page nav and the dashboard nav. Options:
1. Add a shared nav component to `app/layout.tsx` visible on all routes (simplest).
2. Add it per-layout (home has its own top bar; dashboard has its own top bar where `NotificationBell` already lives).

**Recommendation:** Option 2 — keep the search bar in the per-page top bars. The home page (`app/page.tsx`) has a header section; the dashboard has `DashboardView.tsx` with a nav. This avoids a global layout that breaks the current structure. Both placements add the same `GlobalSearchBar` component.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useRouter().push()` for param updates | `useRouter().replace()` for non-history UI state | Next.js 13+ App Router | Back button exits feature rather than stepping through each state change |
| `getStaticProps` + `searchParams` via context | `page.tsx` receives `searchParams` prop directly | Next.js 13 App Router | Server components can read search params from page props |
| `useRouter.push()` + `scroll: false` for shallow nav | `router.replace(pathname + '?' + params)` | Next.js 13+ | Replaces history entry in-place; preserved behavior |
| Separate `tsvector` trigger | Generated column `GENERATED ALWAYS AS ... STORED` | PostgreSQL 12+ | Auto-maintained; no trigger code; faster reads |

**Deprecated/outdated:**
- `export const dynamic = 'force-dynamic'` on a page to force dynamic rendering: replaced by `import { connection } from 'next/server'; await connection()` in a server component. Both work but the latter is the current recommended pattern (as of Next.js 15).
- React Sortable HOC: superseded by dnd-kit which is already used in this project.

---

## Open Questions

1. **Article draft visibility in search**
   - What we know: Articles with `is_published=false` are visible to authenticated users in the article editor. The search API route (`/api/search`) can check auth.
   - What's unclear: Should unauthenticated search results include draft articles? The CONTEXT.md says search is available to all users.
   - Recommendation: Filter by `is_published=true` in the RPC function (simplest, consistent with article public visibility rules). Authenticated users who want to find their drafts use the article editor's existing search/filter.

2. **Q&A items in presentation queue: which session do they belong to?**
   - What we know: Q&A posts have `session_id` set to the active session at time of creation (Phase 4 behavior). The queue is filtered per session.
   - What's unclear: Q&A posts that were created outside a session (if `session_id IS NULL`) won't appear in any session's queue.
   - Recommendation: In the presentation mode data fetch, also fetch Q&A posts where `session_id IS NULL AND send_to_captain=true AND is_reviewed=false` and show them in a separate "General Q&A" group at the bottom of the queue.

3. **Search index performance at current data scale**
   - What we know: Team of ~50 people, weekly sessions. Data volume is small (hundreds of comments, tens of articles, ~50 reference videos, ~100 session videos). PostgreSQL full-text search without GIN indexes will be fast enough for this scale.
   - What's unclear: Whether to add GIN indexes now or defer.
   - Recommendation: Skip GIN indexes for now. Add them in a follow-up migration if search feels slow. Premature optimization for a ~50-person team.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | Queue fetch returns flagged comments + Q&A with `is_reviewed=false` | unit (API route) | `npx vitest run app/api/comments/route.test.ts -t "review queue"` | ❌ Wave 0 |
| REV-03 | PATCH /api/comments/[id] marks item reviewed (captain only) | unit (API route) | `npx vitest run app/api/comments/[id]/route.test.ts -t "is_reviewed"` | ❌ Wave 0 |
| REV-05 | PATCH /api/comments/reorder updates sort_order (captain only) | unit (API route) | `npx vitest run app/api/comments/reorder/route.test.ts` | ❌ Wave 0 |
| CONT-08 | /api/search returns results from all four content types | unit (API route) | `npx vitest run app/api/search/route.test.ts` | ❌ Wave 0 |
| REV-02/04/05/06/07 | Presentation mode renders sailor groups, active item, archived toggle | component test | `npx vitest run components/PresentationMode.test.tsx` | ❌ Wave 0 |
| CONT-08 | Search results grouped by type, clicking result navigates correctly | component test | `npx vitest run components/SearchResults.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/api/comments/reorder/route.test.ts` — covers REV-05
- [ ] `app/api/search/route.test.ts` — covers CONT-08
- [ ] `components/PresentationMode.test.tsx` — covers REV-02/04/06/07
- [ ] `components/SearchResults.test.tsx` — covers CONT-08 UI

Existing test files that will need extensions:
- [ ] `app/api/comments/route.test.ts` — extend to cover `is_reviewed` filter (REV-01)
- [ ] `app/api/comments/[id]/route.test.ts` — does not yet exist; extend or create for REV-03/07

---

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/api-reference/functions/use-search-params` — useSearchParams API, Suspense requirement, router.replace pattern for URL state (fetched 2026-03-10)
- `https://supabase.com/docs/guides/database/full-text-search` — to_tsvector, websearch_to_tsquery, ts_rank, multi-column search (fetched 2026-03-10)
- `https://dndkit.com/presets/sortable` — useSortable, SortableContext, arrayMove, sensor config (fetched 2026-03-10)
- Existing codebase: `components/ArticleEditor.tsx` — proven dnd-kit pattern (DndContext + SortableContext + useSortable + CSS.Transform)
- Existing codebase: `app/api/comments/route.ts` — established Supabase query + auth pattern
- Existing codebase: `supabase-schema-v2.sql` + `supabase-migration-phase4.sql` — confirmed current schema shape

### Secondary (MEDIUM confidence)
- `https://www.postgresql.org/docs/current/textsearch-tables.html` — generated tsvector column approach (PostgreSQL 12+)
- `https://github.com/supabase/supabase/discussions/4565` — community pattern for multi-table UNION search via RPC

### Tertiary (LOW confidence)
- WebSearch findings on scroll restoration: multiple approaches exist; sessionStorage + useEffect pattern recommended as simplest zero-dependency solution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — dnd-kit already in package.json and used; Supabase RPC verified against official docs; Next.js useSearchParams verified against official docs
- Architecture: HIGH — builds directly on existing patterns (ArticleEditor drag, VideoWatchView, DashboardView review tab); new routes follow established project structure
- Pitfalls: HIGH — Suspense/useSearchParams pitfall verified against official Next.js docs; dual YouTube player pitfall confirmed by reading youtube-api.ts; Q&A/comment distinction confirmed by reading Phase 4 schema and API code

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable libraries; Supabase and Next.js APIs are stable)
