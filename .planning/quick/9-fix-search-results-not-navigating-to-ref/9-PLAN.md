---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/page.tsx
  - components/ReferenceManager.tsx
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "Clicking a reference video search result navigates to the Reference tab with that video open"
    - "Clicking a chapter search result navigates to the Reference tab with the parent video open"
    - "Existing deep links (session/video, Q&A) continue to work"
  artifacts:
    - path: "app/page.tsx"
      provides: "Deep-link handling for view=reference&ref=ID"
    - path: "components/ReferenceManager.tsx"
      provides: "Auto-open video by initialVideoId prop"
  key_links:
    - from: "components/SearchResults.tsx"
      to: "app/page.tsx"
      via: "URL params ?view=reference&ref=ID"
      pattern: "view=reference"
    - from: "app/page.tsx"
      to: "components/ReferenceManager.tsx"
      via: "initialVideoId prop"
      pattern: "initialVideoId"
---

<objective>
Fix search results for reference videos and chapters not navigating to the correct content.

Purpose: When a user clicks a reference or chapter search result, the app navigates to `/?view=reference&ref=ID` but the home page deep-link handler only handles `?video&session` and `?view=qa`. The reference tab never opens and the video never auto-plays.

Output: Working deep-link navigation from search results to reference videos and chapters.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/page.tsx
@components/ReferenceManager.tsx
@components/SearchResults.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add reference deep-link handling to home page and ReferenceManager</name>
  <files>app/page.tsx, components/ReferenceManager.tsx</files>
  <action>
**Bug:** The deep-link useEffect in app/page.tsx (around line 98) handles `?video&session` and `?view=qa` but completely ignores `?view=reference` and `?view=learn`. When SearchResults navigates to `/?view=reference&ref=VIDEO_ID`, nothing happens.

**Fix in app/page.tsx:**

1. In the deep-link useEffect (around line 98), add handling for `viewParam === 'reference'`:
   - Set `setMainView('reference')`
   - Read `params.get('ref')` and store it in a new state variable `initialRefId` (type `string | null`, default `null`)
   - Also handle `viewParam === 'learn'` by setting `setMainView('learn')` for completeness

2. Add state: `const [initialRefId, setInitialRefId] = useState<string | null>(null)`

3. Pass `initialVideoId={initialRefId}` prop to the `<ReferenceManager>` component (around line 355-361). Also pass a callback `onInitialVideoHandled={() => setInitialRefId(null)}` so ReferenceManager can clear the state after consuming it.

**Fix in components/ReferenceManager.tsx:**

1. Add `initialVideoId?: string | null` and `onInitialVideoHandled?: () => void` to Props interface.

2. Add a useEffect that watches for `initialVideoId` and the `videos` array. When both `initialVideoId` is set and `videos` is loaded (length > 0):
   - Find the matching video: `videos.find(v => v.id === initialVideoId)`
   - If found, call `setWatchTarget(matchedVideo)` to open the video player
   - Call `onInitialVideoHandled?.()` to clear the prop
   - If not found after videos load, still call `onInitialVideoHandled?.()` to avoid stale state

This approach is clean because:
- SearchResults.tsx already generates the correct URLs (lines 159-164) — no changes needed there
- ReferenceManager already has the watchTarget/setWatchTarget pattern for opening videos
- The initialVideoId prop follows the same pattern as the session/video deep-link (wait for data to load, then open)
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Navigating to /?view=reference&ref=SOME_VIDEO_ID switches to reference tab and opens that video
    - Navigating to /?view=reference (no ref param) switches to reference tab without opening a video
    - Navigating to /?view=learn switches to learn tab
    - Existing ?session&video and ?view=qa deep links still work
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes
2. Manual: search for a reference video, click result, verify reference tab opens with video playing
3. Manual: search for a chapter, click result, verify reference tab opens with parent video playing
</verification>

<success_criteria>
- All search result types (video, reference, chapter, comment, article, qa) navigate correctly from /search
- Reference and chapter results open the Reference tab and auto-play the target video
- No regressions to existing deep-link behavior
</success_criteria>

<output>
After completion, create `.planning/quick/9-fix-search-results-not-navigating-to-ref/9-SUMMARY.md`
</output>
