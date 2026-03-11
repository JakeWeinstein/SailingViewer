# Phase 3: Core Content - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Team members can leave timestamped comments on practice videos and flag them for captain review. The captain manages weekly sessions (videos auto-added from YouTube import), and contributors maintain the reference library (folders, tags, chapters) and write block-based articles. Google Sheet import is dropped — YouTube auto-import is the sole import method.

</domain>

<decisions>
## Implementation Decisions

### Comment Experience
- Auto-fill timestamp from YouTube player's current time into comment composer; user can clear or manually edit
- Clicking a comment's timestamp badge seeks the player to that moment
- Single-level threaded replies (no sub-replies) — replies collapse under parent with count badge, tap to expand
- Users can edit and delete their own comments; edited comments show an "edited" indicator
- Poll every 30 seconds for new comments while watching a video; new comments slide in without disrupting scroll
- "Flag for captain review" is a checkbox/toggle in the comment composer (send_to_captain boolean)
- Comments sorted chronologically by post time (oldest first, newest at bottom)

### Session & Import Pipeline
- YouTube auto-import only — Google Sheet import is dropped entirely
- Captain can also manually paste a YouTube video URL to add to the current session
- Sessions are weekly containers: one active session at a time
- Videos are automatically added to the active session when imported (auto-import or manual paste)
- Captain manually closes a session when the weekly review is done; a new session auto-creates for the next week
- Unreviewed flagged comments carry forward to the next session's review queue when a session is closed
- All past sessions remain browsable — current session is prominent, past sessions accessible in a list
- Each video in the session list shows total comment count and flagged-for-review count

### Reference Tags & Chapters
- Freeform tag system with autocomplete suggestions from existing tags — no predefined tag set
- Filter chips at the top of the reference library view; tapping a tag filters across all folders (AND logic for multiple tags)
- Inline chapter adding while watching: "+ Add chapter" button captures current timestamp, user enters title + optional description
- Collaborative chapter permissions: any logged-in user can edit or delete any chapter (trust-based, matches article collaborative model)

### Article Editor (Full Redesign)
- Four block types: Text (markdown), YouTube video embed, Image (URL-based), Timestamped video clip (start/end timestamps)
- Timestamped video clips: embed a specific moment from a video — reader sees it cued to that section
- Drag-to-reorder blocks (needs drag library like dnd-kit or @hello-pangea/dnd)
- Text blocks: textarea with live markdown preview (current react-markdown approach, not WYSIWYG)
- Draft/publish visibility: drafts visible to logged-in users, published visible to all logged-in users (per Phase 1 auth decision)

### Claude's Discretion
- Polling implementation details (debouncing, error retry for comment refresh)
- Exact tag autocomplete UI treatment (dropdown vs inline chips)
- Session auto-naming format when auto-created
- Drag-to-reorder library choice (dnd-kit vs @hello-pangea/dnd vs other)
- Article editor layout and block insertion UX
- Video clip block: how start/end timestamps are set (manual entry vs player controls)
- Loading states and error handling throughout

</decisions>

<specifics>
## Specific Ideas

- Sessions are weekly: "everything flagged for review during that week should accumulate for that weekly session, then once that is done, it should progress to the session for the next week"
- Videos should be automatically added to the current session when uploaded/imported
- Unreviewed items carry forward — nothing gets lost between sessions
- Timestamped video clips in articles are powerful for analysis — captain can embed the exact moment being discussed
- Collaborative editing model extends from articles (Phase 1) to chapters — trust-based for ~50-person team

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/comments/route.ts`: GET/POST with threading, reply counts via RPC — needs rewrite to use user accounts instead of author_name, add edit/delete, add Zod validation
- `components/VideoWatchView.tsx`: YouTube IFrame API integration with `getCurrentTime()`, chapter sidebar, comment composer — core of the comment experience
- `lib/comment-utils.ts`: `timeAgo()`, `initials()`, `avatarColor()` — directly reusable
- `components/ReferenceManager.tsx` + `FolderManager.tsx`: folder hierarchy CRUD — extend with tag filtering
- `components/ArticleEditor.tsx` + `ArticleViewer.tsx`: block editor with text + video blocks — redesign base
- `app/api/import-sheet/route.ts`: Google Sheet CSV parser — will be removed (YouTube auto-import only)

### Established Patterns
- API routes use `getTokenPayload(req)` for auth checks
- Supabase queries with `.select()`, `.insert()`, `.update()` pattern
- Client components with useState/useCallback for local state
- Tailwind + clsx for conditional styling
- YouTube IFrame API with `onYouTubeReady()` callback queue in `youtube-api.ts`

### Integration Points
- `session_videos` table: videos added via YouTube auto-import or manual paste
- `comments` table: needs user_id foreign key (replacing author_name), edit tracking columns
- `reference_videos` table: needs tags column or separate junction table
- New `tags` table or JSONB tags column for freeform tag storage
- YouTube OAuth flow from Phase 2: channel scan creates session_videos in active session
- `app/api/sessions/route.ts`: extend with close/activate lifecycle

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-core-content*
*Context gathered: 2026-03-10*
