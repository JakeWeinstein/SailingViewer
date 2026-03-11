# Phase 4: Engagement - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Team members can ask questions via Q&A posts with optional YouTube attachments, receive in-app notifications when @mentioned or responded to, and bookmark specific video timestamps for personal reference. Q&A posts feed into the captain's review queue alongside flagged comments.

</domain>

<decisions>
## Implementation Decisions

### Q&A Post Format
- Plain text body (no markdown, no rich text) — keep it simple for quick questions
- Optional single YouTube video attachment: user pastes a YouTube URL, renders as embedded player in the post
- No image or external link attachments — YouTube-only matches the all-YouTube content model
- Q&A posts always appear in captain's review queue automatically (no send_to_captain toggle needed — all Q&A is captain-facing by design)
- Q&A tab stays on the home page (alongside Sessions, Reference, Learn) — accessible without entering the dashboard
- Single-level threaded replies on Q&A posts (consistent with comment threading from Phase 3)

### @Mentions
- `@` character triggers a dropdown autocomplete showing team members (display name + username), filtered as you type
- Works in: video comments, Q&A posts/replies, and article text blocks
- Rendered as bold blue text in displayed content (not clickable, just a visual callout)
- No group mentions (@all, @team) — individual mentions only; captain can address the team via Q&A posts
- Server-side: parse `@username` patterns on save, create notification records for mentioned users
- ~50 users so the full user list is manageable in a single dropdown fetch

### Notification System
- Notification triggers: (1) @mention in any context, (2) reply to your comment or Q&A post, (3) captain responds to your flagged item
- NOT a trigger: new Q&A post created (would be noisy for ~50 users)
- Bell icon with red unread count badge in top nav bar (visible on every page) AND in dashboard sidebar
- Clicking bell opens a dropdown panel (not a full page) showing recent notifications
- Each notification links directly to the comment/post that triggered it
- Click a notification to navigate = marks it as read
- "Mark all as read" button at top of dropdown panel
- Notifications stored in database (not ephemeral) — persist across sessions

### Bookmarks
- Bookmark captures: specific timestamp + video reference (no personal note — just the moment)
- Created via a bookmark icon button in the video player controls; one tap captures current playback time via YouTube IFrame API `getCurrentTime()`
- Bookmarks are private — only visible to the user who created them
- Bookmark list accessible from the user's profile page in the dashboard (extend ProfileEditor.tsx)
- Clicking a saved bookmark opens the video and seeks to the bookmarked timestamp

### Claude's Discretion
- Notification dropdown styling, max items shown, empty state
- Bookmark list sorting (chronological vs by video)
- @mention autocomplete debouncing and keyboard navigation
- Notification polling/refresh strategy (poll interval or on-page-load)
- Database schema for notifications and bookmarks tables
- How notification deep-links resolve (URL structure for jumping to a specific comment)
- Q&A YouTube attachment preview/validation before posting

</decisions>

<specifics>
## Specific Ideas

- Q&A posts are inherently captain-facing — they always show in the review queue, no toggle needed. This is the "ask the captain" channel.
- @mentions are the primary way to get someone's attention asynchronously — "look at this moment" in a comment with a timestamp
- Notification bell is always visible (top nav) so users see unread count even when browsing sessions on the home page, plus in dashboard sidebar for when they're managing content

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/QATab.tsx`: Basic Q&A posting and reply threading already exists — extend with YouTube attachment field and @mention support
- `components/VideoWatchView.tsx`: YouTube IFrame API with `getCurrentTime()` already wired up — add bookmark button to player controls
- `components/ProfileEditor.tsx`: User profile page exists in dashboard — add bookmarks section
- `lib/comment-utils.ts`: `timeAgo()`, `initials()`, `avatarColor()` — reusable for notification items
- `app/api/comments/route.ts`: Already supports `type=qa` query param and threaded replies — extend for @mention parsing
- `components/DashboardView.tsx`: Dashboard sidebar with `SidebarView` type — bell icon goes in top nav, not sidebar

### Established Patterns
- Comments API (`/api/comments`) handles both video comments and Q&A posts via `type=qa` param
- `getTokenPayload(req)` for auth in all API routes
- Supabase queries with `.select()`, `.insert()`, `.update()`
- React `useState`/`useCallback` for local state, no global state library
- Tailwind + clsx for conditional styling

### Integration Points
- New `notifications` table: id, user_id, type (mention/reply/captain_response), source_id (comment/post id), is_read, created_at
- New `bookmarks` table: id, user_id, video_id (youtube_video_id), session_id, timestamp_seconds, created_at
- `app/api/notifications/route.ts`: New API for GET (list) and PATCH (mark read)
- `app/api/bookmarks/route.ts`: New API for GET (list), POST (create), DELETE (remove)
- Top nav component needs to be created or extracted — currently no shared nav bar across pages
- `@mention` parsing: server-side regex on comment/post save → insert notification rows

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-engagement*
*Context gathered: 2026-03-10*
