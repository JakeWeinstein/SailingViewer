---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/VideoWatchView.tsx
  - components/PresentationQueue.tsx
autonomous: true
requirements: [BUG-CLOSE-OVERLAP, BUG-SIDEBAR-CONTRAST]
must_haves:
  truths:
    - "Video player close button (X) and comments collapse chevron do not overlap visually"
    - "Presentation sidebar item text is white/light when not highlighted (readable on dark bg)"
    - "Presentation sidebar item text is dark when highlighted (readable on light bg)"
  artifacts:
    - path: "components/VideoWatchView.tsx"
      provides: "Fixed close button positioning to avoid overlap with comments collapse"
    - path: "components/PresentationQueue.tsx"
      provides: "Dynamic text color for sidebar items based on active/inactive state"
  key_links:
    - from: "components/PresentationQueue.tsx"
      to: "components/PresentationMode.tsx"
      via: "dark-themed parent sidebar (bg-gray-900)"
      pattern: "text-gray-(100|200|300|400).*text-gray-(700|800)"
---

<objective>
Fix two UI bugs: (1) the video player close button overlapping with the comments collapse button, and (2) poor text contrast in the presentation view sidebar.

Purpose: Improve usability of the video player modal and presentation review mode.
Output: Two component files with corrected styling.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/VideoWatchView.tsx
@components/PresentationQueue.tsx
@components/PresentationMode.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix close button overlap with comments collapse in VideoWatchView</name>
  <files>components/VideoWatchView.tsx</files>
  <action>
The close button (X) at line ~549 is positioned `absolute top-3 right-3 z-20` on the outer modal container. The comments section collapse/expand chevron (ChevronUp/ChevronDown at lines ~755 and ~781) sits at the top-right of the right panel via `w-full px-4 py-2.5 flex items-center justify-between`. These overlap visually in the top-right corner.

Fix by adding right padding to the collapse button row to avoid the close button area. Specifically:

1. On the collapsed comments bar (line ~740-768, the `<div className="border-b border-gray-100 shrink-0">` wrapper), add `pr-12` to the inner `<button>` element (the one with `w-full px-4 py-3 flex items-center justify-between`) so the chevron clears the close button. Change `px-4` to `pl-4 pr-12`.

2. On the expanded comments header button (line ~771-782, `<button onClick={() => setCommentsExpanded(false)} className="w-full px-4 py-2.5 ..."`), similarly change `px-4` to `pl-4 pr-12` so the ChevronUp icon clears the close button.

This ensures the collapse/expand chevron never sits under the floating close button.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>The comments collapse/expand chevron has enough right padding (pr-12) to clear the absolute-positioned close button. No visual overlap.</done>
</task>

<task type="auto">
  <name>Task 2: Fix presentation sidebar text contrast in PresentationQueue</name>
  <files>components/PresentationQueue.tsx</files>
  <action>
PresentationQueue renders inside PresentationMode's dark sidebar (bg-gray-900), but uses light-theme color classes. The text is nearly invisible on the dark background when items are not selected.

Update SortableItem (line ~57-104):
1. Change the outer div's non-active class from `hover:bg-gray-50` to `hover:bg-gray-800` (dark hover).
2. Change the active class from `bg-blue-50 ring-1 ring-blue-300` to `bg-white ring-1 ring-blue-400` (light background when selected).
3. Change the comment text `<p>` (line ~89) from `text-xs text-gray-700` to use clsx with dynamic color: `text-xs` with `text-gray-900` when isActive (dark text on white bg) and `text-gray-300` when not active (light text on dark bg).
4. Change the timestamp badge (line ~92) from `bg-blue-100 text-blue-700` to dynamic: when isActive keep `bg-blue-100 text-blue-700`, when not active use `bg-blue-900/50 text-blue-300`.
5. Change the Q&A badge (line ~97) from `bg-purple-100 text-purple-700` to dynamic: when isActive keep `bg-purple-100 text-purple-700`, when not active use `bg-purple-900/50 text-purple-300`.
6. Change the drag handle (line ~74) from `text-gray-300 hover:text-gray-500` to `text-gray-600 hover:text-gray-400` (visible on dark bg).
7. Change the type icons: keep colors as-is (blue-400/purple-400 work on both backgrounds).

Update AuthorGroup (line ~140-193):
1. Change the author group button (line ~144) from `hover:bg-gray-50` to `hover:bg-gray-800`.
2. Change the author name span (line ~158) from `text-sm font-semibold text-gray-700` to `text-sm font-semibold text-gray-200`.
3. Change the item count span (line ~159) from `text-xs text-gray-400` — keep as-is, gray-400 is fine on dark.
4. Change the chevron icons (lines ~147-148) — keep `text-gray-400`, fine on dark.

Note: The isActive prop is already available in SortableItem. Use clsx (already imported) for conditional classes.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>Sidebar text is white/light (text-gray-300) when not highlighted for readability on dark background, and dark (text-gray-900) when highlighted on the white/light active background. Author group headers also use light text.</done>
</task>

</tasks>

<verification>
1. Build succeeds without errors
2. Visual check: open a video — close button (X) and comments collapse chevron do not overlap
3. Visual check: open presentation mode — sidebar item text is readable in both active and inactive states
</verification>

<success_criteria>
- No visual overlap between close button and comments collapse/expand control
- Presentation sidebar text has proper contrast: light text on dark bg (inactive), dark text on light bg (active)
- Build passes clean
</success_criteria>

<output>
After completion, create `.planning/quick/4-fix-video-player-close-button-overlap-an/4-SUMMARY.md`
</output>
