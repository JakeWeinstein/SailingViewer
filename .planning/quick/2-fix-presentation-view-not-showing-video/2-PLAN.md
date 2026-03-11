---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/PresentationMode.tsx
autonomous: true
requirements: [QUICK-2]
must_haves:
  truths:
    - "Video embeds display when reviewing a comment linked to a session video in presentation mode"
    - "Q&A youtube_attachment embeds still work correctly"
    - "Timestamp seeking works on embedded videos in presentation mode"
  artifacts:
    - path: "components/PresentationMode.tsx"
      provides: "Corrected video embed logic using video_id as YouTube ID"
  key_links:
    - from: "components/PresentationMode.tsx"
      to: "youtubeEmbedUrl"
      via: "passes video_id directly as YouTube video ID"
      pattern: "youtubeEmbedUrl\\(activeItem\\.video_id"
---

<objective>
Fix presentation view not showing video embeds for comments linked to session videos.

Purpose: The presentation mode shows a placeholder ("Open in dashboard to play alongside this comment") instead of embedding the video because it incorrectly checks `youtube_attachment` (a Q&A-only field) instead of using `video_id` directly. In this codebase, `comment.video_id` IS the YouTube video ID (stored from the JSONB `SessionVideo.id` field), so it can be passed directly to `youtubeEmbedUrl`.

Output: Working video embeds in presentation mode for all video-linked comments.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/PresentationMode.tsx
@lib/types.ts (youtubeEmbedUrl, SessionVideo, Comment types)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix video embed logic in PresentationMode</name>
  <files>components/PresentationMode.tsx</files>
  <action>
Replace the video embed block (lines 412-438) that incorrectly checks `activeItem.youtube_attachment` for video-linked comments. The `video_id` field on a comment IS the YouTube video ID (the legacy JSONB `SessionVideo.id` is the YouTube video ID, confirmed by usage in `app/page.tsx` line 254 and `components/VideoManager.tsx` line 71 where `video.id` is passed to `youtubeThumbnailUrl`).

Change the logic from:
```
const ytId = activeItem.youtube_attachment
if (!ytId) return placeholder
```

To simply use `activeItem.video_id` directly:
```
<div className="rounded-xl overflow-hidden bg-black aspect-video">
  <iframe
    src={youtubeEmbedUrl(activeItem.video_id!, activeItem.timestamp_seconds ?? undefined)}
    className="w-full h-full"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
    title={activeItem.video_title ?? 'Practice video'}
  />
</div>
```

Remove the IIFE pattern — the outer `{activeItem.video_id && ...}` guard already ensures video_id is non-null, so use a simple conditional block with `!` assertion.

Keep the separate Q&A youtube_attachment embed block (lines 441-452) untouched — that handles a different case (Q&A posts with no video_id but with a youtube_attachment).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Presentation mode renders YouTube iframe for video-linked comments using video_id directly. No placeholder shown. Q&A attachment embeds still work separately.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Video embed block uses `activeItem.video_id` directly with `youtubeEmbedUrl`
- Q&A `youtube_attachment` embed block remains unchanged
- No placeholder "Open in dashboard" text remains for video-linked comments
</verification>

<success_criteria>
- Comments with video_id show embedded YouTube player in presentation mode
- Timestamp seeking works via youtubeEmbedUrl start parameter
- Q&A posts with youtube_attachment still show their embedded video
- TypeScript compilation passes
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-presentation-view-not-showing-video/2-SUMMARY.md`
</output>
