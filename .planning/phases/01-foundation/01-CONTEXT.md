# Phase 1: Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Normalize database schema (no JSONB blobs), implement secure three-role auth (Captain/Contributor/Viewer), enforce server-side Supabase boundaries, add Zod validation at all API boundaries, and migrate reference videos/articles from existing schema. This is a full rewrite of the foundation — sessions, comments, and users start fresh.

</domain>

<decisions>
## Implementation Decisions

### Access Model
- Everything requires authentication — no public pages
- Unauthenticated visitors see a bare login page (no branding/splash)
- Published articles also require login (no public /learn pages)
- All comments tied to user accounts — remove anonymous/display-name-only commenting entirely

### Authentication Flow
- Captain logs in with username + password like all other users (no separate password-only flow)
- Registration: invite code + username + display name + password (keep current flow)
- New registrations default to Viewer role; captain promotes to Contributor
- Seed captain account created via database migration script (env vars for initial credentials)
- Captain can rotate invite code from the user management UI (stored in DB, not env var)

### Role Permissions — Viewer
- Watch practice videos
- Leave timestamped comments on videos
- Reply to comment threads
- Flag comments as "send to captain" for review queue
- Browse reference library (read-only — folders, videos, chapters)
- Read published articles
- Delete own comments
- Edit own profile (display name, password)

### Role Permissions — Contributor
- All Viewer permissions, plus:
- Manage reference library (add/edit/delete videos and folders)
- Add chapters to reference videos
- Write, edit, and publish articles (can edit any contributor's articles — collaborative model)

### Role Permissions — Captain
- All Contributor permissions, plus:
- Create sessions and import practice videos (Google Sheet import, manual add)
- Manage user accounts: view all users, change roles, deactivate, delete, reset passwords
- Rotate invite code
- Presentation mode (Phase 5, but permission defined here)
- Multiple captains allowed — any captain can promote others
- Original seed captain is protected from demotion by other captains

### User Management
- Dedicated "Team" tab in dashboard sidebar (captain-only)
- User list shows: username, display name, role, registration date, activity indicators (last login, comment count)
- Captain actions: change role, deactivate account, delete account (cascades all user content), reset password
- Users have a basic profile page for self-service (change display name, change password)

### Data Migration
- Selective migration: preserve reference videos/folders and articles
- Wipe sessions, comments, and users — fresh start
- One-time migration script (run during deploy, no dual-schema period)
- Schema redesigned freely — no backward compatibility constraints for wiped tables

### Schema Design
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

</decisions>

<specifics>
## Specific Ideas

- Captain auth unification: the old password-only captain login is eliminated entirely. Captain is just a role on a regular user account.
- Delete user cascades everything — comments, articles, Q&A posts. No "Deleted User" ghosts.
- Collaborative editing: contributors can edit each other's articles and reference content (not ownership-restricted).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth.ts`: JWT signing/verification with jose — needs refactoring but core pattern is reusable
- `lib/supabase.ts`: Supabase client init — needs to be restricted to server-only imports
- `middleware.ts`: Route protection pattern — extend to protect all routes, not just /dashboard/*
- `components/DashboardView.tsx`: Sidebar tab pattern — add "Team" tab for user management

### Established Patterns
- Next.js App Router with server components for pages, client components for interactivity
- API routes in `app/api/` with `NextResponse.json()` responses
- `getTokenPayload(req)` helper for auth checks in API routes
- Tailwind + clsx for conditional styling

### Integration Points
- `middleware.ts` — must be rewritten to protect ALL routes (redirect unauthenticated to /login)
- `app/api/auth/login/route.ts` — rewrite to use username+password for all roles
- `app/api/auth/register/route.ts` — update to assign Viewer role, validate invite code from DB
- Database schema — new migration creates normalized tables, migrates reference/article data

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-10*
