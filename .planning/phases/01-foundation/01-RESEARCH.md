# Phase 1: Foundation - Research

**Researched:** 2026-03-10
**Domain:** Database normalization, JWT auth (three roles), server-only enforcement, Zod API validation, data migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Access Model**
- Everything requires authentication — no public pages
- Unauthenticated visitors see a bare login page (no branding/splash)
- Published articles also require login (no public /learn pages)
- All comments tied to user accounts — remove anonymous/display-name-only commenting entirely

**Authentication Flow**
- Captain logs in with username + password like all other users (no separate password-only flow)
- Registration: invite code + username + display name + password (keep current flow)
- New registrations default to Viewer role; captain promotes to Contributor
- Seed captain account created via database migration script (env vars for initial credentials)
- Captain can rotate invite code from the user management UI (stored in DB, not env var)

**Role Permissions — Viewer**
- Watch practice videos
- Leave timestamped comments on videos
- Reply to comment threads
- Flag comments as "send to captain" for review queue
- Browse reference library (read-only — folders, videos, chapters)
- Read published articles
- Delete own comments
- Edit own profile (display name, password)

**Role Permissions — Contributor**
- All Viewer permissions, plus:
- Manage reference library (add/edit/delete videos and folders)
- Add chapters to reference videos
- Write, edit, and publish articles (can edit any contributor's articles — collaborative model)

**Role Permissions — Captain**
- All Contributor permissions, plus:
- Create sessions and import practice videos (Google Sheet import, manual add)
- Manage user accounts: view all users, change roles, deactivate, delete, reset passwords
- Rotate invite code
- Presentation mode (Phase 5, but permission defined here)
- Multiple captains allowed — any captain can promote others
- Original seed captain is protected from demotion by other captains

**User Management**
- Dedicated "Team" tab in dashboard sidebar (captain-only)
- User list shows: username, display name, role, registration date, activity indicators (last login, comment count)
- Captain actions: change role, deactivate account, delete account (cascades all user content), reset password
- Users have a basic profile page for self-service (change display name, change password)

**Data Migration**
- Selective migration: preserve reference videos/folders and articles
- Wipe sessions, comments, and users — fresh start
- One-time migration script (run during deploy, no dual-schema period)
- Schema redesigned freely — no backward compatibility constraints for wiped tables

**Schema Design**
- Normalized session_videos table (no JSONB blobs)
- Proper foreign keys and constraints throughout
- Invite code stored in database (not env var) so captain can rotate it
- Users table includes: is_active flag for deactivation, is_seed flag for captain protection
- Design optimized for the new role system from the start

### Claude's Discretion
- Password reset mechanism (temporary password vs reset link — no email available)
- Exact schema column types and indexes
- Zod schema organization (per-route vs shared schemas)
- Migration script implementation details
- Loading states and error messages for user management UI
- Activity metrics to track (last login, comment count, or other indicators)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Normalized database schema (no JSONB blobs for video storage) | session_videos table design, migration from JSONB, PostgreSQL FK patterns |
| INFRA-02 | Supabase client isolated to server-side only (service role key not exposed) | `server-only` package, Next.js App Router server boundary, bundle inspection |
| INFRA-03 | Zod validation at every API boundary | Zod safeParse pattern, schema organization, structured error responses |
| INFRA-04 | Data migration from existing schema preserving current content | One-time migration script, selective table wipe, Supabase SQL migration |
| AUTH-01 | User can register with invite code, username, display name, and password | Invite code stored in DB table, Viewer default role, bcrypt hashing |
| AUTH-02 | User can log in with username and password | Unified login for all roles, bcrypt compare, JWT issuance |
| AUTH-03 | Three roles exist: Captain (admin), Contributor (edit reference/articles), Viewer (watch/comment) | Role enum in users table, permission matrix, middleware enforcement |
| AUTH-04 | Captain can view and manage all user accounts and assign roles | Team tab UI, user list API, role change/deactivate/delete/reset endpoints |
| AUTH-06 | JWT auth with secure token validation (reject malformed tokens, no role defaulting) | Zod JWT payload validation, strict role checking, middleware rewrite |
</phase_requirements>

---

## Summary

Phase 1 is a targeted rewrite of the application's foundation. The existing codebase has three categories of problems that must be resolved before any feature work proceeds: (1) a known JWT privilege escalation bug where malformed tokens default to `captain` role, (2) the Supabase service role key is importable from client components, and (3) videos are stored as a JSONB blob in `sessions.videos`, which prevents foreign keys, queryability, and clean data references. All three are currently documented in CONCERNS.md and PITFALLS.md — they are not speculative risks but confirmed issues.

The phase involves writing a new database schema (normalized `session_videos` table, three-role `users` table with `is_active`/`is_seed` flags, invite code in DB), rewriting auth to eliminate the password-only captain flow, adding `import 'server-only'` to the Supabase client, rewriting middleware to protect all routes, and adding Zod validation to every API route. A one-time migration script preserves `reference_videos`, `reference_folders`, and `articles` while wiping `sessions`, `comments`, and `users`.

**Primary recommendation:** Execute in this order — (1) new schema + migration, (2) auth rewrite, (3) server boundary enforcement, (4) Zod validation, (5) user management UI. Each step is independently deployable. Do not mix schema changes with auth changes in the same deploy.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | ^15.5.12 | App Router framework | Installed |
| TypeScript | ^5 | Type safety, strict mode enabled | Installed |
| Tailwind CSS | ^3.4.1 | Styling | Installed |
| @supabase/supabase-js | ^2.47.10 | PostgreSQL client | Installed |
| jose | ^5.9.6 | JWT sign/verify | Installed |
| bcryptjs | ^3.0.3 | Password hashing | Installed (see note) |
| lucide-react | ^0.471.0 | Icons | Installed |
| clsx | ^2.1.1 | Conditional classnames | Installed |

### Must Add (Phase 1 requirements)
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| zod | ^3.x | API input validation | INFRA-03 — not installed yet |
| server-only | latest | Build-time server boundary enforcement | INFRA-02 — not installed yet |
| vitest | ^2.x | Unit + integration tests | No test infrastructure exists |
| @vitejs/plugin-react | ^4.x | Vitest React support | Required for Vitest |
| @vitest/coverage-v8 | ^2.x | Coverage reporting | Test coverage |
| @testing-library/react | ^16.x | Component testing | Test auth UI flows |
| @testing-library/jest-dom | latest | DOM matchers | Test assertions |

**Note on bcryptjs:** The existing `bcryptjs` v3.0.3 is from 2019 and unmaintained. For Phase 1, keep it — replacing it introduces unnecessary risk. Log it as tech debt. The functional concern is correctness, not security; bcrypt hashes from v3 are standard bcrypt and remain valid.

**Installation:**
```bash
npm install zod server-only
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom
```

### Alternatives Considered
| Standard Choice | Alternative | Why Standard Wins |
|-----------------|-------------|-------------------|
| Zod v3 | Valibot | Zod v3 is the ecosystem default; every Next.js/tRPC tutorial uses it; v4 is in beta — don't adopt beta for foundation work |
| server-only package | Manual checks | Build-time enforcement is stronger than code review; the package adds `import 'server-only'` that throws at build if imported client-side |
| jose (keep) | Switch to NextAuth | Auth system is custom (invite-code + three roles); migration cost exceeds benefit at 50 users |
| bcryptjs (keep for now) | Node crypto.pbkdf2 | Don't change password hashing algorithm mid-rewrite; migrate separately after Phase 1 |

---

## Architecture Patterns

### Recommended Project Structure (post-Phase 1)
```
app/
├── (auth)/
│   ├── login/page.tsx          # bare login, no layout chrome
│   └── register/page.tsx       # invite-code registration
├── (app)/                      # all authenticated routes
│   ├── layout.tsx              # auth check wrapper
│   ├── page.tsx                # home (sessions + reference + learn tabs)
│   ├── dashboard/page.tsx      # captain/contributor dashboard
│   └── profile/page.tsx        # self-service profile edit
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── register/route.ts
│   │   └── logout/route.ts
│   └── users/
│       ├── route.ts            # GET list (captain), PATCH own profile
│       └── [id]/route.ts       # PATCH role/status (captain), DELETE (captain)
lib/
├── supabase.ts                 # import 'server-only' at top
├── auth.ts                     # jose JWT — rewritten for three roles
├── types.ts                    # keep existing, extend with new types
└── schemas/                    # Zod schemas — see pattern below
    ├── auth.ts                 # LoginSchema, RegisterSchema, TokenPayloadSchema
    └── users.ts                # UpdateRoleSchema, UpdateProfileSchema
middleware.ts                   # protect ALL routes except /login and /register
```

### Pattern 1: Zod Schema Organization

**What:** Shared Zod schemas in `lib/schemas/` (not inline per-route), organized by domain.
**When to use:** Whenever an API route reads from `req.json()`, query params, or Supabase responses.

```typescript
// lib/schemas/auth.ts
import { z } from 'zod'

export const LoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1),
})

export const RegisterSchema = z.object({
  inviteCode: z.string().min(1),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(50),
  password: z.string().min(8),
})

export const TokenPayloadSchema = z.object({
  role: z.enum(['captain', 'contributor', 'viewer']),
  userId: z.string().uuid(),
  userName: z.string(),
})

export type TokenPayload = z.infer<typeof TokenPayloadSchema>
```

**Usage in route:**
```typescript
// app/api/auth/login/route.ts
import { LoginSchema } from '@/lib/schemas/auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { username, password } = parsed.data
  // ...
}
```

Source: Zod official docs — `safeParse` returns `{ success: true, data }` or `{ success: false, error }`. Never use `parse()` in API routes (throws uncaught exceptions).

### Pattern 2: Server-Only Enforcement

**What:** `import 'server-only'` as the first import in any file containing secrets or DB access.
**When to use:** `lib/supabase.ts`, `lib/auth.ts` (if it reads env vars server-side).

```typescript
// lib/supabase.ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
```

If any client component (`'use client'`) imports from `lib/supabase.ts` directly or transitively, `next build` will throw:
```
Error: This module cannot be imported from a Client Component module.
```

Source: Next.js official docs — https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment

### Pattern 3: JWT Payload Validation (Fix Privilege Escalation Bug)

**What:** Validate the decoded JWT payload shape with Zod before trusting any field. Reject tokens with missing/invalid fields — never default to any role.
**When to use:** `lib/auth.ts` `verifyToken()` function.

```typescript
// lib/auth.ts — REWRITTEN
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import type { NextRequest } from 'next/server'

export const COOKIE_NAME = 'tf_session'

const TokenPayloadSchema = z.object({
  role: z.enum(['captain', 'contributor', 'viewer']),
  userId: z.string().uuid(),
  userName: z.string(),
})

export type TokenPayload = z.infer<typeof TokenPayloadSchema>

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const parsed = TokenPayloadSchema.safeParse(payload)
    if (!parsed.success) return null  // Reject — never default to any role
    return parsed.data
  } catch {
    return null
  }
}

export async function getTokenPayload(req: NextRequest): Promise<TokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
```

**Critical:** The old code had `const role = (payload.role as string) ?? 'captain'` on line 30 of `lib/auth.ts`. This is the privilege escalation bug. Zod `.safeParse()` eliminates it — if `role` is missing or not one of the three valid values, `parsed.success` is `false` and the function returns `null`.

### Pattern 4: Middleware Rewrite (Protect All Routes)

**What:** Extend `middleware.ts` to protect all routes, redirecting unauthenticated users to `/login`.
**When to use:** Phase 1 — replace current `/dashboard/*`-only protection.

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/register']

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyToken(token))) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}
```

**Note:** The current login page is at `/dashboard/login`. After Phase 1, move it to `/login` (top-level). No dashboard-only auth — the whole app requires login.

### Pattern 5: Database Schema (Normalized)

**New `users` table** (replaces existing, which lacks `viewer` role, `is_active`, `is_seed`, `last_login_at`):

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('captain', 'contributor', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_seed BOOLEAN NOT NULL DEFAULT false,   -- seed captain: protected from demotion
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX users_username_idx ON users(username);
```

**New `session_videos` table** (replaces `sessions.videos JSONB`):

```sql
CREATE TABLE session_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  note_timestamp INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX session_videos_session_id_idx ON session_videos(session_id);
```

**New `app_config` table** (stores invite code so captain can rotate it):

```sql
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Seed: INSERT INTO app_config (key, value) VALUES ('invite_code', gen_random_uuid()::text);
```

**Altered `sessions` table** (drop `videos` column after migration):

```sql
ALTER TABLE sessions DROP COLUMN IF EXISTS videos;
```

**Altered `comments` table** (add `author_id` FK, remove `author_name` free-text):

The current `comments` table stores `author_name TEXT NOT NULL` with no FK to users. After Phase 1 all comments are tied to accounts, so `author_id` replaces `author_name`.

```sql
-- Since we're wiping comments (per locked decisions), recreate with proper FK:
DROP TABLE IF EXISTS comments;
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  video_id UUID REFERENCES session_videos(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp_seconds INTEGER,
  comment_text TEXT NOT NULL CHECK (char_length(comment_text) <= 2000),
  send_to_captain BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX comments_video_id_idx ON comments(video_id);
CREATE INDEX comments_session_id_idx ON comments(session_id);
CREATE INDEX comments_parent_id_idx ON comments(parent_id);
CREATE INDEX comments_author_id_idx ON comments(author_id);
```

### Pattern 6: Migration Script Structure

**What:** One-time SQL migration that: (1) renames/alters preserved tables, (2) creates new tables, (3) copies reference/article data if columns changed, (4) wipes sessions/comments/users, (5) seeds captain account, (6) inserts invite code into app_config.

**Run order matters — wrap in a transaction:**

```sql
BEGIN;

-- 1. Preserve reference_videos, reference_folders, articles (no structural changes needed)
-- 2. Create new tables
-- (new schema DDL here)

-- 3. Wipe wiped tables
TRUNCATE TABLE comments CASCADE;
TRUNCATE TABLE sessions CASCADE;  -- cascades to old sessions.videos JSONB
TRUNCATE TABLE users CASCADE;

-- 4. Alter sessions to remove JSONB column
ALTER TABLE sessions DROP COLUMN IF EXISTS videos;

-- 5. Seed captain
INSERT INTO users (username, display_name, password_hash, role, is_active, is_seed)
VALUES (
  :'CAPTAIN_USERNAME',
  :'CAPTAIN_DISPLAY_NAME',
  crypt(:'CAPTAIN_PASSWORD', gen_salt('bf')),  -- or hash outside and pass in
  'captain',
  true,
  true
);

-- 6. Seed invite code
INSERT INTO app_config (key, value)
VALUES ('invite_code', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

COMMIT;
```

**Caveat on password hashing in SQL:** Supabase has `pgcrypto` available (`crypt()` + `gen_salt()`). Alternatively, hash the password in Node with bcrypt and pass the hash as a parameter — this is cleaner and avoids storing plaintext even briefly. The migration script can be a `.ts` file that runs bcrypt, then executes SQL via the Supabase client.

### Anti-Patterns to Avoid

- **`?? 'captain'` role defaulting:** Any place in auth code that defaults a missing/invalid role to `captain` is a privilege escalation hole. With Zod validation, this becomes a compile error (Zod's type inference will flag it) rather than a silent runtime bug.
- **Captain password as env var comparison:** The old `password !== process.env.CAPTAIN_PASSWORD` check has no rate limiting. Eliminated in Phase 1 — captain is a regular user account.
- **Importing `lib/supabase.ts` in `'use client'` files:** `server-only` makes this a build error. If you need to read data in a client component, call an API route — never import the Supabase client directly.
- **`as SomeType` casts on Supabase responses:** `supabase.from('users').select().single()` returns `any`. Wrapping with `UserSchema.safeParse()` catches DB shape changes at runtime rather than propagating silently.
- **Inline Zod schemas per route:** Duplicates validation logic. Use `lib/schemas/` shared schemas — the planner should create them as standalone tasks.
- **`DROP TABLE` + `CREATE TABLE` for preserved tables:** Reference videos and articles should be altered in place (or left untouched if no column changes). Only wipe tables that are explicitly in scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API input validation | Custom type-checking ifs | Zod `safeParse()` | Handles nested objects, unions, coercion, error formatting — not worth custom code |
| Server boundary enforcement | Manual checks in every file | `server-only` package | Build-time enforcement — manual checks get missed |
| JWT sign/verify | Custom crypto | `jose` (already installed) | jose handles algorithm negotiation, expiry, signature verification correctly |
| Password hashing | Custom hash function | `bcryptjs` (already installed) | bcrypt work factor is specifically designed for password storage |
| Invite code storage | Complex table | Single row in `app_config` | One-row config table is the simplest correct solution |
| Role hierarchy enforcement | Complex permission matrix code | Simple role enum + explicit checks | Three roles with clear boundaries — explicit `if role === 'captain'` checks are clearer than a permission framework |

**Key insight:** The foundation phase has no novel algorithmic problems. Every solution here uses well-understood, already-in-use libraries. The work is wiring them together correctly, not building new abstractions.

---

## Common Pitfalls

### Pitfall 1: Forgetting `userId` is now required in JWT
**What goes wrong:** After removing the captain-password-only flow, every token must have a `userId` (UUID of the user row). The old code had `userId?: string` as optional. Zod's `TokenPayloadSchema` uses `z.string().uuid()` (required), so any code path that issues a token without a userId will fail at runtime before the token is signed.
**Why it happens:** Old captain tokens had no `userId` because there was no user row for the captain. Phase 1 creates a real user row for the seed captain, so `userId` is always available.
**How to avoid:** Create the seed captain row first in the migration, then sign a test token to verify the full payload structure validates.
**Warning signs:** `z.string().uuid()` Zod error in token issuance, `null` returned from `verifyToken` for valid-looking tokens.

### Pitfall 2: Middleware Matcher Too Broad or Too Narrow
**What goes wrong:** The Next.js middleware matcher regex affects which routes middleware runs on. Too broad (matching `_next/static`) causes static asset 401 redirects. Too narrow (missing API routes) leaves API routes unprotected.
**Why it happens:** The matcher syntax is non-obvious. The current `matcher: ['/dashboard/:path*']` misses all non-dashboard routes.
**How to avoid:** Use the official Next.js negative lookahead pattern for the matcher:
```
'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
```
This excludes static assets but matches all pages and API routes.
**Warning signs:** Static CSS/JS fails to load after middleware rewrite; or API routes return HTML login page instead of JSON 401.

### Pitfall 3: Middleware Cannot Import `server-only` Modules
**What goes wrong:** `middleware.ts` runs in the Edge Runtime, not Node.js. If `lib/auth.ts` imports `server-only`, it can still be imported in middleware because middleware is not a client component — but `server-only` blocks client-side imports, not Edge runtime. However, if `lib/auth.ts` uses any Node.js-only APIs (like `crypto` or file system), middleware will fail.
**Why it happens:** Edge Runtime is a restricted environment. `jose` (which `lib/auth.ts` uses) works in Edge Runtime by design — it uses Web Crypto API. `bcryptjs` does NOT work in Edge Runtime.
**How to avoid:** `lib/auth.ts` contains only `jose` calls — this is fine in middleware. `bcryptjs` is only used in login/register API routes, not in `lib/auth.ts`, so there is no conflict.
**Warning signs:** `Error: The edge runtime does not support Node.js 'crypto' module` during `next build` or at runtime.

### Pitfall 4: Seed Captain Migration Runs Twice
**What goes wrong:** If the migration script is idempotent by accident (or not at all), running it twice either duplicates the seed captain row (violating `UNIQUE` on `username`) or silently double-wipes tables.
**Why it happens:** Migration scripts run during deploy. If a deploy is retried, the script runs again.
**How to avoid:** Use `INSERT ... ON CONFLICT DO NOTHING` for the seed captain. Use `TRUNCATE` only within a conditional (`IF (SELECT COUNT(*) FROM users) = 0 THEN`), or better — structure the migration as a Supabase migration file that tracks whether it has been applied.
**Warning signs:** `unique_violation` on `username` during deploy retry; empty tables on a second migration run.

### Pitfall 5: `is_seed` Flag Logic Needs Captain-Side Enforcement
**What goes wrong:** The `is_seed` flag protects the original captain from demotion. If this check only exists in the UI but not in the API route, a captain can still demote the seed captain via a direct API call.
**Why it happens:** UI-only guards are not security boundaries — they are UX helpers.
**How to avoid:** The `PATCH /api/users/[id]` route (role change) must check: if `target_user.is_seed === true` AND the change would lower the role below `captain`, return 403. This check belongs in the API route, not just the UI.
**Warning signs:** Seed captain's role changes in DB despite UI preventing it; no API-level test for this case.

### Pitfall 6: Old Tokens in Cookies After Auth Rewrite
**What goes wrong:** After rewriting auth (adding `viewer` role, making `userId` required), existing cookies in browsers contain old-format tokens (missing `userId`, using only `captain`/`contributor` roles). These will fail `TokenPayloadSchema.safeParse()` and redirect all current users to login — which is intentional, but should be expected.
**Why it happens:** Token format changed; old tokens are not backward compatible.
**How to avoid:** This is the correct behavior for a security fix. Document it as an expected deploy side effect. The COOKIE_NAME can stay `tf_captain_session` or be renamed `tf_session` — either way, old cookies expire on their own or are cleared on next login.
**Warning signs:** None — users being redirected to login after deploy is expected. If some users are NOT redirected (i.e., old tokens still pass), that indicates the Zod validation is not working.

---

## Code Examples

### Structured Error Response Pattern (Zod)
```typescript
// Use this pattern in all API routes
const parsed = MySchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json(
    {
      error: 'Invalid input',
      details: parsed.error.flatten().fieldErrors,
    },
    { status: 400 }
  )
}
```
Source: Zod docs — `error.flatten()` returns `{ formErrors: string[], fieldErrors: Record<string, string[]> }`. This is the structured error format the planner should use consistently.

### Role-Gated API Route Pattern
```typescript
// Use this in every captain-only route
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (payload.role !== 'captain') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // ...
}
```

For contributor-or-above routes:
```typescript
const ELEVATED_ROLES = ['captain', 'contributor'] as const
if (!ELEVATED_ROLES.includes(payload.role as typeof ELEVATED_ROLES[number])) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Password Reset Without Email (Claude's Discretion)
Since no email is available, the recommended approach is **captain sets a temporary password**:
```typescript
// PATCH /api/users/[id]/reset-password (captain only)
// Captain provides a new temporary password; user is forced to change on next login
const { temporaryPassword } = parsed.data
const hash = await bcrypt.hash(temporaryPassword, 12)
await supabase.from('users').update({
  password_hash: hash,
  must_change_password: true,  // Add this column to users table
}).eq('id', userId)
```
Add `must_change_password BOOLEAN NOT NULL DEFAULT false` to the `users` table. After login, if `must_change_password` is `true`, redirect to `/profile/change-password` before allowing navigation. This avoids email entirely and is appropriate for a captain-managed team.

### Activity Tracking (Claude's Discretion)
For the user list "activity indicators," track `last_login_at` (already in schema above) and derive comment count via a COUNT query — do not store it:
```typescript
// GET /api/users — captain only
const { data: users } = await supabase
  .from('users')
  .select(`
    id, username, display_name, role, is_active, is_seed, last_login_at, created_at,
    comments(count)
  `)
  .order('created_at', { ascending: false })
```
Supabase supports aggregate columns in `select()` with `(count)` syntax. This returns `comments: [{ count: N }]` per user. No stored counter column needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Captain-only password in env var | Captain is a regular user (username+password) | Phase 1 | Eliminates plaintext env var comparison; enables captain account management |
| Two roles (captain / contributor) | Three roles (captain / contributor / viewer) | Phase 1 | New registrations default to viewer; reduces attack surface |
| JWT role defaulting to 'captain' | Strict Zod validation, reject malformed tokens | Phase 1 | Closes active privilege escalation bug |
| JSONB videos in sessions | Normalized session_videos table | Phase 1 | Enables FK from comments to videos, proper querying |
| Invite code in env var | Invite code in app_config DB table | Phase 1 | Captain can rotate without redeploy |
| No public/private route separation | All routes require auth; `/login` and `/register` are public | Phase 1 | No data exposed to unauthenticated visitors |
| lib/supabase.ts importable client-side | `import 'server-only'` enforced | Phase 1 | Closes service role key exposure vector |
| No input validation | Zod on all API boundaries | Phase 1 | Eliminates silent type cast bugs |

**Deprecated/outdated after Phase 1:**
- `CAPTAIN_PASSWORD` env var: No longer needed (captain is a DB user)
- `INVITE_CODE` env var: No longer needed (stored in `app_config`)
- `/dashboard/login` route: Replaced by `/login`
- `/dashboard/register` route: Replaced by `/register`
- `sessions.videos` JSONB column: Replaced by `session_videos` table
- `author_name TEXT` in comments: Replaced by `author_id UUID → users`
- Two-role `TokenPayload` type: Extended to three roles including `viewer`

---

## Open Questions

1. **Password reset UX**
   - What we know: No email available; captain must set temporary password
   - What's unclear: Whether a `must_change_password` column on the users table is worth the added route/redirect complexity for Phase 1, or whether captain just verbally communicates the temp password
   - Recommendation: Include `must_change_password` in the schema from the start (it's one column), but the forced-redirect flow can be deferred to Phase 2 if Phase 1 scope is tight

2. **Supabase RLS policies**
   - What we know: Service role key bypasses RLS; app-level auth is the primary guard
   - What's unclear: Whether to enable RLS as defense-in-depth in Phase 1 or defer
   - Recommendation: Enable RLS and write permissive policies (allow all authenticated requests via service role) in Phase 1. This establishes the pattern without blocking feature work. Tighten policies in a later phase if needed.

3. **Token cookie rename**
   - What we know: Current cookie is `tf_captain_session`; after Phase 1 it covers all roles
   - What's unclear: Whether renaming causes UX disruption (all users re-login on deploy)
   - Recommendation: Rename to `tf_session` — users will re-login once, which is acceptable and expected given the auth security fix

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.x (not yet installed) |
| Config file | `vitest.config.ts` — Wave 0 creates this |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-06 | `verifyToken()` rejects token with missing `role` | unit | `npx vitest run lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-06 | `verifyToken()` rejects token with role `'captain'` (no userId) | unit | `npx vitest run lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-06 | `verifyToken()` returns null for expired token | unit | `npx vitest run lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | `POST /api/auth/register` rejects wrong invite code with 403 | unit | `npx vitest run app/api/auth/register/route.test.ts` | ❌ Wave 0 |
| AUTH-01 | `POST /api/auth/register` creates user with `viewer` role | unit | `npx vitest run app/api/auth/register/route.test.ts` | ❌ Wave 0 |
| AUTH-02 | `POST /api/auth/login` with username+password returns JWT cookie | unit | `npx vitest run app/api/auth/login/route.test.ts` | ❌ Wave 0 |
| AUTH-02 | `POST /api/auth/login` with wrong password returns 401 | unit | `npx vitest run app/api/auth/login/route.test.ts` | ❌ Wave 0 |
| AUTH-03 | `verifyToken()` accepts `viewer` role in payload | unit | `npx vitest run lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-04 | `PATCH /api/users/[id]` with non-captain token returns 403 | unit | `npx vitest run app/api/users/[id]/route.test.ts` | ❌ Wave 0 |
| AUTH-04 | `PATCH /api/users/[id]` cannot demote `is_seed` captain | unit | `npx vitest run app/api/users/[id]/route.test.ts` | ❌ Wave 0 |
| INFRA-02 | `lib/supabase.ts` build fails if imported from client component | build | `next build` (manual inspection) | manual-only |
| INFRA-03 | `POST /api/auth/login` with missing fields returns 400 + field errors | unit | `npx vitest run app/api/auth/login/route.test.ts` | ❌ Wave 0 |
| INFRA-03 | `POST /api/auth/register` with invalid username chars returns 400 | unit | `npx vitest run app/api/auth/register/route.test.ts` | ❌ Wave 0 |

Manual-only tests (INFRA-02: bundle inspection) cannot be automated with Vitest. Verify via `next build` and checking that no `SUPABASE_SERVICE_ROLE_KEY` appears in `.next/static/` — the `server-only` package enforces this at build time.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest configuration with jsdom, path aliases
- [ ] `test/setup.ts` — jest-dom matchers, next/navigation mock, fetch mock
- [ ] `lib/auth.test.ts` — covers AUTH-06, AUTH-03
- [ ] `app/api/auth/login/route.test.ts` — covers AUTH-02, INFRA-03
- [ ] `app/api/auth/register/route.test.ts` — covers AUTH-01, INFRA-03
- [ ] `app/api/users/[id]/route.test.ts` — covers AUTH-04
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom`

---

## Sources

### Primary (HIGH confidence)
- Next.js App Router docs — server-only pattern: https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment
- Next.js middleware docs — matcher configuration: https://nextjs.org/docs/app/building-your-application/routing/middleware
- Zod v3 docs — `safeParse`, `flatten()`, schema inference: https://zod.dev/
- Current codebase: `lib/auth.ts` lines 30-32 — confirmed privilege escalation bug (`?? 'captain'` defaulting)
- Current codebase: `lib/supabase.ts` — confirmed no `server-only` import
- Current codebase: `supabase-schema.sql` — confirmed `sessions.videos JSONB` and two-role `users` table
- `.planning/research/PITFALLS.md` — HIGH confidence analysis of JSONB, service role, and JWT pitfalls
- `.planning/research/STACK.md` — Zod v3 as standard, `server-only` approach, jose retention

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md` — codebase analysis confirming all three root-cause issues
- `.planning/codebase/TESTING.md` — Vitest configuration patterns, test setup file patterns

### Tertiary (LOW confidence)
- Supabase `select()` aggregate syntax (`comments(count)`) — verified in Supabase docs structure but exact syntax should be confirmed against current Supabase JS SDK v2 docs before use

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed except zod/server-only; confirmed via package.json
- Architecture: HIGH — patterns derived directly from existing codebase + official Next.js/Zod docs
- Pitfalls: HIGH — most are confirmed bugs in existing CONCERNS.md, not speculative

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable stack — Next.js 15 + Zod v3 are not fast-moving)
