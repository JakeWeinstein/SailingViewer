---
phase: quick-2
plan: 01
subsystem: presentation
tags: [bugfix, presentation-mode, video-embed]
dependency_graph:
  requires: []
  provides: [presentation-video-embed]
  affects: [components/PresentationMode.tsx]
tech_stack:
  added: []
  patterns: [direct-youtube-id-usage]
key_files:
  modified:
    - components/PresentationMode.tsx
decisions:
  - video_id on comments IS the YouTube video ID -- no lookup or youtube_attachment fallback needed
metrics:
  duration_minutes: 1
  completed: "2026-03-11T18:25:57Z"
---

# Quick Task 2: Fix Presentation View Not Showing Video Summary

**One-liner:** Replaced broken IIFE embed logic with direct video_id usage since video_id IS the YouTube video ID

## What Changed

The presentation mode video embed block incorrectly checked `youtube_attachment` (a Q&A-only field) to render the iframe for video-linked comments. Since `video_id` in comments IS the YouTube video ID (stored from SessionVideo.id), the fix passes it directly to `youtubeEmbedUrl`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix video embed logic in PresentationMode | b4a8bd0 | components/PresentationMode.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors
- Video embed block uses `activeItem.video_id` directly with `youtubeEmbedUrl`
- Q&A `youtube_attachment` embed block remains unchanged (lines 424-435)
- No placeholder "Open in dashboard" text remains for video-linked comments
- Timestamp seeking preserved via `activeItem.timestamp_seconds` parameter
