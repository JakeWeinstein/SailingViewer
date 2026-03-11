---
phase: quick-16
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - components/VideoWatchView.tsx
autonomous: true
requirements: [QUICK-16]
must_haves:
  truths:
    - "When many comments exist on a video, the comments section scrolls internally instead of expanding the modal"
    - "The video player aspect ratio is preserved without black space at the bottom"
    - "The modal does not overflow the viewport vertically on desktop or mobile"
  artifacts:
    - path: "components/VideoWatchView.tsx"
      provides: "Bounded-height modal with scrollable comments"
  key_links:
    - from: "outer modal container"
      to: "right panel comment thread"
      via: "flex column with bounded height propagation"
      pattern: "max-h.*overflow"
---

<objective>
Fix the video viewer modal so that when many comments are present, the comments section becomes a scrollable area instead of expanding the modal and creating black space below the video.

Purpose: Comments currently push the modal height beyond the viewport, causing the video embed to stretch with black bars and the page to scroll. The right panel's comment thread already has `overflow-y-auto` but the parent modal has unbounded height (`md:h-auto`), so the overflow never triggers.

Output: A bounded-height modal where the comment thread scrolls internally.
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
  <name>Task 1: Constrain modal height and fix comment overflow</name>
  <files>components/VideoWatchView.tsx</files>
  <action>
The root cause is on line 648: the modal container uses `md:h-auto` which allows unbounded growth. The right panel (line 705) has `flex flex-col overflow-hidden` and the comment thread (line 1122) has `flex-1 overflow-y-auto`, but these only work when the parent has a bounded height.

Changes needed:

1. **Line 648 — outer modal container**: Change `md:h-auto` to `md:max-h-[90vh]`. Keep `h-full` for mobile (fills screen). The full class should be:
   `relative w-full h-full md:h-auto md:max-h-[90vh] max-w-7xl bg-white md:rounded-2xl shadow-2xl flex flex-col sm:flex-row overflow-hidden`

2. **Line 1036 — expanded comments wrapper**: The expanded comments state renders with a React fragment (`<>...</>`). This breaks the flex column flow because fragments don't participate in flex layout. Replace the fragment with a `div` that has `flex flex-col overflow-hidden min-h-0 flex-1` so it becomes a proper flex child that constrains the comment thread inside it.

   Change `<>` (line 1036) to:
   `<div className="flex flex-col overflow-hidden min-h-0 flex-1">`

   Change `</>` (line 1318) to:
   `</div>`

3. **Line 1122 — comment thread div**: It already has `flex-1 overflow-y-auto` which is correct. Verify it also has `min-h-0` to prevent flex items from refusing to shrink below content size. Update to:
   `<div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">`

These three changes together create a proper height constraint chain: viewport -> modal (max-h-[90vh]) -> right panel (flex-col overflow-hidden) -> expanded comments wrapper (flex-col overflow-hidden min-h-0 flex-1) -> thread (flex-1 min-h-0 overflow-y-auto).

Do NOT change the mobile layout (h-full on mobile is correct for fullscreen). Do NOT change the left video panel width or aspect-video classes.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - Modal has max-h-[90vh] on desktop preventing viewport overflow
    - Expanded comments wrapper is a div with flex-col overflow-hidden instead of a fragment
    - Comment thread has min-h-0 to allow flex shrinking
    - When comments overflow the available space, the thread scrolls internally
    - Video player maintains correct aspect ratio without extra black space
  </done>
</task>

</tasks>

<verification>
- Build succeeds without errors
- Modal container has bounded max-height on desktop
- Comment thread scrolls when content exceeds available space
- Video aspect ratio is preserved (no black bars from modal stretching)
</verification>

<success_criteria>
The video viewer modal stays within the viewport on desktop. When there are more comments than fit in the right panel, the comments section scrolls internally. The video player shows no extra black space below the video content.
</success_criteria>

<output>
After completion, create `.planning/quick/16-fix-video-viewer-overflow-make-comments-/16-SUMMARY.md`
</output>
