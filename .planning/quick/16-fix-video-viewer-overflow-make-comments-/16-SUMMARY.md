---
phase: quick-16
plan: 1
subsystem: video-viewer
tags: [ui, layout, overflow, css]
dependency_graph:
  requires: []
  provides: [bounded-modal-height, scrollable-comments]
  affects: [VideoWatchView]
tech_stack:
  added: []
  patterns: [flex-column-height-propagation, min-h-0-flex-shrink]
key_files:
  modified:
    - components/VideoWatchView.tsx
decisions:
  - md:max-h-[90vh] chosen over fixed pixel height for responsive desktop sizing
metrics:
  duration_seconds: 68
  completed: "2026-03-11T23:57:04Z"
---

# Quick Task 16: Fix Video Viewer Overflow / Make Comments Scrollable

**One-liner:** Bounded modal height (90vh) with flex-column overflow chain so comments scroll internally instead of expanding the modal.

## What Changed

Three CSS/structural changes to `VideoWatchView.tsx` that create a proper height constraint chain from viewport to comment thread:

1. **Modal container** (line 648): Added `md:max-h-[90vh]` alongside existing `md:h-auto` so the modal cannot grow beyond 90% of viewport height on desktop.

2. **Expanded comments wrapper** (line 1037): Replaced bare React fragment (`<>...</>`) with a `<div className="flex flex-col overflow-hidden min-h-0 flex-1">`. Fragments don't participate in flex layout, so the overflow constraint was never propagated to children.

3. **Comment thread** (line 1122): Added `min-h-0` to existing `flex-1 overflow-y-auto` classes. Without `min-h-0`, flex items default to `min-height: auto` and refuse to shrink below content size, preventing `overflow-y-auto` from activating.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Constrain modal height and fix comment overflow | f4bdac5 | components/VideoWatchView.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Build succeeds without errors
- Modal container has bounded max-height on desktop (md:max-h-[90vh])
- Comment thread has min-h-0 + overflow-y-auto for internal scrolling
- Fragment replaced with proper flex div wrapper
