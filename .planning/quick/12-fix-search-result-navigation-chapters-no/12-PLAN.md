---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/PresentationMode.tsx
  - components/SearchResults.tsx
  - app/page.tsx
  - components/ReferenceManager.tsx
autonomous: true
requirements: [BUG-CHAPTER-PRESENTATION, BUG-CHAPTER-SEARCH, BUG-COMMENT-DEEPLINK]
must_haves:
  truths:
    - "Clicking a chapter search result in PresentationMode plays the chapter video_ref at its start_seconds"
    - "Clicking a chapter search result on /search navigates to reference view and opens the chapter (not the parent)"
    - "Clicking a comment search result on /search reliably opens the correct video at the correct timestamp even on slow connections"
  artifacts:
    - path: "components/PresentationMode.tsx"
      provides: "Fixed chapter lookup using result.id instead of result.url_hint"
    - path: "components/SearchResults.tsx"
      provides: "Chapter URL includes chapter param"
    - path: "app/page.tsx"
      provides: "Deep-link resolved after sessions load, plus chapter param handling"
    - path: "components/ReferenceManager.tsx"
      provides: "initialChapterId prop support"
  key_links:
    - from: "components/SearchResults.tsx"
      to: "app/page.tsx"
      via: "URL params ?view=reference&ref={parentId}&chapter={chapterId}"
      pattern: "chapter="
    - from: "app/page.tsx"
      to: "components/ReferenceManager.tsx"
      via: "initialChapterId prop"
      pattern: "initialChapterId"
---

<objective>
Fix three search result navigation bugs: (1) chapter results in PresentationMode select the parent video instead of the chapter, (2) chapter results on /search page navigate to parent video without chapter context, (3) comment results on /search page fail when sessions haven't loaded yet due to a 500ms race condition.

Purpose: Search results should reliably navigate to the exact content the user clicked.
Output: Fixed navigation in all three scenarios.
</objective>

<context>
@components/PresentationMode.tsx
@components/SearchResults.tsx
@app/page.tsx
@components/ReferenceManager.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix chapter lookup in PresentationMode and SearchResults URL</name>
  <files>components/PresentationMode.tsx, components/SearchResults.tsx</files>
  <action>
**PresentationMode.tsx (lines 271-289):** In the `handleSearchResultClick` case for `'chapter'`, the current code sets `refId = result.url_hint` which is the parent_video_id UUID. This finds the parent video, not the chapter.

Fix: For chapters, use `result.id` (the chapter's own UUID) to look up in `refVideos`. The chapter record itself has the correct `video_ref` and `start_seconds`.

Replace lines 274-277 with:
```typescript
const refVideo = refVideos.find((v) => v.id === result.id)
```

This finds the chapter directly by its own ID. The chapter's `video_ref` and `start_seconds` are already correctly used on lines 280-283.

**SearchResults.tsx (line 164):** The chapter case currently returns `/?view=reference&ref=${result.url_hint}` which passes the parent_video_id. The ReferenceManager opens the parent but has no chapter context.

Fix: Change the chapter URL to include the chapter ID:
```typescript
case 'chapter':
  return `/?view=reference&ref=${result.url_hint}&chapter=${result.id}`
```

This passes the parent video ID as `ref` (for folder expansion context) AND the chapter ID as `chapter` (for direct chapter opening).
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Chapter search results in PresentationMode find the chapter record (not parent). Chapter URLs on /search include chapter param.</done>
</task>

<task type="auto">
  <name>Task 2: Fix comment deep-link race condition and add chapter param handling</name>
  <files>app/page.tsx, components/ReferenceManager.tsx</files>
  <action>
**app/page.tsx — Fix comment deep-link race (lines 118-136):**

The current code uses `setTimeout(checkAndOpen, 500)` which races with session fetching. If sessions haven't loaded in 500ms, the video is never opened.

Fix: Store the pending deep-link params in a ref, then resolve them when sessions actually load.

1. Add a ref near other state declarations:
```typescript
const pendingDeepLink = useRef<{ sessionId: string; videoId: string; startSeconds?: number } | null>(null)
```

2. In the URL-parsing useEffect (lines 118-136), instead of the setTimeout block, just store the params:
```typescript
if (videoParam && sessionParam) {
  const tParam = params.get('t')
  const startSeconds = tParam ? parseInt(tParam, 10) : undefined
  pendingDeepLink.current = { sessionId: sessionParam, videoId: videoParam, startSeconds }
}
```

3. In the sessions fetch useEffect (around line 144-155), after `setSessions(data)`, resolve the pending deep-link:
```typescript
.then((data) => {
  if (Array.isArray(data)) {
    setSessions(data)
    const active = data.find((s: BrowseSession) => s.is_active)
    if (active) setExpandedSessions(new Set([active.id]))
    // Resolve pending deep-link now that sessions are loaded
    if (pendingDeepLink.current) {
      const { sessionId, videoId, startSeconds } = pendingDeepLink.current
      const targetSession = data.find((s: BrowseSession) => s.id === sessionId)
      if (targetSession) {
        const targetVideo = targetSession.videos.find((v: SessionVideo) => v.id === videoId)
        if (targetVideo) {
          setWatchTarget({ video: targetVideo, sessionId, startSeconds })
        }
      }
      pendingDeepLink.current = null
    }
  }
})
```

**app/page.tsx — Add chapter param handling:**

In the URL-parsing useEffect, within the `viewParam === 'reference'` block (lines 108-113), also read the chapter param:
```typescript
} else if (viewParam === 'reference') {
  setMainView('reference')
  const refParam = params.get('ref')
  const chapterParam = params.get('chapter')
  if (refParam) {
    setInitialRefId(chapterParam || refParam)
  }
}
```

This passes the chapter ID (if present) as the initialRefId, which ReferenceManager already handles via its deep-link useEffect — `videos.find(v => v.id === initialVideoId)` will match the chapter record since chapters are in the same `reference_videos` table.

No changes needed to ReferenceManager.tsx — the existing `initialVideoId` prop and deep-link handler already work for chapters since chapters are stored as `reference_videos` rows. The `videos.find(v => v.id === initialVideoId)` on line 117 will match a chapter record and `setWatchTarget(match)` will open it correctly.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Comment deep-links resolve after sessions load (no race condition). Chapter deep-links from /search open the correct chapter in reference view.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Manual: Search for a chapter name, click result in PresentationMode — should play chapter video at chapter start time (not parent video)
3. Manual: On /search page, click a chapter result — should navigate to reference view and open the chapter video
4. Manual: On /search page, click a comment result — should navigate to correct session video at timestamp (test on slow connection by throttling network)
</verification>

<success_criteria>
- All three bugs fixed: chapter in PresentationMode, chapter on /search, comment deep-link race
- No TypeScript errors
- No regressions in existing search navigation for videos and reference items
</success_criteria>

<output>
After completion, create `.planning/quick/12-fix-search-result-navigation-chapters-no/12-SUMMARY.md`
</output>
