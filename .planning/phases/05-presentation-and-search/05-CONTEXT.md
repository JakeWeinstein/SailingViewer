# Phase 5: Presentation and Search - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The captain can run a theory session on a big screen — walking through flagged comments and Q&A posts grouped by sailor, reordering on the fly, pulling up reference videos in a side panel — and any user can search across the entire platform (videos, comments, articles, Q&A).

</domain>

<decisions>
## Implementation Decisions

### Presentation Mode Layout
- Split-pane layout: queue sidebar on the left, video player + item detail on the right
- Items grouped by sailor (collapsible sections), sorted chronologically within each sailor
- Entry via "Present" button in the existing review tab AND a dedicated route (/dashboard/present) that can be bookmarked
- Flagged comments and Q&A posts are visually distinguished with different icons/badges in the queue
- Keyboard shortcuts: arrow keys for prev/next item, R for mark reviewed, Escape to exit presentation mode
- Captain can reply to items directly from presentation mode — inline reply field below the current item, triggers notification to the sailor

### Item Lifecycle & Queue
- "Mark as reviewed" removes the item from the active queue immediately
- Reviewed items accessible via an archived/reviewed view (toggle or tab)
- Items can be restored from the archived view back to the active queue
- Drag-to-reorder persists per session (each weekly session has its own queue order)
- Unreviewed items carry forward when a session closes — consistent with Phase 3 flagged comment carry-forward

### Reference Video Side Panel
- Slide-out panel from the right side during presentation mode
- Panel shows reference video player + chapter list with seek-to-chapter support (reuses Phase 2/3 chapter UI)
- Captain finds reference videos via folder browser + search/filter field at the top of the panel
- Both practice video and reference video can play simultaneously — captain controls each independently for side-by-side comparison

### Search Experience
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

</decisions>

<specifics>
## Specific Ideas

- Presentation mode is the capstone feature — it's what makes TheoryForm unique. The captain projects this on a big screen during weekly theory sessions and walks through flagged items per sailor.
- Both videos playing simultaneously is intentional — enables real-time comparison of "here's what you did" (practice) vs "here's what it should look like" (reference).
- Search back-button behavior is important: user navigates to a result, hits back, and returns to the exact same place on the search results page (scroll position preserved).
- Q&A posts and flagged comments look different in the queue because they carry different context — comments have video timestamps, Q&A posts may have YouTube attachments but no practice video association.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/DashboardView.tsx`: Existing review tab fetches `captainOnly=true` comments + Q&A, groups by video, filters by author — data fetching logic can be adapted for presentation mode
- `components/VideoWatchView.tsx`: YouTube IFrame API with `getCurrentTime()`, chapter sidebar — reusable for both practice video playback and reference panel
- `components/ReferenceManager.tsx` + `FolderManager.tsx`: Folder hierarchy browser — reusable for reference picker in presentation panel
- `components/ChapterEditor.tsx`: Chapter list with seek-to-timestamp — reusable in reference panel
- `components/NotificationBell.tsx`: Top nav presence already established — search bar can sit alongside
- `lib/comment-utils.ts`: `timeAgo()`, `initials()`, `avatarColor()` — reusable for queue item rendering
- `lib/mention-utils.ts`: @mention parsing — relevant for rendering mentions in queue items

### Established Patterns
- `getTokenPayload(req)` for auth in all API routes
- Supabase queries with `.select()`, `.insert()`, `.update()`
- React `useState`/`useCallback` for local state, no global state library
- Tailwind + clsx for conditional styling
- YouTube IFrame API with `onYouTubeReady()` callback queue

### Integration Points
- New `review_items` or extend comments table: needs `is_reviewed`, `reviewed_at`, `sort_order` fields
- New `/dashboard/present` route for dedicated presentation mode page
- New `/api/search` route for full-text search across multiple tables
- Supabase `to_tsvector`/`to_tsquery` for PostgreSQL full-text search
- Top nav component needs search bar (currently NotificationBell lives in layout)
- Drag-to-reorder needs a library (dnd-kit already used in Phase 3 article editor)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-presentation-and-search*
*Context gathered: 2026-03-10*
