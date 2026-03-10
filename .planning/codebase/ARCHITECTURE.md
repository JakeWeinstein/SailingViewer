# Architecture

**Analysis Date:** 2025-03-10

## Pattern Overview

**Overall:** Next.js 15 App Router with server-side authentication and client-side state management. Multi-role system (Captain + Contributors) with role-based access control for administrative features.

**Key Characteristics:**
- Server-side Session management with JWT cookies (7-day expiry)
- Public browsing (home page) vs. authenticated dashboard (captain/contributor)
- Database-first design: Supabase PostgreSQL with service role queries from API routes
- Two-tier component architecture: server pages for auth/layout, client components for interactivity
- Middleware-protected routes at `/dashboard/*`

## Layers

**Presentation (Client):**
- Location: `components/`
- Contains: React client components for browsing (home), dashboard management, video playback, commenting, reference management, article editing/viewing
- Depends on: Type definitions from `lib/types.ts`, API routes, local storage
- Used by: Next.js pages (`app/page.tsx`, `app/dashboard/page.tsx`, `app/learn/[id]/page.tsx`)

**API (Server Routes):**
- Location: `app/api/`
- Contains: Next.js Route Handlers that mediate database access with role-based authorization
- Depends on: `lib/auth.ts` (token verification), `lib/supabase.ts` (client), `lib/types.ts` (types)
- Used by: Client components via `fetch()`, middleware for token validation

**Utilities & Types:**
- Location: `lib/`
- Contains: Type definitions (`types.ts`), authentication logic (`auth.ts`), Supabase client (`supabase.ts`), comment utilities (`comment-utils.ts`)
- Depends on: External SDKs (jose, @supabase/supabase-js, bcryptjs)
- Used by: All layers

**Middleware:**
- Location: `middleware.ts`
- Contains: Route protection using JWT cookie verification
- Depends on: `lib/auth.ts` (verifyToken)
- Used by: Next.js request pipeline for `/dashboard/*` routes

**Pages:**
- Location: `app/`
- Contains: Layout wrapper (`layout.tsx`), public home page (`page.tsx`), authenticated pages (`dashboard/page.tsx`, `dashboard/login/page.tsx`, `dashboard/register/page.tsx`), article viewer (`learn/[id]/page.tsx`)
- Depends on: Components, API routes, auth utilities

## Data Flow

**Public Browsing (Home):**

1. User visits `/` (public, no auth required)
2. `app/page.tsx` renders `TeamFormPage` (client component)
3. Component fetches:
   - Sessions from `/api/sessions/browse` (public endpoint)
   - Comments from `/api/comments?sessionId=...` (public endpoints)
   - Articles from `/api/articles` (public, published only)
4. User can watch videos (via `VideoWatchView`), comment, favorite videos, view reference library, read articles
5. Comments stored via `POST /api/comments` (public, anon author names)

**Authenticated Browsing (Dashboard):**

1. User visits `/dashboard` → middleware checks JWT cookie
2. If no valid token → redirects to `/dashboard/login`
3. `app/dashboard/page.tsx` (server):
   - Verifies JWT with `verifyToken()`
   - Fetches sessions from database
   - Passes `initialSessions`, `userRole`, `userName` to `DashboardView` (client)
4. `DashboardView` renders sidebar (navigation) + main content:
   - **Review tab:** Fetches `/api/comments?sessionId=...&captainOnly=true` to show submitted/captain-only comments
   - **Videos tab:** Manages videos within session using `VideoManager`
   - **Reference tab:** Manages folders/videos via `ReferenceManager`
   - **Upload tab:** Uploads videos via `VideoUploader` to session
   - **Articles tab:** Editor for creating/publishing articles (captain only)

**Comment Threading & Q&A:**

1. Top-level comments: `POST /api/comments` with `{video_id, sessionId, ...}` or Q&A-only
2. Replies: `POST /api/comments` with `{parent_id, ...}` (no video_id required)
3. Fetching replies: `GET /api/comments?parentId=...`
4. Reply counts calculated via Supabase RPC function `comment_reply_counts()`

**State Management:**

- **Persistent:** JWT cookie (auth), localStorage (favorites, user name)
- **Ephemeral:** React state in components (sessions, comments, UI state)
- **Mutations:** API `fetch()` calls to POST/PATCH/DELETE routes

## Key Abstractions

**Authentication (TokenPayload):**
- Purpose: Represent user identity in JWT token
- Definition: `lib/auth.ts` exports `TokenPayload = {role, userId?, userName?}`
- Pattern: Captain token has no userId; Contributor token includes userId + userName
- Usage: Verified in middleware and API routes via `getTokenPayload(req)`

**Video Records (SessionVideo, ReferenceVideo):**
- Purpose: Unified representation of videos (whether in sessions or reference library)
- Files: `lib/types.ts`
- SessionVideo: `{id, name, note?, noteTimestamp?, notes?}` (stored in sessions.videos JSONB)
- ReferenceVideo: `{id, title, type, video_ref, notes?, folder_id?, parent_video_id?, start_seconds?}` (DB table)
- Pattern: Support both single-note (legacy) and multi-note (new) fields

**Comments (threaded):**
- Purpose: Enable discussion on videos and Q&A across team
- Pattern: Top-level comments have `video_id` + optional `sessionId`; replies have `parent_id`
- Metadata: `send_to_captain`, `timestamp_seconds` (for timestamped feedback), `author_name` (anon)
- File: `lib/supabase.ts` exports `Comment` type

**Articles (block-based):**
- Purpose: Knowledge base with rich content (text + video embeds)
- Structure: `Article = {id, title, blocks: ArticleBlock[], is_published, ...}`
- ArticleBlock types: `{type: 'text', content}` or `{type: 'video', videoType, videoRef, ...}`
- Visibility: Drafts only visible to owner (auth required); published visible to public

**Reference Library (two-level folders):**
- Purpose: Organize practice videos + learning resources
- Structure: `ReferenceFolder = {id, name, parent_id?, ...}` (supports self-referential nesting)
- Contents: `ReferenceVideo` entries with `folder_id` foreign key
- Pattern: Hierarchical — folders can contain folders and videos; chapter videos use `parent_video_id`

## Entry Points

**Public Home Page:**
- Location: `app/page.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Render main browsing interface (sessions, reference, learn, Q&A tabs); manage local state for name/favorites

**Authenticated Dashboard:**
- Location: `app/dashboard/page.tsx`
- Triggers: Navigation to `/dashboard` (with valid JWT cookie)
- Responsibilities: Load sessions server-side, verify auth, pass context to `DashboardView` client component

**Login/Register:**
- Location: `app/dashboard/login/page.tsx`, `app/dashboard/register/page.tsx`
- Triggers: Navigation to `/dashboard/login` or `/dashboard/register` (no auth required)
- Responsibilities: Render forms for captain/contributor login and new user registration

**API Entry Points:**
- `POST /api/auth/login` → Signs JWT and sets cookie
- `POST /api/auth/register` → Creates new contributor user
- `GET /api/sessions/browse` → Public session list
- `POST /api/comments` → Public comment creation
- `PATCH /api/sessions/[id]/video-note` → Captain-only note updates
- `POST /api/reference-folders` → Auth-required folder creation
- `POST /api/articles` → Auth-required article creation

## Error Handling

**Strategy:** HTTP status codes + JSON error responses; client-side error display via try/catch on fetch()

**Patterns:**
- 401 Unauthorized: Missing/invalid JWT → redirect to login
- 400 Bad Request: Missing required fields → display validation message
- 500 Server Error: Database query failure → display generic error UI
- Client components wrap fetch() in `.then()` chains with `.finally()` to manage loading state

**Key Example:** `DashboardView.fetchReview()` catches errors silently and loads empty array:
```typescript
Promise.all([fetch(...), fetch(...)]).then(results => {
  // Parse results with fallback to empty array
}).finally(() => setLoadingReview(false))
```

## Cross-Cutting Concerns

**Logging:** `console.*` only; no structured logging framework in place

**Validation:**
- Client-side: Form field checks in components (`if (!name?.trim())`)
- Server-side: Route handlers validate request bodies before DB queries

**Authentication:**
- Strategy: JWT (jose) signed with AUTH_SECRET env var; stored in httpOnly cookie
- Verification: `verifyToken()` in middleware + `getTokenPayload()` in API routes
- Session: 7-day expiry; no refresh token mechanism

**Authorization:**
- Captain-only routes: Checked via `payload.role === 'captain'` in API handlers
- Owner-only (articles/drafts): Checked via `author_id` comparison
- Public routes: No auth check (comments, sessions/browse)

**External Integrations:**
- **Supabase:** Database + file storage (videos via Google Drive URLs)
- **Google Drive:** Video thumbnails + embeds (URL-based, no SDK calls)
- **YouTube:** Video embeds + player API for chapter navigation

---

*Architecture analysis: 2025-03-10*
