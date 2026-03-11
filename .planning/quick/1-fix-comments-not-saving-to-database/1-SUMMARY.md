---
phase: quick-fix
plan: 01
subsystem: comments
tags: [bug-fix, validation, zod]
dependency_graph:
  requires: []
  provides: [working-comment-submission]
  affects: [comments-api, video-watch-view]
tech_stack:
  added: []
  patterns: [zod-string-min-validation]
key_files:
  created: []
  modified:
    - lib/schemas/comments.ts
    - components/VideoWatchView.tsx
decisions:
  - "video_id validated as min(1) string instead of uuid — YouTube IDs are 11-char alphanumeric, DB column is TEXT"
  - "CommentQuerySchema videoId also fixed (same root cause) — prevents query failures for YouTube video comments"
metrics:
  duration_minutes: 1
  completed: "2026-03-11T18:19:05Z"
---

# Quick Fix Plan 1: Fix Comments Not Saving to Database Summary

Relaxed Zod video_id validation from uuid() to min(1) in both CreateCommentSchema and CommentQuerySchema; added error logging on failed comment POST.

## What Was Done

### Task 1: Fix video_id validation in CreateCommentSchema and add client error feedback

**Commit:** 9755c6f

**Changes:**

1. **lib/schemas/comments.ts** -- Changed `video_id` in `CreateCommentSchema` from `z.string().uuid().optional()` to `z.string().min(1).optional()`. YouTube video IDs are 11-character alphanumeric strings, not UUIDs. The database column (`comments.video_id`) is `TEXT`, so any non-empty string is valid.

2. **lib/schemas/comments.ts** -- Also changed `videoId` in `CommentQuerySchema` from `z.string().uuid().optional()` to `z.string().min(1).optional()`. Same root cause: fetching comments by YouTube video ID would also fail Zod validation.

3. **components/VideoWatchView.tsx** -- Added `else` branch in `postComment()` after the `if (res.ok)` block. On failure, it parses the error response and logs to `console.error` with the status code and error body. Prevents silent failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CommentQuerySchema videoId validation**
- **Found during:** Task 1
- **Issue:** `CommentQuerySchema` also defined `videoId` as `z.string().uuid()`, which would reject YouTube video IDs when fetching comments via GET /api/comments
- **Fix:** Changed to `z.string().min(1).optional()` (same fix as CreateCommentSchema)
- **Files modified:** lib/schemas/comments.ts
- **Commit:** 9755c6f

## Verification

- TypeScript compilation (`npx tsc --noEmit`) passes with zero errors
- Manual verification: comment submission should now succeed for YouTube video IDs

## Self-Check: PASSED

- [x] lib/schemas/comments.ts modified (video_id and videoId both updated)
- [x] components/VideoWatchView.tsx modified (error logging added)
- [x] Commit 9755c6f exists
