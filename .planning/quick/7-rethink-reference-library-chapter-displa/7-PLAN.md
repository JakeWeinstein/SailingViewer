---
phase: quick-7
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - components/ReferenceManager.tsx
autonomous: false
requirements: [QUICK-7]
must_haves:
  truths:
    - "Each source video with chapters shows ONE thumbnail card in the grid, not N+1 cards"
    - "Chapters are accessible via a dropdown/expandable section on the video card"
    - "Clicking a chapter in the dropdown opens VideoWatchView at that chapter"
    - "Standalone videos (no chapters) display as normal single cards unchanged"
    - "All existing functionality preserved: tags, delete, inline chapter add, drag-to-folder"
  artifacts:
    - path: "components/ReferenceManager.tsx"
      provides: "Consolidated VideoCard with chapter dropdown for grouped videos"
  key_links:
    - from: "VideoCard chapter dropdown"
      to: "setWatchTarget(chapter)"
      via: "onClick handler on chapter list items"
      pattern: "setWatchTarget"
---

<objective>
Rethink how the reference library displays videos that have chapters. Currently, a source video and all its chapters each render as separate VideoCard components in the grid, producing redundant thumbnails (all same YouTube video) and cluttering the layout. Change to: one card per source video with a chapter dropdown/expandable list, maintaining the clean grid layout.

Purpose: Reduce visual clutter, make the reference library scannable, and let chapters be discoverable without dominating the grid.
Output: Updated ReferenceManager.tsx with consolidated video+chapter cards.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/ReferenceManager.tsx
@lib/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Consolidate grouped video+chapter cards into single card with chapter dropdown</name>
  <files>components/ReferenceManager.tsx</files>
  <action>
Modify the `VideoGrid` and `VideoCard` components within ReferenceManager.tsx to collapse source+chapter groups into a single card per source video:

1. **Update `VideoGrid`**: For `group` items (source + chapters), render a SINGLE card component instead of source card + N chapter cards in the grid. Standalone videos render as before.

2. **Create/modify `VideoCard` to accept optional `chapters` prop**: When a video has chapters:
   - Render ONE thumbnail (the source video's thumbnail) as normal
   - Below the title area, add an expandable chapter list toggle. Use a ChevronDown icon + "{N} chapters" text as the toggle button. Style it with purple accent (matching existing chapter theming: `text-purple-500`).
   - When expanded, show a compact list of chapters below the card content:
     - Each chapter row: timestamp badge (if start_seconds exists, formatted via `formatTime`) + chapter title
     - Clicking a chapter row calls `setWatchTarget(chapter)` to open that chapter in VideoWatchView
     - Style: `text-xs`, left-aligned, `hover:bg-purple-50`, compact vertical spacing (`py-1 px-3`)
     - Keep the purple left border accent on chapter rows for visual consistency
   - The chapter count badge (Layers icon, top-right of thumbnail) should remain as-is
   - The "Chapters" and "+ Add" buttons should remain on the source card (they already only show for non-chapter videos)

3. **Remove chapter cards from grid entirely**: In `VideoGrid`, for `group` items, only render the source card (with chapters passed as prop). Do NOT render individual `VideoCard` for each chapter anymore. The chapter divider header ("Video Title -- N chapters" with purple lines) is also no longer needed since chapters are inside the card.

4. **Keep tag editor and inline chapter add form on the source card** (not on individual chapters since they no longer have their own cards). Tags on chapter videos are not shown in this view (they can still be managed when viewing the video).

5. **Preserve all existing behavior**: drag-to-folder, delete (captain only), tag editing, inline chapter add form, chapter editor modal launch.

State management for the expanded/collapsed dropdown: Use a local state `expandedChapters` as a `Set<string>` (source video IDs) at the `VideoGrid` level, or simpler: use local `useState<boolean>` inside the card component for the expanded state. The simpler per-card approach is preferred.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>
    - Source videos with chapters show ONE card in the grid with an expandable chapter list
    - Clicking a chapter in the dropdown opens VideoWatchView for that chapter
    - Standalone videos display unchanged
    - No duplicate thumbnails for chapters of the same video
    - All existing functionality (tags, delete, drag, inline chapter add) preserved
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Consolidated reference library display: one card per video with chapter dropdown instead of separate cards for each chapter</what-built>
  <how-to-verify>
    1. Open the reference library (home page Reference tab or dashboard)
    2. Find a video that has chapters
    3. Verify it shows as ONE card with a "N chapters" toggle
    4. Click the toggle — chapters should expand as a compact list with timestamps
    5. Click a chapter — VideoWatchView should open at that chapter
    6. Verify standalone videos (no chapters) look the same as before
    7. Verify the grid layout is cleaner with fewer cards
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles: `npx tsc --noEmit`
- Visual check: reference library shows one card per source video, chapters in dropdown
</verification>

<success_criteria>
- Grid shows one thumbnail per unique video (no duplicate thumbnails for chapters)
- Chapters accessible via expandable dropdown on the source card
- All existing CRUD and navigation functionality preserved
</success_criteria>

<output>
After completion, create `.planning/quick/7-rethink-reference-library-chapter-displa/7-SUMMARY.md`
</output>
