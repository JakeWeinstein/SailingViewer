---
phase: quick-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/schemas/comments.ts
  - components/VideoWatchView.tsx
autonomous: true
must_haves:
  truths:
    - "Comments submitted on session videos are saved to the database"
    - "User sees error feedback when comment submission fails"
  artifacts:
    - path: "lib/schemas/comments.ts"
      provides: "Zod schema that accepts YouTube video IDs (not just UUIDs)"
    - path: "components/VideoWatchView.tsx"
      provides: "Error handling on failed comment POST"
  key_links:
    - from: "components/VideoWatchView.tsx"
      to: "/api/comments"
      via: "fetch POST in postComment()"
      pattern: "fetch.*api/comments.*POST"
    - from: "app/api/comments/route.ts"
      to: "lib/schemas/comments.ts"
      via: "CreateCommentSchema.safeParse"
      pattern: "CreateCommentSchema\\.safeParse"
---

<objective>
Fix comments not saving to the database.

Purpose: The Zod validation schema for `CreateCommentSchema` defines `video_id` as `z.string().uuid()`, but the actual video IDs passed from the client are YouTube video IDs (11-character alphanumeric strings like `dQw4w9WgXcQ`), not UUIDs. This causes `safeParse` to fail, the API returns 400, and the client silently drops the error (no user feedback). The database column `comments.video_id` is `TEXT`, so it accepts any string — the bug is purely in the Zod schema.

Output: Working comment submission for session videos; error feedback on failure.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/schemas/comments.ts
@app/api/comments/route.ts
@components/VideoWatchView.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix video_id validation in CreateCommentSchema and add client error feedback</name>
  <files>lib/schemas/comments.ts, components/VideoWatchView.tsx</files>
  <action>
In `lib/schemas/comments.ts`:
- Change `video_id: z.string().uuid().optional()` to `video_id: z.string().min(1).optional()`. YouTube video IDs are 11-character alphanumeric strings, not UUIDs. The DB column is `TEXT`, so any string is valid. Keep it optional (Q&A posts have no video_id).

In `components/VideoWatchView.tsx`, in the `postComment()` function (around line 454):
- After `if (res.ok)` block, add an `else` branch that logs the error response body to console.error and optionally alerts the user (e.g., set a brief inline error message state). This prevents silent failures. Example:
  ```
  else {
    const err = await res.json().catch(() => ({}))
    console.error('Failed to post comment:', res.status, err)
  }
  ```
- This is minimal — just enough to surface the problem if it recurs.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>CreateCommentSchema accepts YouTube video IDs (non-UUID strings). postComment() logs errors on failure instead of silently dropping them. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes (no type errors)
2. Manual test: open a session video, post a comment, verify it appears and persists on page refresh
</verification>

<success_criteria>
- Comments on session videos are saved to the database (not rejected by Zod validation)
- Failed comment submissions produce a console.error log with the error details
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-comments-not-saving-to-database/1-SUMMARY.md`
</output>
