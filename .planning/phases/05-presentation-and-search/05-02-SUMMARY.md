---
phase: 05-presentation-and-search
plan: "02"
subsystem: presentation-mode-ui
tags: [presentation-mode, dnd-kit, keyboard-shortcuts, review-lifecycle, reference-panel, ui]
dependency_graph:
  requires: [05-01-api-backend]
  provides: [presentation-mode-route, review-queue-ui, reference-side-panel]
  affects: [DashboardView]
tech_stack:
  added: []
  patterns: [split-pane-layout, dnd-kit-queue, keyboard-shortcut-guard, url-addressable-state, optimistic-update]
key_files:
  created:
    - app/dashboard/present/page.tsx
    - components/PresentationMode.tsx
    - components/PresentationQueue.tsx
    - components/ReferenceSidePanel.tsx
  modified:
    - components/DashboardView.tsx
    - lib/types.ts
decisions:
  - "Comment type extended with is_reviewed/sort_order/reviewed_at in lib/types.ts — avoids parallel type for same DB shape"
  - "PresentationQueue renders DndContext per author group to allow per-group reorder — flat reorder merged back into full list before PATCH /api/comments/reorder"
  - "ReferenceSidePanel fetches folder/video data on open (not mount) — avoids unnecessary API calls when panel never opened"
  - "Reference player uses own playerRef and unique div ID ref-player-{video.id} — prevents shared YT API state with main practice video player (Research Pitfall 3)"
  - "Keyboard shortcut guard checks event.target tag (INPUT/TEXTAREA) and isContentEditable — prevents accidental mark-reviewed while typing reply"
  - "Video embed in detail pane shows placeholder when youtube_attachment is null — Comment.video_id is session video UUID, not YouTube ID"
metrics:
  duration_minutes: 25
  completed_date: "2026-03-11"
  tasks_completed: 3
  files_changed: 6
---

# Phase 5 Plan 02: Presentation Mode UI Summary

**One-liner:** Split-pane presentation mode at /dashboard/present with dnd-kit queue sidebar grouped by sailor, keyboard navigation (arrows/R/Esc), URL-addressable items, review lifecycle with optimistic updates, inline reply, and sliding reference video panel.

## What Was Built

### Task 1+2: Presentation Mode Page and Layout (`app/dashboard/present/page.tsx`, `components/PresentationMode.tsx`, `components/PresentationQueue.tsx`)

**`app/dashboard/present/page.tsx`** — Server component:
- Reads JWT from cookie, verifies token; redirects non-captain to /dashboard
- Fetches all sessions from Supabase (id, label, is_active, created_at)
- Passes sessions + userName to `<PresentationMode>` wrapped in `<Suspense>`

**`components/PresentationMode.tsx`** — Client component (~270 lines):
- Session picker dropdown (defaults to `?session=` query param or active session)
- Fetches `GET /api/comments?sessionId=X&captainOnly=true` on session change
- Separates active (`is_reviewed=false`) and archived (`is_reviewed=true`) items
- Groups active items by `author_name` alphabetically; sorts within group by `sort_order`
- Active/Archived toggle with badge counts
- Detail pane: author avatar (initials + color), timestamp badge, comment text, YouTube embed (when `youtube_attachment` present), Q&A embed
- **Mark reviewed:** PATCH /api/comments/[id] `{is_reviewed: true}` with optimistic update; auto-selects next item
- **Restore:** PATCH /api/comments/[id] `{is_reviewed: false}` with optimistic revert
- **Inline reply:** POST /api/comments with parent_id; Cmd+Enter shortcut; success indicator
- **URL-addressability:** `useSearchParams` + `router.replace` keeps `?item=uuid` in sync
- **Keyboard shortcuts:** ArrowDown/Up for navigation, R for mark reviewed, Esc to exit — guarded against INPUT/TEXTAREA focus
- Reference panel toggle button in toolbar

**`components/PresentationQueue.tsx`** — Client component (~200 lines):
- `AuthorGroup` component with collapsible state (default expanded)
- `DndContext + closestCenter + PointerSensor (distance:8) + TouchSensor (delay:250, tolerance:5)`
- `SortableContext + verticalListSortingStrategy + useSortable` per item
- `GripVertical` drag handle; item click selects; active item highlighted with blue ring
- MessageSquare icon (flagged comment) vs HelpCircle icon (Q&A); timestamp/Q&A badge
- `arrayMove` on drag end; callback merges per-group reordered items into full list

### Task 3: Reference Side Panel + Present Button (`components/ReferenceSidePanel.tsx`, `components/DashboardView.tsx`)

**`components/ReferenceSidePanel.tsx`** — Client component (~250 lines):
- Fixed-position slide-from-right panel (450px) with dark overlay
- Search input filters folder video list by title (top-level videos only)
- Two-level folder tree with collapsible `FolderSection` components
- Fetches `/api/reference-videos` + `/api/reference-folders` on first open only
- YouTube player: own `playerRef<YTPlayer>` + unique div ID `ref-player-{video.id}` per selected video
- Uses `onYouTubeReady()` callback queue from `lib/youtube-api.ts`
- Chapter list below player: clickable chapters seek reference player via `playerRef.current.seekTo()`
- Player destroyed/recreated when selected video changes

**`components/DashboardView.tsx`** — Present button added:
- Imported `Presentation` icon from lucide-react
- Review tab header refactored to flex row: user filter (conditional) + Present button (captain-only)
- Present button: blue primary, links to `/dashboard/present?session=${selectedSessionId}`

**`lib/types.ts`** — Comment type extended:
- Added `is_reviewed?: boolean`, `reviewed_at?: string | null`, `sort_order?: number | null`

## Test Results

```
Test Files  14 passed | 5 skipped (19)
Tests      142 passed | 30 todo (172)
TypeScript  0 errors
```

12 PresentationMode test stubs (todo) from Phase 5 pre-creation — all in scope as planned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Video embed shows placeholder when youtube_attachment is null**
- **Found during:** Task 1/2 implementation
- **Issue:** `Comment.video_id` is the session video UUID, not a YouTube ID. The Comment type doesn't carry `youtube_video_id` — only `youtube_attachment` (if user attached one to the comment)
- **Fix:** Detail pane shows informational placeholder ("Open in dashboard to play alongside this comment") when youtube_attachment is absent; embeds when present. This matches the data model accurately.
- **Files modified:** components/PresentationMode.tsx

### Notes

- The plan referenced embedding videos using the session's `youtube_id` from session_videos. In practice the Comment type only carries `video_id` (UUID) and optionally `youtube_attachment`. Future enhancement: fetch session video details when entering presentation mode to enable full video embed from video_id.

## Self-Check: PASSED

Files confirmed:
- FOUND: `app/dashboard/present/page.tsx`
- FOUND: `components/PresentationMode.tsx`
- FOUND: `components/PresentationQueue.tsx`
- FOUND: `components/ReferenceSidePanel.tsx`

Commits confirmed:
- `a9db586` feat(05-02): presentation mode page, split-pane layout, queue sidebar with dnd-kit
- `629ee50` feat(05-02): reference side panel + Present button in dashboard
