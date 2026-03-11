---
phase: quick-11
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - components/PresentationMode.tsx
autonomous: true
requirements: [QUICK-11]
must_haves:
  truths:
    - "User can type a search query in presentation mode without leaving the view"
    - "Search results appear inline showing videos, reference videos, and comments"
    - "Clicking a video/reference result loads that video in the presentation main area"
    - "Clicking a comment result loads the associated video at the comment timestamp"
  artifacts:
    - path: "components/PresentationMode.tsx"
      provides: "Inline search bar and results dropdown in presentation sidebar"
  key_links:
    - from: "components/PresentationMode.tsx"
      to: "/api/search"
      via: "fetch on debounced query input"
      pattern: "fetch.*api/search"
---

<objective>
Add a search bar to the presentation mode sidebar that searches across all content (videos, reference, comments, articles, Q&A) using the existing /api/search endpoint, and navigates to the relevant video within presentation mode when a result is clicked.

Purpose: Captain can quickly find and jump to any video or comment during a presentation session without leaving presentation mode.
Output: Updated PresentationMode.tsx with inline search functionality.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/PresentationMode.tsx
@components/SearchResults.tsx
@components/GlobalSearchBar.tsx
@app/api/search/route.ts
@lib/types.ts

<interfaces>
From components/SearchResults.tsx (SearchResult shape returned by /api/search):
```typescript
interface SearchResult {
  id: string
  type: 'video' | 'comment' | 'article' | 'qa' | 'reference' | 'chapter'
  title: string
  snippet: string
  url_hint: string
  rank: number
  created_at: string
}
```

From components/PresentationMode.tsx (existing state for video selection):
```typescript
interface SelectedBrowseVideo {
  youtubeId: string
  title: string
  source: 'session' | 'reference'
  startSeconds?: number
}
// setSelectedBrowseVideo(video) loads a video in the main area
// setSidebarMode('videos' | 'reference' | 'queue') switches sidebar tabs
```

From lib/types.ts:
```typescript
export function youtubeEmbedUrl(id: string, startSeconds?: number): string
export function youtubeThumbnailUrl(id: string): string
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add inline search to presentation mode sidebar</name>
  <files>components/PresentationMode.tsx</files>
  <action>
Add a search bar to the presentation mode sidebar header area (between the "Presentation" title and the close button, or as a new section below the session picker). Implementation details:

1. **Search input**: Add a search icon + text input styled for the dark theme (bg-gray-800, text-gray-200, placeholder-gray-500, border-gray-700, focus:ring-blue-500). Place it in the sidebar header area near the top. Use the Search icon from lucide-react (already imported).

2. **Search state**: Add state variables:
   - `searchQuery: string` (controlled input)
   - `searchResults: SearchResult[]` (API results)
   - `searchLoading: boolean`
   - `showSearch: boolean` (toggles search overlay mode in sidebar)

3. **Debounced fetch**: When searchQuery changes (and length >= 2), debounce 300ms then fetch `/api/search?q=${encodeURIComponent(query)}&limit=20`. Use a useEffect with setTimeout/clearTimeout pattern (no external debounce library). Clear results when query is empty.

4. **Search results display**: When showSearch is true and results exist, render them in the sidebar content area (replacing/overlaying the queue/videos/reference content). Group results visually by type using the same section approach as SearchResults.tsx but simplified for the dark sidebar:
   - Each result: icon (Film for video, BookOpen for reference/chapter, MessageSquare for comment, FileText for article, HelpCircle for qa) + title + truncated snippet
   - Style: text-gray-200 titles, text-gray-400 snippets, hover:bg-gray-800 rows
   - Show result count at top: "N results" in text-gray-500

5. **Result click handler**: When a result is clicked, map the result to a presentation-mode action:
   - `type === 'video'`: Switch to 'videos' sidebar mode. Ensure fullSessions are fetched. Set selectedBrowseVideo with `{ youtubeId: result.id, title: result.title, source: 'session' }`.
   - `type === 'reference'` or `type === 'chapter'`: Switch to 'reference' sidebar mode. Ensure reference data is fetched. Set selectedBrowseVideo with `{ youtubeId: refVideoRef, title: result.title, source: 'reference' }`. For reference results, look up the video_ref from refVideos by matching result.id. For chapter results, look up via result.url_hint (parent_video_id). If ref data not yet loaded, trigger fetch first then select after load.
   - `type === 'comment'`: Parse url_hint ("session_id|video_id") and snippet timestamp ("[M:SS]" prefix). Switch to 'videos' mode. Set selectedBrowseVideo with `{ youtubeId: videoId, title: result.title, source: 'session', startSeconds: parsedSeconds }`.
   - `type === 'article'`: Open in new tab via `window.open('/learn/' + result.id, '_blank')` (articles don't play in presentation mode).
   - `type === 'qa'`: Ignore or show a small toast "Q&A posts not viewable in presentation mode" — keep it simple, just skip navigation.

6. **Search toggle**: Add a search icon button in the sidebar header (next to the X close button). Clicking it toggles showSearch. When showSearch is true, show the search input and results. When toggled off, clear query and results. Also support Escape key to close search (add to existing keydown handler — if showSearch is true, Escape closes search instead of exiting presentation mode). Add "/" keyboard shortcut to open search (when not in an input/textarea).

7. **Clear on selection**: After clicking a result, clear searchQuery, searchResults, and set showSearch to false so the user returns to normal sidebar view with the video loaded.

SearchResult interface (define at top of file):
```typescript
interface SearchResult {
  id: string
  type: 'video' | 'comment' | 'article' | 'qa' | 'reference' | 'chapter'
  title: string
  snippet: string
  url_hint: string
  rank: number
  created_at: string
}
```
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --pretty 2>&1 | head -40</automated>
  </verify>
  <done>
    - Search bar visible in presentation mode sidebar
    - Typing a query fetches results from /api/search with debouncing
    - Clicking a video result loads that video in the main presentation area
    - Clicking a reference result loads the reference video in presentation
    - Clicking a comment result loads the associated video at the correct timestamp
    - "/" shortcut opens search, Escape closes it
    - Search clears and sidebar returns to normal after selecting a result
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Search bar appears in presentation mode sidebar
- Searching finds videos, reference videos, and comments
- Clicking results navigates to the correct video within presentation mode
</verification>

<success_criteria>
Captain can search for any content from within presentation mode and jump directly to the relevant video without leaving the presentation view.
</success_criteria>

<output>
After completion, create `.planning/quick/11-add-search-bar-to-presentation-view-that/11-SUMMARY.md`
</output>
