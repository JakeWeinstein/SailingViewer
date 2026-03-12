---
phase: quick-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [components/VideoWatchView.tsx]
autonomous: true
requirements: [QUICK-17]
must_haves:
  truths:
    - "Chapters section appears below the video title bar, not in the right panel"
    - "No black space below the title bar in the left column"
    - "Comments remain in the right panel, unaffected"
    - "Add chapter form and edit chapter form work correctly in new position"
  artifacts:
    - path: "components/VideoWatchView.tsx"
      provides: "Restructured layout with chapters below video"
  key_links:
    - from: "left column chapters"
      to: "chapter click handlers"
      via: "handleChapterClick, startEditingChapter unchanged"
      pattern: "handleChapterClick|startEditingChapter"
---

<objective>
Move the chapters section (including chapter list, edit forms, and add-chapter UI) from the top of the right panel to below the video title bar in the left column. Remove bg-black from the full left column so chapters render naturally without black space.

Purpose: Eliminate ugly black space below the title bar when the right panel is taller than the video.
Output: Updated VideoWatchView.tsx with restructured layout.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/VideoWatchView.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Relocate chapters from right panel to left column below title bar</name>
  <files>components/VideoWatchView.tsx</files>
  <action>
In VideoWatchView.tsx, restructure the modal layout:

1. LEFT COLUMN (lines ~658-702): Change `bg-black` on the outer left column div to remove it (or use `bg-gray-50` or `bg-white`). Apply `bg-black` only to the `aspect-video` wrapper div so the video area stays black. The structure should be:
   - `div.w-full.sm:w-[65%].flex.flex-col.shrink-0` (NO bg-black here)
     - `div.bg-black` wrapper around the aspect-video div + player
     - `div.bg-gray-900` title bar (unchanged, lines ~663-701)
     - MOVE the chapters section here (was lines ~708-907 in the right panel)

2. MOVE CHAPTERS: Cut the entire chapters block — both the multi-chapter navigation (lines ~708-848, the `siblingChapters && siblingChapters.length > 1` block) AND the "add first chapter" block (lines ~851-907, the `!siblingChapters || siblingChapters.length <= 1` block) — from the right panel into the left column, immediately after the title bar div.

3. LEFT COLUMN OVERFLOW: Add `overflow-y-auto` to the left column container so if chapters overflow they scroll within the left column. On mobile (no sm: prefix), ensure the left column does not have a fixed height — it should grow naturally. On desktop, the left column should respect the modal max-height and scroll internally.

4. RIGHT PANEL: After removing chapters, the right panel (line ~705) should start directly with the captain notes section (line ~909+) followed by comments. No other changes to the right panel.

5. STYLING ADJUSTMENT: The chapters section currently uses `border-b border-purple-100 bg-purple-50`. This works fine below the gray-900 title bar — keep these styles. The transition from dark title bar to purple-50 chapters to white/gray comments panel will look clean.

Do NOT change any chapter logic, handlers, state, or the captain notes / comments sections. This is purely a layout restructure — moving JSX blocks and adjusting container classes.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>Chapters render below the video title bar in the left column. No black space below the title bar. Right panel contains only captain notes and comments. Build succeeds with no errors.</done>
</task>

</tasks>

<verification>
- Open a video with chapters: chapters appear below the title bar in the left column
- No black space visible below the title bar
- Right panel shows only captain notes and comments
- Chapter clicking, editing, and adding still work
- Mobile layout stacks naturally (video + chapters on top, comments below)
</verification>

<success_criteria>
- Chapters section is visually below the video player and title bar
- No black gap between title bar and bottom of left column
- All chapter interactions (click to seek, edit, add) function correctly
- Comments remain fully functional in the right panel
- Build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/17-move-chapters-below-video-player-to-elim/17-SUMMARY.md`
</output>
