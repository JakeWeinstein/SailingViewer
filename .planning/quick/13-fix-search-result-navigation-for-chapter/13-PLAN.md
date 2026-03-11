---
phase: quick-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/VideoWatchView.tsx
  - components/SearchResults.tsx
  - components/PresentationMode.tsx
  - app/page.tsx
  - supabase-migration-quick13.sql
autonomous: true
requirements: [QUICK-13]
must_haves:
  truths:
    - "Clicking a chapter search result selects that specific chapter in the player, not the first sibling"
    - "Clicking a comment search result on a reference video opens the video player instead of navigating to homepage"
    - "Comment search results with null url_hint do not crash the app"
  artifacts:
    - path: "components/VideoWatchView.tsx"
      provides: "Correct activeChapterIndex initialization by chapter UUID"
      contains: "ch.id === video.id"
    - path: "supabase-migration-quick13.sql"
      provides: "Fixed search_all SQL with COALESCE on session_id"
      contains: "COALESCE(c.session_id::text, '')"
    - path: "components/SearchResults.tsx"
      provides: "Null-safe url_hint handling for comments"
    - path: "app/page.tsx"
      provides: "Fallback WatchTarget for comments without session match"
    - path: "components/PresentationMode.tsx"
      provides: "Null-safe comment handler for presentation search"
  key_links:
    - from: "components/SearchResults.tsx"
      to: "app/page.tsx"
      via: "URL params ?video=X&t=Y for sessionless comments"
      pattern: "video=.*(?!session=)"
    - from: "components/VideoWatchView.tsx"
      to: "siblingChapters prop"
      via: "activeChapterIndex initialization"
      pattern: "ch\\.id === video\\.id"
---

<objective>
Fix three root causes preventing search result navigation from working correctly for chapters and comments. This is the third attempt -- previous quick tasks 10 and 12 missed the actual root causes identified through database inspection.

Purpose: Chapter clicks must select the correct chapter (not always first). Comment clicks on reference videos must open the player (not navigate to homepage with nothing).
Output: Working search-to-video navigation for all result types.
</objective>

<context>
@components/VideoWatchView.tsx (line 104-108: activeChapterIndex init)
@components/SearchResults.tsx (line 154-186: getResultUrl comment handler)
@components/PresentationMode.tsx (line 288-303: comment search handler)
@app/page.tsx (line 99-155: deep-link handling + session resolution)
@supabase-migration-quick8.sql (line 89: broken url_hint concatenation)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix SQL url_hint and chapter index initialization</name>
  <files>supabase-migration-quick13.sql, components/VideoWatchView.tsx</files>
  <action>
1. Create `supabase-migration-quick13.sql` that replaces the `search_all` function. The ONLY change to the function is line 89: replace `c.session_id::text || '|' || COALESCE(c.video_id::text, '')` with `COALESCE(c.session_id::text, '') || '|' || COALESCE(c.video_id::text, '')`. Copy the entire CREATE OR REPLACE FUNCTION from supabase-migration-quick8.sql and apply this single fix. The issue is that PostgreSQL `||` returns NULL when session_id is NULL (which is the case for all reference video comments).

2. In `components/VideoWatchView.tsx` line 106, change the activeChapterIndex initializer from:
   `const idx = siblingChapters.findIndex((ch) => ch.video_ref === effectiveVideoId)`
   to:
   `const idx = siblingChapters.findIndex((ch) => ch.id === video.id)`

   The bug: ALL sibling chapters share the same `video_ref` (the parent YouTube video ID), so findIndex always returns 0. Matching by `ch.id === video.id` (the chapter's UUID) correctly identifies the selected chapter.

   Note: `video` is available as the prop `video: SessionVideo` in the component (destructured at the top of the component from props). The `video.id` for reference videos/chapters is the UUID from the database.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>activeChapterIndex correctly matches by chapter UUID; SQL migration file ready to apply</done>
</task>

<task type="auto">
  <name>Task 2: Fix comment deep-link for reference videos (SearchResults + page.tsx + PresentationMode)</name>
  <files>components/SearchResults.tsx, app/page.tsx, components/PresentationMode.tsx</files>
  <action>
1. In `components/SearchResults.tsx`, function `getResultUrl`, case `'comment'`:
   - Guard against null/undefined url_hint: `const parts = (result.url_hint || '').split('|')`
   - Extract: `const sessionId = parts[0] || ''; const videoId = parts[1] || ''`
   - When sessionId is truthy AND videoId is truthy: use existing `/?session=X&video=Y&t=Z` URL
   - When sessionId is empty but videoId is truthy: generate `/?video=${videoId}` (with optional `&t=Z`) -- this is the reference video comment case
   - Fallback: return '/'

2. In `app/page.tsx`, deep-link useEffect (line 99-130):
   - After handling `viewParam` cases, add handling for `videoParam` WITHOUT `sessionParam`:
     ```
     if (videoParam && !sessionParam) {
       const tParam = params.get('t')
       const startSeconds = tParam ? parseInt(tParam, 10) : undefined
       // Sessionless video (e.g., comment on reference video) — construct minimal WatchTarget
       setWatchTarget({
         video: { id: videoParam, name: 'Video', type: 'youtube' } as SessionVideo,
         sessionId: '',
         startSeconds,
       })
     }
     ```
   - This constructs a minimal WatchTarget directly from the video_id param. VideoWatchView already handles YouTube IDs via the `mediaId` or `video.id` prop path. The `id` here is the YouTube video ID from the comment's video_id field.
   - IMPORTANT: The existing `if (videoParam && sessionParam)` block (line 120-124) must remain unchanged. Only add the new `else if (videoParam && !sessionParam)` after it.

3. In `components/PresentationMode.tsx`, the comment case in `handleSearchResultClick` (line 288-303):
   - Change the url_hint parsing to be null-safe: `const parts = (result.url_hint || '').split('|')`
   - Extract videoId from parts[1]
   - When videoId is empty/falsy, try using `result.id` as a fallback video identifier (the comment's own ID won't help, but at minimum don't crash -- just break without action)
   - Keep the existing behavior when videoId is truthy
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Comment search results with null url_hint handled gracefully; reference video comments open the player via sessionless deep-link; PresentationMode doesn't crash on null url_hint</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `npx tsc --noEmit`
2. SQL migration file exists and contains the COALESCE fix
3. Manual test: search for a chapter name, click result, correct chapter is highlighted in player
4. Manual test: search for a comment on a reference video, click result, video player opens
</verification>

<success_criteria>
- Chapter search results select the correct chapter (not always index 0)
- Comment search results on reference videos navigate to a working video player
- No crashes from null url_hint values
- SQL migration ready to apply to Supabase
</success_criteria>

<output>
After completion, create `.planning/quick/13-fix-search-result-navigation-for-chapter/13-SUMMARY.md`
</output>
