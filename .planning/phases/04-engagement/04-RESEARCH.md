# Phase 4: Engagement - Research

**Researched:** 2026-03-10
**Domain:** In-app notifications, @mention autocomplete, video bookmarks, Q&A YouTube attachment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Q&A Post Format**
- Plain text body (no markdown, no rich text) — keep it simple for quick questions
- Optional single YouTube video attachment: user pastes a YouTube URL, renders as embedded player in the post
- No image or external link attachments — YouTube-only matches the all-YouTube content model
- Q&A posts always appear in captain's review queue automatically (no send_to_captain toggle needed — all Q&A is captain-facing by design)
- Q&A tab stays on the home page (alongside Sessions, Reference, Learn) — accessible without entering the dashboard
- Single-level threaded replies on Q&A posts (consistent with comment threading from Phase 3)

**@Mentions**
- `@` character triggers a dropdown autocomplete showing team members (display name + username), filtered as you type
- Works in: video comments, Q&A posts/replies, and article text blocks
- Rendered as bold blue text in displayed content (not clickable, just a visual callout)
- No group mentions (@all, @team) — individual mentions only; captain can address the team via Q&A posts
- Server-side: parse `@username` patterns on save, create notification records for mentioned users
- ~50 users so the full user list is manageable in a single dropdown fetch

**Notification System**
- Notification triggers: (1) @mention in any context, (2) reply to your comment or Q&A post, (3) captain responds to your flagged item
- NOT a trigger: new Q&A post created (would be noisy for ~50 users)
- Bell icon with red unread count badge in top nav bar (visible on every page) AND in dashboard sidebar
- Clicking bell opens a dropdown panel (not a full page) showing recent notifications
- Each notification links directly to the comment/post that triggered it
- Click a notification to navigate = marks it as read
- "Mark all as read" button at top of dropdown panel
- Notifications stored in database (not ephemeral) — persist across sessions

**Bookmarks**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QA-01 | User can create Q&A posts with plain text body and optional YouTube video attachment | QATab.tsx already exists with post/reply; extend with youtube_attachment field + extractYouTubeInfo() already in lib/types.ts |
| QA-02 | Q&A posts appear in captain's review queue alongside flagged comments | comments table already supports type=qa; route already returns them with send_to_captain; captain auto-flag pattern documented below |
| QA-03 | Users can reply to Q&A posts in threads | QATab.tsx already has full reply threading; no new work needed unless @mention is added to replies |
| AUTH-05 | User can @mention other users in comments, articles, and Q&A posts | Users table has username + display_name; regex parse server-side; MentionInput component pattern documented below |
| COMM-04 | User receives in-app notifications for @mentions and captain responses | New notifications table + /api/notifications route; polling strategy documented below |
| COMM-05 | Notification bell shows unread count badge in nav | New NotificationBell component in top nav; app/page.tsx already has header with auth-check pattern |
| VID-06 | User can bookmark specific timestamps in videos for personal reference | VideoWatchView.tsx already has getCurrentTime() wired; new bookmarks table + /api/bookmarks route |
</phase_requirements>

---

## Summary

Phase 4 adds four interconnected engagement features on top of a stable Phase 3 foundation. The good news: the codebase already has significant groundwork in place. QATab.tsx has full post + reply threading. VideoWatchView.tsx has `getCurrentTime()` and YouTube IFrame API already integrated. ProfileEditor.tsx is the natural home for bookmarks. The comments API already handles QA type queries. The main new work is: (1) wiring YouTube attachment into QATab, (2) building an @mention autocomplete input component reusable across QATab, VideoWatchView comments, and ArticleEditor, (3) creating the notifications table + API + bell UI component, and (4) creating the bookmarks table + API + ProfileEditor bookmark section.

The key architectural decision (Claude's discretion) is notification polling strategy. This app has no WebSocket or real-time infrastructure. Supabase Realtime is available but adds complexity. The right choice for ~50 users with async review patterns is **on-page-load + short-interval polling (30s) only when the dropdown is open**. This avoids continuous background polling on every tab.

The @mention feature spans three components (QATab, VideoWatchView comments inline composer, ArticleEditor text blocks). The cleanest approach is a shared `MentionTextarea` component that wraps `<textarea>` with an overlaid dropdown, taking a `users` prop. Users list is fetched once and passed down from page-level context.

**Primary recommendation:** Build in waves — (1) DB schema + API routes first, (2) QA YouTube attachment + auto-queue, (3) @mention shared component + server-side parse, (4) notification bell + dropdown, (5) bookmark button + profile list.

---

## Standard Stack

### Core (already in use — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.47.10 | DB queries for notifications + bookmarks | Already wired; server-side only via lib/supabase.ts |
| zod | ^4.3.6 | Schema validation for new API routes | Project standard — every API boundary |
| lucide-react | ^0.471.0 | Bell, Bookmark icons | Already imported throughout |
| clsx | ^2.1.1 | Conditional className | Already used everywhere |
| next/server | (Next.js 15) | NextRequest/NextResponse | Project standard |

### No New Dependencies Required
All Phase 4 features can be built with the existing stack. Notably:
- No WebSocket library needed — polling is sufficient for ~50 users
- No rich text editor needed — plain text with @mention overlay is the specified approach
- No push notification library needed (v2 scope)
- extractYouTubeInfo() already in lib/types.ts handles YouTube URL parsing

---

## Architecture Patterns

### Recommended New Files

```
app/
├── api/
│   ├── notifications/
│   │   └── route.ts            # GET (list) + PATCH (mark read / mark all read)
│   └── bookmarks/
│       └── route.ts            # GET (list) + POST (create) + DELETE (remove)
components/
├── MentionTextarea.tsx          # Shared @mention textarea with autocomplete dropdown
├── NotificationBell.tsx         # Bell icon + badge + dropdown panel
lib/
└── schemas/
    ├── notifications.ts         # Zod schemas for notifications API
    └── bookmarks.ts             # Zod schemas for bookmarks API
supabase-migration-phase4.sql    # notifications + bookmarks tables
```

### Pattern 1: @Mention Autocomplete Component
**What:** Controlled textarea that intercepts `@` keystrokes, opens a dropdown filtered against a users list, inserts `@username` on selection.
**When to use:** Anywhere users can type freeform text that supports mentions.

```typescript
// MentionTextarea.tsx — core logic sketch
interface MentionUser { id: string; username: string; displayName: string }
interface Props {
  value: string
  onChange: (val: string) => void
  users: MentionUser[]
  placeholder?: string
  rows?: number
  className?: string
}

// Track mention state
const [mentionSearch, setMentionSearch] = useState<string | null>(null)
const [caretPos, setCaretPos] = useState(0)

function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
  const val = e.target.value
  const pos = e.target.selectionStart ?? val.length
  // Find if we're inside a @word pattern up to caret
  const before = val.slice(0, pos)
  const match = before.match(/@(\w*)$/)
  setMentionSearch(match ? match[1] : null)
  setCaretPos(pos)
  onChange(val)
}

function selectUser(user: MentionUser) {
  // Replace the @partial with @username + space
  const before = value.slice(0, caretPos)
  const after = value.slice(caretPos)
  const replaced = before.replace(/@\w*$/, `@${user.username} `)
  onChange(replaced + after)
  setMentionSearch(null)
}

const filtered = mentionSearch !== null
  ? users.filter(u =>
      u.username.toLowerCase().startsWith(mentionSearch.toLowerCase()) ||
      u.displayName.toLowerCase().includes(mentionSearch.toLowerCase())
    ).slice(0, 8)
  : []
```

Keyboard navigation: `ArrowUp`/`ArrowDown` to move through dropdown, `Enter`/`Tab` to select, `Escape` to dismiss.

### Pattern 2: Server-Side @Mention Parsing
**What:** After inserting a comment/post, parse `@username` patterns from the text, look up user IDs, insert notification rows.
**When to use:** In POST handler of /api/comments (for video comments and Q&A posts/replies).

```typescript
// In POST /api/comments — after successful insert
async function createMentionNotifications(
  commentId: string,
  commentText: string,
  authorId: string,
  supabase: SupabaseClient
) {
  const mentionPattern = /@([a-zA-Z0-9_]+)/g
  const usernames: string[] = []
  let match
  while ((match = mentionPattern.exec(commentText)) !== null) {
    usernames.push(match[1].toLowerCase())
  }
  if (usernames.length === 0) return

  const { data: mentionedUsers } = await supabase
    .from('users')
    .select('id, username')
    .in('username', usernames)

  if (!mentionedUsers?.length) return

  const notifications = mentionedUsers
    .filter(u => u.id !== authorId) // don't notify self
    .map(u => ({
      user_id: u.id,
      type: 'mention' as const,
      source_id: commentId,
      is_read: false,
    }))

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)
  }
}
```

### Pattern 3: Notification Bell with Polling
**What:** Client component fetching unread count on mount, then polling every 30s only while the dropdown is open.
**When to use:** Top nav bar (app/page.tsx header) and dashboard sidebar.

```typescript
// NotificationBell.tsx — polling strategy
export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Fetch count on mount
  useEffect(() => {
    fetchUnreadCount()
  }, [])

  // Poll only while dropdown is open
  useEffect(() => {
    if (!isOpen) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [isOpen])

  async function fetchUnreadCount() {
    const res = await fetch('/api/notifications?countOnly=true')
    if (res.ok) {
      const data = await res.json()
      setUnreadCount(data.unread ?? 0)
    }
  }
  // ...
}
```

### Pattern 4: Bookmark Button in VideoWatchView
**What:** A bookmark icon button in the player controls that calls `player.getCurrentTime()` and POSTs to /api/bookmarks. Requires userId (already passed as prop).
**When to use:** In VideoWatchView.tsx player controls area, gated behind auth check (userId present).

```typescript
// In VideoWatchView.tsx — bookmark handler
async function handleBookmark() {
  if (!userId || !playerRef.current) return
  const ts = Math.floor(playerRef.current.getCurrentTime())
  const res = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_id: video.id,       // youtube_video_id
      session_id: sessionId,
      timestamp_seconds: ts,
      video_title: video.name,
    }),
  })
  if (res.ok) {
    // Show brief "Bookmarked!" toast
    setBookmarkFlash(true)
    setTimeout(() => setBookmarkFlash(false), 1500)
  }
}
```

### Pattern 5: Q&A YouTube Attachment
**What:** Optional URL input below the post textarea. Uses `extractYouTubeInfo()` (already in lib/types.ts) to parse and validate. Stores as `youtube_video_id` column on the comment row (or as a JSON field in comment_text prefix — see DB section). On display, renders as an embedded YouTube iframe.
**When to use:** QATab.tsx composer.

The cleanest DB approach: add `youtube_attachment` column (nullable text) to comments table. This avoids encoding attachment info in comment_text and keeps queries clean.

```typescript
// QATab.tsx — attachment field addition
const [attachmentUrl, setAttachmentUrl] = useState('')
const parsedAttachment = attachmentUrl ? extractYouTubeInfo(attachmentUrl) : null

// In POST body:
body: JSON.stringify({
  author_name: userName,
  comment_text: commentText.trim(),
  send_to_captain: true, // Q&A always captain-facing
  youtube_attachment: parsedAttachment?.id ?? null,
})

// In render — show preview if valid:
{parsedAttachment && (
  <div className="rounded-lg overflow-hidden aspect-video">
    <iframe
      src={`https://www.youtube.com/embed/${parsedAttachment.id}`}
      className="w-full h-full"
      allowFullScreen
    />
  </div>
)}
```

### Pattern 6: Notification Deep-Link Resolution
**What:** Notification items link to the context where the trigger happened. For video comments: `/` with URL params that VideoWatchView picks up. For Q&A posts: `/` with `?view=qa&post=<id>`.
**Recommendation:** Use query params that app/page.tsx reads on mount to auto-open the right view/video.

URL structure:
- Video comment mention: `/?video=<session_video_id>&session=<session_id>&comment=<comment_id>`
- Q&A mention/reply: `/?view=qa&post=<parent_post_id>`

app/page.tsx already uses `useState` for `mainView` and `watchTarget` — extend `useEffect` on mount to read `window.location.search` and set initial state accordingly.

### Anti-Patterns to Avoid
- **Continuous polling on all pages:** Only poll notifications while the dropdown is open. Background polling every N seconds across all tabs wastes resources for a ~50-user team with async review patterns.
- **Embedding attachment data in comment_text:** Store `youtube_attachment` as a dedicated column, not as JSON prefix in comment_text. Keeps queries and rendering clean.
- **Fetching user list per-keystroke:** Fetch users list once on component mount (or page load for the QATab/comments context) and pass down as prop. With ~50 users the payload is ~2KB.
- **Self-notification:** Always filter `user_id !== author_id` before inserting notification rows.
- **Rendering @mentions client-side with regex on every render:** Pre-process mention rendering into a stable structure or use a simple split-and-mark utility function rather than regex in the render path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube URL parsing | Custom URL parser | `extractYouTubeInfo()` in lib/types.ts | Already handles youtu.be, watch?v=, /embed/, bare ID, +start time |
| User mention regex | Ad hoc string search | Standard `/(@[a-zA-Z0-9_]+)/g` regex | Reliable word boundary; usernames are alphanumeric+underscore |
| Timestamp formatting | Custom formatter | `formatTime()` in lib/types.ts | Already handles H:MM:SS, M:SS |
| Time-ago display | Custom function | `timeAgo()` in lib/comment-utils.ts | Already used in QATab and VideoWatchView |
| Avatar color | Custom hash | `avatarColor()` in lib/comment-utils.ts | Already consistent across all comment UIs |
| Zod schema validation | Manual checks | Zod schemas in lib/schemas/ | Project standard — all API boundaries |
| DB insert pattern | Custom query builder | Supabase `.insert({}).select().single()` | Project standard — all existing routes use this |

---

## Common Pitfalls

### Pitfall 1: Q&A Posts Not Auto-Appearing in Captain Review Queue
**What goes wrong:** New Q&A posts don't show up in the dashboard review panel.
**Why it happens:** DashboardView.tsx fetches `?type=qa&captainOnly=true` — if `send_to_captain` is not forced to `true` on Q&A posts server-side, they won't appear.
**How to avoid:** In the POST /api/comments handler, when `video_id` is null and `parent_id` is null (i.e., a top-level Q&A post), override `send_to_captain = true` regardless of request body.
**Warning signs:** Captain review queue shows 0 Q&A items even after posting.

### Pitfall 2: Notification Bell Hidden on Unauthenticated Pages
**What goes wrong:** The bell only makes sense for logged-in users (notifications are user-specific). If rendered for unauthenticated visitors, GET /api/notifications returns 401.
**Why it happens:** app/page.tsx already tracks `authUser` state from `/api/auth/me`. The bell component should only render when `authUser` is non-null.
**How to avoid:** Conditionally render `<NotificationBell />` in header only when `authUser !== null`.

### Pitfall 3: @Mention Dropdown Positioned Off-Screen on Mobile
**What goes wrong:** The autocomplete dropdown renders below the textarea and gets clipped by overflow-hidden ancestors or falls off the viewport bottom on mobile.
**Why it happens:** Absolute-positioned dropdowns inside scrollable containers need careful z-index and portal placement.
**How to avoid:** Use `position: fixed` with calculated coordinates from `getBoundingClientRect()` OR ensure the dropdown renders above the textarea when near the viewport bottom. Keep it simple — `relative` container + `absolute` dropdown works fine in the existing card layouts which have no overflow-hidden ancestors at the card level.

### Pitfall 4: Bookmark Captured at Wrong Timestamp (0 or stale)
**What goes wrong:** Bookmark records timestamp 0 or the timestamp from when the player was loaded, not current playback position.
**Why it happens:** `getCurrentTime()` returns 0 before video starts, and the YT player state must be PLAYING(1) or PAUSED(2) for a meaningful timestamp.
**How to avoid:** Gate the bookmark capture behind `getPlayerState() === PLAYING || getPlayerState() === PAUSED`. VideoWatchView.tsx already uses this guard pattern for timestamp auto-capture (see Accumulated Context note in STATE.md).

### Pitfall 5: @Mention Parse Missing Usernames With Special Characters
**What goes wrong:** A user with underscore in username (e.g., `john_doe`) isn't matched by the mention regex.
**Why it happens:** Regex `@([a-zA-Z0-9]+)` misses underscores.
**How to avoid:** Use `/@([a-zA-Z0-9_]+)/g` — matches all valid DB username characters (users table enforces alphanumeric + underscore at register time).

### Pitfall 6: Stale Notification Count After Mark-All-Read
**What goes wrong:** After clicking "Mark all as read," the bell badge still shows the old count.
**Why it happens:** The PATCH /api/notifications response returns success but the component doesn't refresh the count.
**How to avoid:** After successful PATCH, immediately set `unreadCount(0)` in local state without waiting for next poll cycle.

### Pitfall 7: Deep-Link Query Params Not Cleared After Navigation
**What goes wrong:** User opens a bookmark link, video opens, user navigates away, then refreshes — video re-opens because URL still has params.
**Why it happens:** app/page.tsx is a client component using state, not `useRouter.push`.
**How to avoid:** After reading URL params on mount and setting initial state, call `window.history.replaceState({}, '', '/')` to clear the params.

---

## Code Examples

Verified patterns from existing codebase:

### Supabase Insert + Select (project standard)
```typescript
// Source: app/api/comments/route.ts (existing)
const { data, error } = await supabase
  .from('notifications')
  .insert({ user_id, type, source_id, is_read: false })
  .select()
  .single()
```

### Supabase Bulk Insert (for multiple notifications)
```typescript
// Source: consistent with existing pattern in lib/supabase.ts
const { error } = await supabase
  .from('notifications')
  .insert(notifications) // array — no .single() needed
```

### Authenticated API Route (project standard)
```typescript
// Source: app/api/comments/route.ts + app/api/users/route.ts
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ... rest of handler
}
```

### Zod Schema With Optional Fields (project standard)
```typescript
// Source: lib/schemas/comments.ts
import { z } from 'zod'
export const CreateBookmarkSchema = z.object({
  video_id: z.string().min(1),                     // YouTube video ID
  session_id: z.string().uuid().optional(),
  timestamp_seconds: z.number().nonnegative().int(),
  video_title: z.string().max(200).optional(),
})
```

### extractYouTubeInfo (already exists)
```typescript
// Source: lib/types.ts
import { extractYouTubeInfo } from '@/lib/types'
const parsed = extractYouTubeInfo(urlInput)
// Returns { id: string, startSeconds?: number } | null
```

### Mention Rendering Utility
```typescript
// New function for lib/comment-utils.ts
// Splits text by @username tokens and returns segments
export function parseMentions(text: string): Array<{ type: 'text' | 'mention'; value: string }> {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/)
  return parts.map(part =>
    /^@[a-zA-Z0-9_]+$/.test(part)
      ? { type: 'mention', value: part }
      : { type: 'text', value: part }
  )
}
// Usage in JSX:
// parseMentions(text).map(({ type, value }, i) =>
//   type === 'mention'
//     ? <strong key={i} className="text-blue-600">{value}</strong>
//     : value
// )
```

---

## Database Schema

### New Table: notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'captain_response')),
  source_id UUID NOT NULL,        -- references comments.id (the triggering comment)
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);
```

### New Table: bookmarks
```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,          -- YouTube video ID (not UUID)
  session_id UUID REFERENCES session_videos(id) ON DELETE SET NULL,
  timestamp_seconds INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
  video_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id, created_at DESC);
-- Prevent duplicate bookmarks at same timestamp for same user+video
CREATE UNIQUE INDEX idx_bookmarks_unique ON bookmarks(user_id, video_id, timestamp_seconds);
```

### Alter Table: comments (add youtube_attachment)
```sql
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS youtube_attachment TEXT;  -- nullable YouTube video ID
```

**Note on session_id in bookmarks:** The existing bookmarks schema in CONTEXT.md references `session_id` as a UUID. The normalized schema uses `session_videos` table (from Phase 1 INFRA-01). The `video_id` in the bookmarks table is the YouTube video ID string (e.g., `"dQw4w9WgXcQ"`), matching how `DbSessionVideo.youtube_video_id` is stored. The `session_id` FK should reference `sessions.id` (not `session_videos.id`) since that's what VideoWatchView.tsx receives as `sessionId` prop.

Corrected:
```sql
session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
```

---

## API Design

### GET /api/notifications
```
Query params:
  countOnly=true   → returns { unread: number } (fast for bell badge)
  (no params)      → returns last 20 notifications with is_read flag

Response shape:
  [{ id, type, source_id, is_read, created_at, comment_preview?, link? }]
```

**Recommendation:** Compute the deep-link URL server-side in the GET response. Each notification row has `source_id` (comment ID). Join to comments to get `video_id`, `session_id`, `parent_id` — enough to construct the appropriate link.

### PATCH /api/notifications
```
Body: { id?: string, markAll?: true }
  → if id provided: marks single notification read
  → if markAll: marks all for authenticated user as read
Response: { success: true }
```

### GET /api/bookmarks
```
No query params (auth required — returns current user's bookmarks)
Response: [{ id, video_id, session_id, timestamp_seconds, video_title, created_at }]
```

### POST /api/bookmarks
```
Body: { video_id, session_id?, timestamp_seconds, video_title? }
Response 201: { id, video_id, ... }
Response 409: if duplicate (same user+video+timestamp)
```

### DELETE /api/bookmarks/[id]
```
Auth required + ownership check
Response 204: success
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Supabase Realtime subscriptions for notifications | Polling on open dropdown (30s) | Avoids Realtime complexity; fine for async ~50-user team |
| contenteditable rich text for @mentions | Plain textarea + absolute-positioned dropdown | Simpler, matches existing comment UIs, no library dependency |
| WebSockets for live updates | HTTP polling | Stack already has no WebSocket infrastructure |

**No deprecated patterns apply to this phase** — all new features.

---

## Open Questions

1. **Notification source_id joins for deep-link construction**
   - What we know: comments table has video_id, session_id, parent_id fields
   - What's unclear: For a reply notification, should the deep-link go to the parent post (better UX) or the reply itself?
   - Recommendation (Claude's discretion): Link to parent when available, since that's the visible context. Store `parent_id` in notification or join to comments on GET.

2. **Bookmark video_id field type**
   - What we know: DbSessionVideo uses `youtube_video_id TEXT`, SessionVideo (legacy UI type) uses `id` as the YouTube video ID directly
   - What's unclear: VideoWatchView receives `video: SessionVideo` where `video.id` is the YouTube video ID — this is slightly confusing but established
   - Recommendation: Store `youtube_video_id TEXT` in bookmarks (matches DbSessionVideo naming convention). Map from `video.id` when POSTing.

3. **@mention in ArticleEditor text blocks**
   - What we know: ArticleEditor.tsx handles text blocks with a textarea; articles are saved via PATCH /api/articles
   - What's unclear: Should @mentions in articles trigger notifications? The CONTEXT.md says @mention works in "article text blocks" but notification triggers listed are for comments only.
   - Recommendation: Add MentionTextarea to ArticleEditor but skip notification insertion on article save (no clear target — article is published content, not a direct reply). Render @mentions as bold blue in ArticleViewer.tsx. This satisfies AUTH-05 (mentions work) without over-engineering notifications for article context.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (jsdom) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QA-01 | Q&A post with youtube_attachment saves and returns correctly | unit | `npx vitest run app/api/comments/route.test.ts -x` | Extend existing |
| QA-02 | Q&A posts always have send_to_captain=true regardless of body | unit | `npx vitest run app/api/comments/route.test.ts -x` | Extend existing |
| QA-03 | Reply threading on Q&A posts works (already tested) | unit | `npx vitest run app/api/comments/route.test.ts -x` | Existing |
| AUTH-05 | @mention parse creates notification rows for mentioned users | unit | `npx vitest run app/api/notifications/route.test.ts -x` | Wave 0 gap |
| COMM-04 | Notification GET returns unread items for authenticated user | unit | `npx vitest run app/api/notifications/route.test.ts -x` | Wave 0 gap |
| COMM-05 | Notification PATCH marks single + all-read correctly | unit | `npx vitest run app/api/notifications/route.test.ts -x` | Wave 0 gap |
| VID-06 | Bookmark POST creates record; GET returns user's bookmarks only | unit | `npx vitest run app/api/bookmarks/route.test.ts -x` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/api/notifications/route.test.ts` — covers COMM-04, COMM-05, AUTH-05 notification side effect
- [ ] `app/api/bookmarks/route.test.ts` — covers VID-06 (bookmark create, list, delete + ownership)
- [ ] `lib/comment-utils.test.ts` — covers parseMentions() utility function (new export)

*(Existing `app/api/comments/route.test.ts` covers QA-01/QA-02/QA-03 via extension — no new file needed)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `components/QATab.tsx`, `components/VideoWatchView.tsx`, `components/ProfileEditor.tsx`, `app/api/comments/route.ts`, `lib/types.ts`, `lib/schemas/comments.ts` — all Phase 3 implementation
- Direct code inspection of `app/page.tsx` — confirms header structure, authUser check, QATab integration point
- Direct code inspection of `vitest.config.ts`, `test/setup.ts`, `app/api/comments/route.test.ts` — confirms test patterns

### Secondary (MEDIUM confidence)
- Supabase JS v2 `.insert(array)` for bulk notification rows — consistent with supabase-js v2 documented API, consistent with project pattern
- `window.history.replaceState()` for URL cleanup — standard Web API, no library dependency

### Tertiary (LOW confidence — none)
No unverified claims in this research. All findings grounded in codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing libraries verified in package.json
- Architecture: HIGH — patterns derived from existing code in same codebase
- DB schema: HIGH — follows established supabase-schema-v2.sql patterns + existing migration files
- Pitfalls: HIGH — most derived from existing STATE.md decisions and direct code inspection
- @mention autocomplete: MEDIUM — component design is Claude's discretion; pattern is standard but specific keyboard handling details will need iteration

**Research date:** 2026-03-10
**Valid until:** 2026-06-10 (stable stack, no fast-moving dependencies)
