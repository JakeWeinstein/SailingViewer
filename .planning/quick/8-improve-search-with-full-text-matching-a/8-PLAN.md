---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase-migration-quick8.sql
  - app/api/search/route.ts
  - components/SearchResults.tsx
  - components/GlobalSearchBar.tsx
  - app/search/page.tsx
  - app/page.tsx
autonomous: true
requirements: [SEARCH-IMPROVE]
must_haves:
  truths:
    - "Searching for a reference video title returns it in results"
    - "Searching for a chapter name returns it in results"
    - "Clicking a comment result opens the correct video in the correct session"
    - "The search bar is visible and usable on the /search results page"
    - "The search bar is visible on mobile"
  artifacts:
    - path: "supabase-migration-quick8.sql"
      provides: "Updated search_all RPC with reference_videos and chapters"
    - path: "components/SearchResults.tsx"
      provides: "Fixed result URLs and new result types"
    - path: "app/search/page.tsx"
      provides: "Search bar on results page"
  key_links:
    - from: "supabase-migration-quick8.sql"
      to: "app/api/search/route.ts"
      via: "supabase.rpc('search_all')"
      pattern: "rpc.*search_all"
    - from: "components/SearchResults.tsx"
      to: "app/page.tsx"
      via: "URL params for deep-linking"
      pattern: "session=.*video="
---

<objective>
Improve search to cover all content types (adding reference videos and chapters), fix broken result linking for comments, and make the search bar persistent on the results page and visible on mobile.

Purpose: Current search misses reference library content and chapters entirely, comment results don't deep-link correctly (missing session_id), and the search bar disappears on the results page and on mobile.
Output: Updated search_all RPC, fixed SearchResults navigation, persistent search bar on /search page.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@supabase-migration-phase5.sql (current search_all RPC)
@supabase-schema.sql (reference_videos table with parent_video_id, start_seconds)
@app/api/search/route.ts (search API)
@components/SearchResults.tsx (result display and navigation)
@components/GlobalSearchBar.tsx (search input)
@app/search/page.tsx (search results page)
@app/page.tsx (deep-link handling, lines 97-131)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expand search_all RPC to include reference videos and chapters</name>
  <files>supabase-migration-quick8.sql, components/SearchResults.tsx</files>
  <action>
Create `supabase-migration-quick8.sql` that drops and recreates the `search_all` function with two additional UNION ALL blocks:

**Reference videos block** (type = 'reference'):
- Query `reference_videos` WHERE `parent_video_id IS NULL` (top-level, not chapters)
- Search against `to_tsvector('english', title || ' ' || COALESCE(note, ''))` matching the tsquery
- Return: id, type='reference', title, snippet=LEFT(COALESCE(note, title), 300), url_hint=id::text (the reference video's own ID), rank, created_at

**Chapters block** (type = 'chapter'):
- Query `reference_videos rv` WHERE `parent_video_id IS NOT NULL`
- JOIN `reference_videos parent ON parent.id = rv.parent_video_id` to get parent title
- Search against `to_tsvector('english', rv.title || ' ' || COALESCE(rv.note, ''))` matching tsquery
- Return: id=rv.id, type='chapter', title=rv.title, snippet=parent.title || ' > ' || rv.title (showing hierarchy), url_hint=rv.parent_video_id::text (parent video ID for navigation), rank, created_at

**Also fix comment url_hint**: In the existing comments UNION ALL block, change url_hint from `COALESCE(c.video_id::text, c.session_id::text)` to a subquery that includes BOTH session_id and video_id separated by a pipe: `c.session_id::text || '|' || COALESCE(c.video_id::text, '')`. This gives the frontend both IDs needed for deep-linking.

Keep all existing blocks (video, comment, article, qa) intact aside from the comment url_hint fix. Keep the ORDER BY rank DESC LIMIT result_limit at the end.

**Update SearchResults.tsx**:
- Add 'reference' and 'chapter' to the `SearchResult['type']` union type
- Add to SECTION_ORDER: insert 'reference' after 'video' (so order is: video, reference, comment, article, qa). Do NOT add 'chapter' as its own section -- instead, chapters should appear within the 'reference' section (change the chapter type results to use type='reference' in the SQL, OR merge chapter results into the reference section in the frontend). Simplest approach: in the SQL, use type='reference' for both reference videos and chapters so they appear together. Distinguish them visually: chapters will have a snippet like "Parent > Chapter" format.
- Actually, better approach for clarity: keep them as separate types in SQL but merge in frontend. Add 'chapter' type but DON'T add it to SECTION_ORDER. Instead, in the sections mapping, filter chapters into the reference section: when building sections, combine results where type is 'reference' OR type is 'chapter' under the 'reference' label.
- Add icon mapping: reference uses `BookOpen` (import from lucide-react), chapter uses `BookOpen` too (same section)
- Add SECTION_CONFIG entry for 'reference': label='Reference Library', icon=BookOpen, color=teal (bg-teal-50 text-teal-500)
- Update `getResultUrl` for new types:
  - 'reference': return `/?view=reference&ref=${result.id}` (this won't fully deep-link but navigates to reference tab)
  - 'chapter': return `/?view=reference&ref=${result.url_hint}` (url_hint is parent_video_id)
- Fix 'comment' URL: parse the pipe-separated url_hint (`session_id|video_id`), return `/?session=${sessionId}&video=${videoId}`
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>search_all RPC includes reference videos and chapters; SearchResults handles all 5+ types; comment deep-links include session_id</done>
</task>

<task type="auto">
  <name>Task 2: Add persistent search bar to /search page and show on mobile</name>
  <files>app/search/page.tsx, components/GlobalSearchBar.tsx, app/page.tsx</files>
  <action>
**Update app/search/page.tsx:**
- Import GlobalSearchBar and Suspense
- Add the search bar prominently at the top of the page, above the "Search Results" heading
- Layout: full-width search bar in a sticky header area (sticky top-0 z-10 bg-gray-50 pb-4 pt-6) so it stays visible while scrolling results
- Remove the static "Search Results" h1 (the query context is shown by SearchResults component itself)
- Add a back link: `<Link href="/">` with a left arrow icon and "Back" text, positioned above or beside the search bar

**Update GlobalSearchBar.tsx:**
- Remove the `sm:block` class constraint — the search bar should be visible on all screen sizes
- On the home page, the parent already wraps it with `className="hidden sm:flex"` so it's still hidden on mobile there. But when used standalone on /search page it will be fully visible.
- Actually, looking at home page usage: `<GlobalSearchBar className="hidden sm:flex" />` — the `hidden sm:flex` is passed as className prop and applied via clsx to the form. This means the component itself is fine; the hiding is done at the call site. No changes needed to GlobalSearchBar.tsx.
- BUT: the search bar should also be visible on mobile on the home page. Add a mobile search bar row below the header on home page, OR change the existing usage to remove the `hidden sm:flex` restriction. Better approach: remove `hidden sm:flex` from the GlobalSearchBar usage in page.tsx header, and instead make it responsive inline — on mobile it should take remaining header space. Change className from `"hidden sm:flex"` to just `"flex"`. Adjust the header flex layout so the search bar doesn't crowd the logo on small screens: give it `flex-1 max-w-xs` or similar so it shrinks gracefully.

**Update app/page.tsx (line ~304):**
- Change `<GlobalSearchBar className="hidden sm:flex" />` to `<GlobalSearchBar className="flex flex-1 max-w-[200px] sm:max-w-none" />`
- This makes search visible on mobile but constrains width so it doesn't push other header elements off screen
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Search bar visible on /search page for query refinement; search bar visible on mobile on home page; back navigation from search results page</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Manually test: search for a reference video title -> appears in results under "Reference Library" section
3. Manually test: click a comment search result -> opens correct video in correct session
4. Manually test: /search page shows search bar at top, can refine search without navigating away
5. Manually test: on mobile viewport, search bar visible in home page header
</verification>

<success_criteria>
- search_all RPC returns results from all 6 content sources: session videos, reference videos, chapters, comments, articles, Q&A
- Comment search results deep-link correctly with both session_id and video_id
- /search page has a persistent, functional search bar
- Search bar visible on mobile on home page
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/8-improve-search-with-full-text-matching-a/8-SUMMARY.md`
</output>
