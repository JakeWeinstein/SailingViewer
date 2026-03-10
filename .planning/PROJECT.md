# TheoryForm

## What This Is

A sailing team video review platform for weekly theory sessions. The captain imports practice videos from Google Drive (via Google Sheets), team members watch and leave timestamped comments, and the captain uses a review queue to build an agenda for in-person theory sessions where they give targeted feedback per sailor. The platform also hosts a reference video library with chapters (for analyzing multi-hour livestream replays) and markdown articles with video embeds.

## Core Value

Videos play reliably on every device — Drive embeds load, chapters seek correctly, multi-part YouTube videos transition seamlessly. Everything else depends on this working.

## Requirements

### Validated

<!-- Inferred from existing codebase — these capabilities exist today -->

- ✓ Captain login with password — existing
- ✓ Contributor registration with invite code — existing
- ✓ Session creation (weekly practice grouping) — existing
- ✓ Google Sheet import for Drive video links — existing
- ✓ Timestamped comments on videos — existing
- ✓ "Send to captain" flag on comments — existing
- ✓ Captain review queue with user filtering — existing
- ✓ Reference video library with two-level folders — existing
- ✓ Chapter navigation on reference videos (timestamp-based) — existing
- ✓ Multi-part YouTube video chapters — existing
- ✓ Block-based article editor (text + video embeds) — existing
- ✓ Published/draft article visibility — existing
- ✓ JWT auth with middleware-protected dashboard — existing
- ✓ Google Drive thumbnail and embed URLs — existing
- ✓ Threaded comment replies — existing

### Active

<!-- Full rewrite scope — building toward these -->

- [ ] Reliable video playback across mobile and desktop (Drive + YouTube)
- [ ] Chapters that seek correctly, including multi-video YouTube chapters
- [ ] Mobile-first commenting and video flagging experience
- [ ] Three-role system: Captain (admin), Contributor (edit reference/articles), Viewer (watch/comment)
- [ ] Captain manages user accounts and role assignments
- [ ] @mentions in comments, articles, and Q&A posts with notifications
- [ ] In-app notification system (bell/badge) for @mentions and review responses
- [ ] Presentation mode: reorderable review queue, grouped by person, mixing video flags and Q&A items
- [ ] Ability to pull up reference videos during presentation mode
- [ ] Mark items as "reviewed" to clear from active queue
- [ ] Q&A posts: rich text + link/image/video attachments, not tied to specific videos, feed into review queue
- [ ] Captain can respond to flagged comments and Q&A items
- [ ] Bookmark specific timestamps in videos (personal bookmarks)
- [ ] Private notes on videos (visible only to the note author)
- [ ] Threaded replies on comments
- [ ] Reference videos organized by folders + tags (cross-cutting topics)
- [ ] Full-text search across videos, comments, articles, and Q&A
- [ ] Clean, reliable Google Sheet import pipeline
- [ ] Proper database schema (no JSONB blobs for critical data like videos)
- [ ] Codebase rewrite with clean conventions, testability, and maintainability

### Out of Scope

- Native mobile app (iOS/Android) — web-first, mobile-responsive is sufficient
- Google Drive API integration — prohibited by org that provides unlimited storage
- Real-time chat or messaging — async comments are the communication model
- Video hosting/transcoding — Drive and YouTube handle storage and playback
- Email notifications — in-app only for now
- OAuth/social login — invite code + password is sufficient for team size

## Context

**Team size:** ~40-50 viewers, <10 contributors, 1 captain (admin).

**Usage patterns:**
- Mobile: Team members watch practice videos, leave timestamped comments, flag items for captain review. This is the primary usage mode for most users.
- Desktop: Captain imports videos from Google Sheets, manages sessions, curates reference library, writes articles.
- Presentation: Captain runs weekly theory sessions on a big screen, walking through flagged items grouped by person, with ability to reorder queue and pull up reference videos.

**Google Drive constraint:** The organization provides unlimited Drive storage but prohibits direct API access. Videos are imported via a formatted Google Sheet containing Drive share links. This is a hard constraint, not a preference.

**Existing data:** Current Supabase database has sessions, comments, reference videos/folders, users, and articles. Data should be migrated if schema changes, but no data is so critical it can't be re-entered if migration is impractical.

**Current pain points:**
- Multi-part YouTube chapter videos don't transition between videos correctly
- Videos don't work well on phones (sizing, controls, fullscreen)
- Codebase is bug-ridden and hard to debug — videos stored as JSONB blobs in sessions table
- Features that "don't make sense" in current UX
- No tests, no structured error handling, console-only logging

**Tech stack (retaining):**
- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase (PostgreSQL) backend
- Google Drive embeds + YouTube Player API

## Constraints

- **Storage:** Google Drive for practice videos — no API access, import via Google Sheets only
- **Hosting:** Vercel (deployed from git repo)
- **Database:** Supabase PostgreSQL (accessible via MCP)
- **Budget:** Free tier / no paid services beyond existing Supabase + Vercel
- **Users:** ~50 people, invite-only registration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full rewrite over incremental refactor | Current codebase is too bug-ridden and structurally unsound to patch | — Pending |
| Three-role system (Captain/Contributor/Viewer) | Clear permission boundaries matching actual usage patterns | — Pending |
| Keep Google Sheet import | Org prohibits Drive API; sheets are the workaround | — Pending |
| Normalize video storage (no JSONB blobs) | Videos as JSONB in sessions table causes bugs and makes querying hard | — Pending |
| Folders + tags for reference content | Folders for hierarchy, tags for cross-cutting topics like "downwind" | — Pending |
| In-app notifications only (no email) | Simpler to build; team checks the app regularly enough | — Pending |
| Web-only, no native app | PWA-like experience is sufficient for the team size and use case | — Pending |

---
*Last updated: 2026-03-10 after initialization*
