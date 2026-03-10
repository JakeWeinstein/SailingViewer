# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**Video Hosting & Content:**
- Google Drive - Video storage and embedding
  - SDK/Client: Native URLs (no SDK, HTTP requests only)
  - Thumbnails: `https://drive.google.com/thumbnail?id={id}&sz=w400-h225`
  - Embed: `https://drive.google.com/file/d/{id}/preview`
- YouTube - Video hosting and embedding
  - SDK/Client: Native URLs (no SDK, HTTP requests only)
  - Thumbnails: `https://img.youtube.com/vi/{id}/mqdefault.jpg`
  - Embed: `https://www.youtube.com/embed/{id}?start={startSeconds}` (supports chapter seeking)
  - Helper: `youtubeEmbedUrl()` in `lib/types.ts` for URL generation

## Data Storage

**Primary Database:**
- PostgreSQL (managed by Supabase)
  - Connection: Service role authentication via `SUPABASE_SERVICE_ROLE_KEY`
  - Client: `@supabase/supabase-js` v2.47.10
  - Configuration: `lib/supabase.ts` - `createClient(supabaseUrl, supabaseServiceRoleKey)`
  - Auth mode: Service role (bypasses RLS, server-side only)

**Database Tables:**
- `sessions` - Practice sessions with embedded video metadata (JSONB)
- `comments` - Timestamped public comments with optional captain review queue
- `reference_videos` - Library of instructional videos with metadata
- `reference_folders` - Two-level folder hierarchy for organizing reference library
- `users` - Contributor accounts with bcrypt password hashes
- `articles` - Article blocks (text and video embeds) with publish state

**File Storage:**
- No dedicated cloud storage service (Google Drive and YouTube used for hosting)
- Local file uploads: Not supported; users provide Google Drive or YouTube URLs

**Caching:**
- None configured (relies on browser caching for static assets)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no third-party provider)

**Implementation:**
- Token Library: jose 5.9.6 (JWT signing/verification with HS256 algorithm)
- Password Hashing: bcryptjs 3.0.3 (12 salt rounds)
- Cookie Storage: HTTP-only, secure in production, 7-day expiry
- Cookie Name: `tf_captain_session`

**Auth Flows:**
1. **Captain Login** (`app/api/auth/login/route.ts`)
   - Method: POST with single password
   - Payload: `{ role: 'captain', userName: 'Captain' }`
   - Verification: `process.env.CAPTAIN_PASSWORD` plaintext comparison

2. **Contributor Login** (`app/api/auth/login/route.ts`)
   - Method: POST with username + password
   - Database lookup: Query `users` table by username
   - Verification: bcrypt.compare() against `password_hash`
   - Payload: `{ role: 'contributor', userId, userName }`

3. **Contributor Registration** (`app/api/auth/register/route.ts`)
   - Invite code validation: `process.env.INVITE_CODE` plaintext comparison
   - Password hashing: bcrypt.hash(password, 12)
   - Unique username constraint: Enforced via database and pre-check

**Token Management:**
- Signing: `lib/auth.ts` - `signToken(payload)` with HS256 and 7-day expiry
- Verification: `verifyToken(token)` with error handling for expired/invalid tokens
- Middleware: `middleware.ts` protects `/dashboard/*` routes (except login/register)

**Session Validation:**
- Middleware checks: Token exists in cookie and is valid
- Route-level checks: `getTokenPayload(req)` extracts and validates token in API routes
- Role-based access: Captain-only routes verify `payload.role === 'captain'`

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Datadog, or similar integration

**Logging:**
- Console logging only (no structured logging framework)
- Error responses: Standard HTTP status codes and error messages

**Database Errors:**
- Supabase errors passed through to client in API responses

## CI/CD & Deployment

**Hosting:**
- Recommended: Vercel (Next.js first-party platform)
- Compatible: Any Node.js 18+ hosting (Docker, AWS, Heroku, etc.)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar configured

**Deployment Configuration:**
- Next.js standard build: `npm run build` → `.next/` directory
- Start command: `npm start` (production server)

## Environment Configuration

**Required Environment Variables:**
- `SUPABASE_URL` - Supabase project base URL (https://your-project.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role API key (long JWT-like string, keep secret)
- `CAPTAIN_PASSWORD` - Master password for captain login (any complexity, environment-based)
- `AUTH_SECRET` - Random string for JWT signing (32+ characters, generate: `openssl rand -base64 32`)
- `INVITE_CODE` - Invite code for new contributor registration (any string)
- `NODE_ENV` - Auto-set by deployment platform (development or production)

**Secrets Location:**
- `.env.local` - Local development (git-ignored)
- Vercel/hosting platform dashboard - Production environment variables
- Never commit `.env.local` or contain hardcoded secrets

**Cookie Security:**
- `httpOnly: true` - Inaccessible to JavaScript
- `secure: true` - HTTPS only in production (auto-set when `NODE_ENV === 'production'`)
- `sameSite: 'lax'` - CSRF protection
- `maxAge: 604800` - 7 days (604800 seconds)
- `path: '/'` - Sent with all requests

## Webhooks & Callbacks

**Incoming Webhooks:**
- Not detected - No Stripe, GitHub, or third-party webhook handlers

**Outgoing Webhooks:**
- Not detected - No outbound event notifications to external services

## External Media Handling

**Google Drive Integration:**
- Video retrieval: Direct HTTPS URLs (no API calls)
- File ID extraction: Helper function `extractDriveFileId(input)` in `lib/types.ts`
- URL patterns: `/file/d/{id}` share links and raw IDs supported
- Thumbnail generation: Direct URL with `?sz=w400-h225` parameter
- Preview embedding: `/preview` endpoint for iframes

**YouTube Integration:**
- Video retrieval: Direct HTTPS URLs (no API calls)
- Video ID extraction: Helper function `extractYouTubeInfo(input)` in `lib/types.ts`
- URL patterns: youtu.be short links, watch?v= full links, embed URLs, raw IDs
- Chapter seeking: `?start={seconds}` parameter for seek position
- Timestamp parsing: `parseTimestamp(input)` for human-readable time formats (H:MM:SS, M:SS, seconds)

---

*Integration audit: 2026-03-10*
