# Architecture Research

**Domain:** Team video review platform (Next.js 15 + Supabase)
**Researched:** 2026-03-10
**Confidence:** HIGH — based on direct codebase analysis + established Next.js App Router patterns

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BROWSER (Client)                               │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Public Pages │  │  Dashboard   │  │  Video Player Layer      │  │
│  │  (/ /learn)   │  │  /dashboard  │  │  (YT API + Drive iframe)  │  │
│  └───────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │
│          │                 │                       │                 │
│  ┌───────▼─────────────────▼───────────────────────▼──────────────┐  │
│  │              Client Components (React state, fetch)            │  │
│  └───────────────────────────────┬─────────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │ HTTP (fetch + cookies)
┌──────────────────────────────────▼──────────────────────────────────┐
│                      SERVER (Next.js on Vercel)                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Middleware  (JWT cookie → allow/redirect /dashboard/*)      │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────┐  ┌─────────────────────────────────┐     │
│  │  Server Components     │  │  Route Handlers (app/api/*)     │     │
│  │  (auth check, RSC data │  │  (auth + validation + DB)       │     │
│  │   fetch at page level) │  └───────────────┬─────────────────┘     │
│  └────────────────────────┘                  │                       │
└─────────────────────────────────────────────┼───────────────────────┘
                                               │ Supabase SDK
┌─────────────────────────────────────────────▼───────────────────────┐
│                        Supabase (PostgreSQL)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐    │
│  │ sessions │  │ videos   │  │ comments │  │ users / articles  │    │
│  │          │  │(new row) │  │(threaded)│  │ reference lib     │    │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Middleware | JWT verification; redirect unauthenticated users from /dashboard/* | lib/auth (verifyToken) |
| Server Page (dashboard) | Auth check, initial data load, pass role/user to client | Supabase directly, DashboardView |
| Server Page (public /) | Static shell; no auth | Client components |
| VideoPlayer | Embed iframe management, YouTube IFrame API lifecycle, seek/chapter control | ChapterNav, parent via callbacks |
| ChapterNav | Display chapters, handle seek requests, track active chapter | VideoPlayer (seek), parent state |
| CommentThread | Fetch + post comments, threading display, @mention parsing | /api/comments |
| VideoNotes | Captain note display (read), captain note edit (captain role) | /api/sessions/[id]/video-note |
| SessionBrowser | Session list, video list within session, navigation | /api/sessions |
| DashboardView | Top-level client orchestrator: sidebar + section routing | All dashboard sub-components |
| ReviewQueue | Flagged comment list + Q&A, grouped by user, presentation mode | /api/comments?captainOnly=true |
| ReferenceManager | Folder tree + video CRUD, tag filtering | /api/reference-folders, /api/reference-videos |
| ArticleEditor | Block-based content creation, save/publish | /api/articles |
| NotificationBell | Unread @mention count, dropdown list | /api/notifications |


## Recommended Project Structure

```
app/
├── (public)/                    # Route group — no auth required
│   ├── page.tsx                 # Home: sessions + reference + learn tabs
│   └── learn/[id]/page.tsx      # Article viewer (published only)
├── dashboard/
│   ├── page.tsx                 # Server component: auth check + data load
│   ├── login/page.tsx
│   └── register/page.tsx
└── api/
    ├── auth/
    │   ├── login/route.ts
    │   ├── register/route.ts
    │   └── logout/route.ts
    ├── sessions/
    │   ├── route.ts             # GET list, POST create
    │   └── [id]/
    │       ├── route.ts         # GET, PATCH, DELETE
    │       └── videos/route.ts  # POST append, DELETE remove
    ├── videos/
    │   └── [id]/
    │       ├── route.ts         # GET, PATCH metadata
    │       └── notes/route.ts   # GET notes list, POST create
    ├── comments/
    │   ├── route.ts             # GET (by video/session/Q&A), POST
    │   └── [id]/
    │       ├── route.ts         # PATCH (captain response), DELETE soft
    │       └── replies/route.ts # GET replies
    ├── reference-folders/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── reference-videos/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── articles/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── notifications/
    │   └── route.ts             # GET unread, POST mark-read
    ├── users/
    │   └── route.ts             # Captain: list users, manage roles
    └── import-sheet/route.ts

components/
├── video/
│   ├── VideoPlayer.tsx          # iframe + YouTube API lifecycle only
│   ├── ChapterNav.tsx           # chapter list + seek UI
│   ├── VideoNotes.tsx           # captain note display + edit
│   └── VideoWatchView.tsx       # assembles the above 3
├── comments/
│   ├── CommentThread.tsx        # thread list + top-level composer
│   ├── CommentItem.tsx          # single comment + reply toggle
│   └── ReplyComposer.tsx        # reply input
├── dashboard/
│   ├── DashboardView.tsx        # sidebar + section routing
│   ├── ReviewQueue.tsx          # flagged items + presentation mode
│   ├── SessionManager.tsx       # create/edit sessions
│   └── VideoUploader.tsx        # import sheet + manual add
├── reference/
│   ├── ReferenceManager.tsx     # folder tree + video list
│   ├── FolderManager.tsx        # folder CRUD
│   └── ChapterEditor.tsx        # chapter definition for ref videos
├── articles/
│   ├── ArticleEditor.tsx        # block editor
│   └── ArticleViewer.tsx        # rendered article
├── notifications/
│   └── NotificationBell.tsx     # bell icon + dropdown
└── ui/                          # shared primitives (Button, Modal, etc.)

lib/
├── auth.ts                      # signToken / verifyToken / getTokenPayload
├── supabase.ts                  # SERVER-ONLY Supabase client
├── types.ts                     # canonical type definitions
├── validation.ts                # zod schemas for all API input
└── utils.ts                     # URL helpers, formatters

middleware.ts                    # JWT check → redirect
```

### Structure Rationale

- **components/video/:** VideoWatchView.tsx is currently 906 lines mixing four distinct concerns. Splitting into VideoPlayer + ChapterNav + VideoNotes + CommentThread makes each independently testable and eliminates the YouTube API race condition (one VideoPlayer = one API instance).
- **app/api/videos/[id]/notes/:** Moving notes to a dedicated sub-route (instead of PATCH on video-note) supports multiple notes per video and enables the personal bookmarks + private notes features.
- **lib/validation.ts:** Centralizing zod schemas means every route handler imports a validated type, eliminating the untyped query param problem throughout the codebase.
- **lib/supabase.ts as SERVER-ONLY:** The service role key must never reach the browser bundle. `'use server'` or server-only package enforces this. Client components call API routes; they never import supabase directly.
- **components/ui/:** Extracting shared Button, Modal, LoadingSpinner into primitives prevents duplication and makes theme changes single-location.


## Architectural Patterns

### Pattern 1: Server Component for Initial Data + Client Component for Interactivity

**What:** Next.js Server Components fetch initial data and pass it as props to a Client Component shell that manages all interactive state.

**When to use:** Every authenticated page. The server component handles auth verification and the first DB query; the client component handles everything the user interacts with.

**Trade-offs:** Initial page load is fast and SEO-friendly. Subsequent interactions are client-fetched. Avoids the "everything is a useEffect" antipattern from the current codebase.

**Example:**
```typescript
// app/dashboard/page.tsx — Server Component
export default async function DashboardPage() {
  const payload = await getTokenPayload()
  if (!payload) redirect('/dashboard/login')

  const sessions = await supabase
    .from('sessions')
    .select('id, label, created_at')
    .order('created_at', { ascending: false })

  return (
    <DashboardView
      initialSessions={sessions.data ?? []}
      userRole={payload.role}
      userName={payload.userName}
    />
  )
}
```

### Pattern 2: Video Player as a Self-Contained Module

**What:** VideoPlayer owns all YouTube IFrame API concerns — loading the script once at app level, registering events, managing playback state. ChapterNav communicates with it via a stable ref/callback interface.

**When to use:** Any time a page embeds a video. The player exposes `seekTo(seconds)` and fires `onTimeUpdate(seconds)` callbacks. Consumers never touch the YT global directly.

**Trade-offs:** More initial setup than the current inline approach, but eliminates the race condition where multiple VideoWatchView mounts overwrite `window.onYouTubeIframeAPIReady`. Enables reliable chapter auto-advance.

**Example:**
```typescript
// components/video/VideoPlayer.tsx
interface VideoPlayerProps {
  videoId: string
  videoType: 'youtube' | 'drive'
  onTimeUpdate?: (seconds: number) => void
  onEnded?: () => void
  ref?: React.Ref<VideoPlayerHandle>
}

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
}

// ChapterNav consumes:
const playerRef = useRef<VideoPlayerHandle>(null)
const handleChapterClick = (startSeconds: number) => {
  playerRef.current?.seekTo(startSeconds)
}
```

### Pattern 3: Multi-Video Chapter Coordination via Parent State

**What:** For reference videos with multi-video chapters (YouTube playlist-style), a parent component (VideoWatchView or ChapterNav) holds the active chapter index and the array of chapter video IDs. When VideoPlayer fires `onEnded`, the parent advances the index and passes the new videoId as a prop, causing VideoPlayer to swap to the next video.

**When to use:** Only for multi-video chapters. Timestamp chapters are handled entirely within a single VideoPlayer instance via `seekTo`.

**Trade-offs:** No postMessage polling. The `onEnded` callback is a clean YT Player API event (`YT.PlayerState.ENDED`), not an interval check. This directly fixes the 500ms retry bug.

**Example:**
```typescript
// In VideoWatchView (or ChapterNav parent)
const [activeChapterIdx, setActiveChapterIdx] = useState(0)
const chapters = video.chapters // [{videoId, title, startSeconds}]

const handleVideoEnded = () => {
  if (activeChapterIdx < chapters.length - 1) {
    setActiveChapterIdx(i => i + 1)
  }
}

// VideoPlayer re-mounts or swaps src when videoId prop changes
<VideoPlayer
  videoId={chapters[activeChapterIdx].videoId}
  onEnded={handleVideoEnded}
/>
```

### Pattern 4: Normalized Schema — Videos as First-Class Rows

**What:** Practice videos stored in a dedicated `session_videos` table (one row per video) instead of a JSONB array in `sessions.videos`. Reference videos remain in `reference_videos` with the same pattern.

**When to use:** Always. This is the replacement for the current JSONB blob architecture.

**Trade-offs:** Requires a migration of existing data (manageable — current data is not critical per PROJECT.md). Enables foreign keys, indexes, and per-video metadata (notes, bookmarks) without JSON manipulation. Queries like "show all flagged comments" can join directly on `video_id`.

**Example:**
```sql
-- New table replaces sessions.videos JSONB
CREATE TABLE session_videos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  title       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes per video (replaces note/noteTimestamp fields)
CREATE TABLE video_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID NOT NULL REFERENCES session_videos(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id),
  content     TEXT NOT NULL,
  timestamp_seconds INTEGER,
  is_private  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```


## Data Flow

### Public Video Viewing Flow

```
User visits /
    ↓
app/page.tsx (Server Component) renders shell
    ↓
TeamFormPage (Client) fetches:
    GET /api/sessions/browse        → session list
    GET /api/reference-folders      → folder tree + videos
    GET /api/articles               → published articles
    ↓
User selects session + video
    ↓
VideoWatchView renders:
    VideoPlayer (Drive iframe or YT API)
    ChapterNav (timestamp or multi-video)
    CommentThread (GET /api/comments?videoId=...)
    ↓
User posts comment:
    POST /api/comments → 201 → append to local state
```

### Presentation Mode Flow (Captain)

```
Captain opens ReviewQueue in dashboard
    ↓
GET /api/comments?captainOnly=true&sessionId=...
    → Returns flagged comments + Q&A grouped by author
    ↓
Captain reorders via drag-and-drop (client state only, no persistence needed)
    ↓
Captain clicks item → VideoWatchView loads at timestamp
    ↓
Captain marks reviewed:
    PATCH /api/comments/[id] {reviewed: true}
    → Item removed from active queue (client filter)
```

### Comment @Mention + Notification Flow

```
User posts comment with @username
    ↓
POST /api/comments
    → Server: parse @mentions from comment_text with regex
    → Server: INSERT notification row per mentioned user
    → 201 response with comment
    ↓
Mentioned user's NotificationBell polls:
    GET /api/notifications?unread=true  (on mount + 60s interval)
    → Badge count updates
    ↓
User opens bell → GET /api/notifications (full list)
    PATCH /api/notifications {read: true}
```

### State Management Strategy

```
URL params         — active session, selected video, chapter index (deep-link support)
React local state  — video player time, comment draft text, UI open/close
Server state       — all persistent data (comments, sessions, videos, articles)
JWT cookie         — user identity + role (httpOnly, 7-day)
localStorage       — anonymous display name (non-auth users), favorites
```

No global client state manager (Zustand, Redux) is needed at this team size (~50 users). The App Router's server-fetched initial data + local component state + API mutations pattern is sufficient. Adding Zustand would be premature optimization.


## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~50 users) | Current monolith pattern is appropriate. Normalize schema. Split large components. |
| 200-500 users | Add DB indexes on (video_id, session_id, parent_id) in comments table. Add pagination to comment API. |
| 500+ users | Add connection pooling (Supabase has this). Cache reference folder tree in-memory (it changes infrequently). |

### Scaling Priorities

1. **First bottleneck:** Comment queries without indexes. Fix by adding `CREATE INDEX` on all FK columns before any performance issues emerge — costs nothing now.
2. **Second bottleneck:** Full-text search across videos + comments + articles. Supabase `tsvector` columns + GIN indexes cover this up to several thousand rows without external services.


## Anti-Patterns

### Anti-Pattern 1: JSONB Blobs for Queryable Entities

**What people do:** Store videos as `sessions.videos = [{id, name, note}]` JSONB array.
**Why it's wrong:** Can't index individual video fields, can't foreign-key comments to a specific video row, can't query "all videos flagged by a user" without loading all sessions. Every video write requires fetching and rewriting the entire array.
**Do this instead:** Give each video its own row in `session_videos` with a foreign key to `sessions`.

### Anti-Pattern 2: Service Role Key Imported by Client Components

**What people do:** `import { supabase } from '@/lib/supabase'` in a client component (`'use client'`).
**Why it's wrong:** Next.js bundles the import into the client JS. The `SUPABASE_SERVICE_ROLE_KEY` is then visible in the browser, granting full database access to anyone who opens DevTools.
**Do this instead:** `lib/supabase.ts` uses `import 'server-only'` (Next.js package). Client components call `/api/*` routes. API routes use the service role key safely on the server.

### Anti-Pattern 3: Single `window.onYouTubeIframeAPIReady` Callback

**What people do:** Assign directly to `window.onYouTubeIframeAPIReady` when loading the YouTube IFrame API script.
**Why it's wrong:** If two VideoPlayer components mount before the API loads, the second mount overwrites the first's callback. The first player never initializes.
**Do this instead:** Maintain a callback queue. Load the script once at app level (`app/layout.tsx` or a singleton module). Each VideoPlayer registers its own callback into the queue; the queue flushes when the API fires.

```typescript
// lib/youtube-api.ts — singleton
const queue: Array<() => void> = []
let loaded = false

export function onYTReady(cb: () => void) {
  if (loaded) { cb(); return }
  queue.push(cb)
}

// Called once from layout
window.onYouTubeIframeAPIReady = () => {
  loaded = true
  queue.forEach(cb => cb())
  queue.length = 0
}
```

### Anti-Pattern 4: Monolithic Watch Component

**What people do:** Put video playback, chapter navigation, comment threading, note editing, and reply logic into a single 900-line component.
**Why it's wrong:** Any change to the player risks breaking comments. Impossible to test the chapter auto-advance without simulating comment state. Bugs in reply input affect seek behavior.
**Do this instead:** VideoPlayer / ChapterNav / VideoNotes / CommentThread are independent components assembled by VideoWatchView. Each has its own props interface and internal state. VideoWatchView coordinates them via shared callbacks but doesn't own their implementation details.

### Anti-Pattern 5: Polling Instead of Events

**What people do:** `setInterval(() => player.getCurrentTime(), 1000)` to detect chapter changes, or `setInterval(() => sendMessage(), 500)` to retry YouTube API calls.
**Why it's wrong:** Continuous polling drains mobile battery, blocks the main thread on low-end devices, and is unreliable (1-second interval misses events that fire between ticks).
**Do this instead:** Use YouTube IFrame API state events: `onStateChange` fires when video ends (`YT.PlayerState.ENDED`), starts, pauses. `onReady` fires when the player is initialized. No polling needed.


## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Drive | URL-only embeds: `drive.google.com/file/d/{id}/preview` in `<iframe>`. Thumbnails via `drive.google.com/thumbnail?id={id}&sz=w400`. No SDK. | Hard constraint from org. No API access. Import path is Google Sheets CSV export only. |
| YouTube | YouTube IFrame API loaded via script tag. `YT.Player` instances created per video. Events: `onReady`, `onStateChange`. | Initialize once at app level, not per component. Multi-video chapters require `onStateChange` ENDED event, not polling. |
| Supabase | Server-side only via `@supabase/supabase-js` with service role key. All queries from API route handlers. | Never import in client components. Row-Level Security as defense-in-depth on top of route-level auth checks. |
| Google Sheets | CSV export URL: `spreadsheets.google.com/spreadsheets/d/{id}/export?format=csv`. Fetched server-side in `/api/import-sheet`. | Use a vetted CSV library (papaparse) instead of custom char parser. Validate sheet ID format before fetch. |
| Vercel | Static + serverless deployment. Environment variables via Vercel dashboard. | `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `CAPTAIN_PASSWORD`, `INVITE_CODE` must be set in Vercel env, never in `.env` committed to git. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client Component ↔ Database | Always via API route (never direct) | Enforced by `import 'server-only'` in lib/supabase.ts |
| VideoPlayer ↔ ChapterNav | `seekTo(seconds)` callback + `onTimeUpdate(seconds)` event | Stable ref interface; ChapterNav never touches YT global |
| VideoPlayer ↔ MultiVideoChapter parent | `onEnded()` callback | Parent controls chapter index, passes new videoId as prop |
| API Route ↔ Supabase | Supabase JS SDK with service role key | Validate auth payload before every query; treat DB as untrusted |
| Middleware ↔ API Routes | JWT cookie shared via `cookies()` | Middleware redirects pages; API routes return 401 JSON |
| @Mention parsing ↔ Notification insertion | Atomic: parse + insert in same API route handler | Keeps comment + notification consistent (no split-brain) |


## Build Order Implications

The normalized schema is the load-bearing foundation. Everything else depends on it.

1. **Schema first:** Create `session_videos`, `video_notes`, normalized `reference_videos` with proper FKs and indexes. Migrate existing data. Until this is done, no other feature can be built correctly.

2. **Auth + user model second:** Three-role system (Captain / Contributor / Viewer) and validated JWT payload. Until this is done, role-based API gates are untestable.

3. **Core video playback third:** VideoPlayer singleton (YouTube API), ChapterNav, multi-video chapter coordination. This is the platform's stated core value. It must work reliably on mobile before any engagement features are layered on top.

4. **Comments + threading fourth:** Comment schema is largely correct today; needs indexes, pagination, and proper type constraints. Threaded replies and Q&A build on top of this.

5. **Review queue + presentation mode fifth:** Depends on comment flags being reliable. Presentation mode is a view over existing comment data — no new schema, just a new UI mode.

6. **Notifications sixth:** Depends on comments (@mentions) and users (who to notify). Can be added incrementally without blocking anything else.

7. **Full-text search last:** Depends on all content tables being stable. Postgres `tsvector` can be added as a later migration once schema is settled.

---
*Architecture research for: TheoryForm — team video review platform*
*Researched: 2026-03-10*
