---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/SearchResults.tsx
  - app/page.tsx
autonomous: true
requirements: [QUICK-10]
must_haves:
  truths:
    - "Clicking a comment search result opens the video and seeks to the comment's timestamp"
    - "Comments without timestamps still navigate correctly (no crash or broken URL)"
  artifacts:
    - path: "components/SearchResults.tsx"
      provides: "Comment URL with timestamp parameter"
    - path: "app/page.tsx"
      provides: "Deep-link handler reads t param and passes startSeconds to VideoWatchView"
  key_links:
    - from: "components/SearchResults.tsx"
      to: "app/page.tsx"
      via: "URL query param t={seconds}"
      pattern: "t=\\d+"
    - from: "app/page.tsx"
      to: "components/VideoWatchView.tsx"
      via: "startSeconds prop"
      pattern: "startSeconds"
---

<objective>
Fix search result comment clicks so they navigate to the correct video AND seek to the exact timestamp where the comment was left.

Purpose: Currently clicking a comment search result opens the right video but doesn't jump to the timestamp. The timestamp is available in the search result snippet (formatted as `[M:SS]`) and needs to be parsed into seconds, added to the navigation URL, and consumed by the deep-link handler to pass as `startSeconds` to VideoWatchView.

Output: Comment search results deep-link to exact video timestamp.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/SearchResults.tsx
@app/page.tsx
@components/VideoWatchView.tsx (reference only — has startSeconds prop at line 61)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add timestamp to comment search result URLs</name>
  <files>components/SearchResults.tsx</files>
  <action>
In the `getResultUrl` function, for the `'comment'` case, parse `timestamp_seconds` from the snippet text. The search RPC formats comment snippets as `[M:SS] comment text` when a timestamp exists.

1. Extract timestamp from the snippet prefix: match `^\[(\d+):(\d{2})\]` pattern, convert to total seconds (minutes * 60 + seconds).
2. If a timestamp was parsed, append `&t={seconds}` to the returned URL: `/?session=${sessionId}&video=${videoId}&t=${seconds}`.
3. If no timestamp in snippet, return the URL as-is (current behavior).

The parsing logic already exists partly in the `ResultCard` component (lines 49-53) for display. For the URL, we need the raw seconds value, not the formatted string. Use the same regex match but convert to seconds.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --strict 2>&1 | head -20</automated>
  </verify>
  <done>Comment search result URLs include &t={seconds} parameter when the comment has a timestamp</done>
</task>

<task type="auto">
  <name>Task 2: Handle timestamp deep-link in home page</name>
  <files>app/page.tsx</files>
  <action>
Two changes needed:

1. Extend `WatchTarget` interface to include optional `startSeconds`:
   ```
   interface WatchTarget { video: SessionVideo; sessionId: string; startSeconds?: number }
   ```

2. In the deep-link useEffect (around line 101), read the `t` param from the URL:
   ```
   const tParam = params.get('t')
   const startSeconds = tParam ? parseInt(tParam, 10) : undefined
   ```
   When setting watchTarget on line 126, include startSeconds:
   ```
   setWatchTarget({ video: targetVideo, sessionId: sessionParam, startSeconds })
   ```

3. Where VideoWatchView is rendered (around line 569), pass the startSeconds prop:
   ```
   <VideoWatchView
     video={watchTarget.video}
     sessionId={watchTarget.sessionId}
     startSeconds={watchTarget.startSeconds}
     ...
   />
   ```

VideoWatchView already accepts and handles `startSeconds` (line 61, line 78) — it seeks to that position on player ready. No changes needed in VideoWatchView itself.

Do NOT change any other watchTarget setter calls (lines 254, 464, etc.) — those are for manual clicks and should not include startSeconds.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --strict 2>&1 | head -20</automated>
  </verify>
  <done>Clicking a comment search result with timestamp navigates to the video and the player seeks to the exact timestamp on load</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Manual test: search for a comment that has a timestamp, click it, verify the video opens and seeks to that timestamp
</verification>

<success_criteria>
- Comment search results with timestamps generate URLs containing `&t={seconds}`
- Home page reads `t` param and passes `startSeconds` to VideoWatchView
- VideoWatchView seeks to the correct position on load
- Comments without timestamps still work (no `t` param, no seek)
</success_criteria>

<output>
After completion, create `.planning/quick/10-fix-search-results-not-jumping-to-correc/10-SUMMARY.md`
</output>
