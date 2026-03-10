# Project Research Summary

**Project:** TheoryForm — Sailing Team Video Review Platform
**Domain:** Team sports coaching video review platform (rewrite of existing app)
**Researched:** 2026-03-10
**Confidence:** HIGH (architecture and pitfalls drawn from direct codebase analysis; stack and features from official docs + competitor research)

## Executive Summary

TheoryForm is not a greenfield product — it is a rewrite of a working app used by a real sailing team of ~50 people. The core workflow is unique among video review tools: a captain runs a weekly theory session where flagged video moments and Q&A posts are presented on a big screen, grouped by sailor, with the ability to pull up reference videos inline. Every major competitor (Hudl, Coach Logic, Veo) solves individual player review; none is built for structured group review sessions. This distinction should drive all roadmap decisions. The rewrite exists because the current implementation has accumulated critical architectural debt: videos stored as unqueryable JSONB blobs, a 900-line monolithic watch component, YouTube API race conditions, and auth that silently defaults malformed tokens to captain-level access.

The recommended technical approach retains the existing constraints (Next.js 15, Supabase, Vercel free tier, Google Drive + YouTube embeds) and addresses them with targeted additions: normalize the video schema first, split the monolithic component into Video Player / Chapter Nav / Comment Thread, fix the YouTube API singleton bug, add Zod validation at every API boundary, and add Upstash rate limiting on auth endpoints. State management is deliberately minimal — TanStack Query for server state, Zustand for UI-only state, nuqs for URL-synchronized state. shadcn/ui provides accessible primitives without adding a dependency footprint. No third-party search, notifications, or auth systems are needed at 50 users.

The three highest risks in this rewrite are: (1) Google Drive embeds on iOS Safari with default privacy settings, which fail silently and are outside the app's control — every phase touching video must test on a real iOS device; (2) the schema migration from JSONB to normalized rows must happen before any feature work since every subsequent feature depends on clean video data; and (3) auth security — the JWT role-defaulting bug is an active privilege escalation vector that must be the first code changed, not the last. These three risks are known, well-understood, and all have clear mitigations documented in the research.

## Key Findings

### Recommended Stack

The existing core stack (Next.js 15, React 19, TypeScript strict, Tailwind 3.4.x, Supabase) is correct and should be retained. The rewrite adds a focused set of libraries with clear rationale for each. For server data, TanStack Query v5 handles client-side caching, background refetch, and optimistic updates — it is the standard for Next.js App Router data fetching. For URL state, nuqs v2 synchronizes search, active chapter, and filter state to the URL, which is essential for presentation mode (captain needs a shareable URL for the current slide). For UI primitives, shadcn/ui installs as copied source code (not a dependency) and provides accessible dialogs, popovers, and command palette built on Radix UI.

The most important stack decision is the YouTube player: do not use react-player or react-youtube. Both abstract away the IFrame API events that chapter navigation and auto-advance depend on. A ~80-line custom wrapper around `window.YT.Player` provides direct access to `onStateChange`, `seekTo`, and `getCurrentTime`. The YouTube API script must load once at the app level via a singleton module — not per component. For auth security, replace bcryptjs (unmaintained since 2019) with native bcrypt or Node's built-in `crypto.pbkdf2`, add Zod validation to JWT payload parsing, and add Upstash Redis rate limiting on the login endpoint.

**Core technologies:**
- Next.js 15 + React 19: Full-stack framework — retain, App Router server/client split is the correct model
- Supabase (service role, server-only): PostgreSQL + Realtime — retain; add `import 'server-only'` to enforce server boundary
- TanStack Query v5: Client-side server state — replaces ad-hoc useEffect fetching throughout the codebase
- nuqs v2: URL-synced state — critical for presentation mode deep-linking
- Custom YT IFrame wrapper: YouTube playback — replaces react-player; eliminates chapter transition bugs
- shadcn/ui: Accessible UI primitives — dialogs, popovers, command palette; generates owned code not a dependency
- Zod v3: Input validation — every API route boundary, JWT payload parsing, Supabase response parsing
- Upstash Redis + @upstash/ratelimit: Auth rate limiting — brute-force protection on login endpoint
- papaparse v5: CSV parsing — replaces custom char-by-char parser in import-sheet route
- Vitest + Playwright: Testing — unit/integration + E2E; auth paths tested first

### Expected Features

The MVP for this rewrite is not concept validation — it is "restore existing functionality correctly, then add the missing pieces." The distinction matters for roadmap sequencing: foundational fixes (schema, auth, video player) must precede feature additions.

**Must have (table stakes — P1):**
- Reliable mobile video playback (Drive + YouTube) — the team watches on phones; if this breaks, nothing else matters
- Normalized session video schema — prerequisite for all queries, joins, and downstream features
- Google Sheet import pipeline with robust CSV parsing — the only way to get videos into the app
- Timestamped comments with "send to captain" flag — core team interaction model
- Threaded replies — restore existing functionality correctly
- Three-role auth (Captain / Contributor / Viewer) — gates all role-sensitive features
- Chapter navigation for reference library videos — explicitly the stated core value for multi-hour replays
- Captain review queue filtered by sailor — aggregates flagged comments; captain's primary workflow

**Should have (differentiators — P2):**
- Q&A posts feeding the review queue — team members ask tactical questions outside of specific video timestamps
- @mentions in comments — makes addressing specific sailors actionable, not passive
- In-app notification bell — closes the loop when captain responds to a flagged item
- Presentation mode with reorderable queue — the unique workflow no competitor has; requires P1 foundation to be solid
- Tags on reference videos — cross-cutting topic access beyond folder hierarchy
- Full-text search across videos, comments, and articles — Postgres tsvector + GIN, no third-party service
- Personal timestamp bookmarks — save moments without cluttering shared comments

**Defer (v2+):**
- Block-based article editor refinements — article editor exists and works; deeper refinement is v2
- Reference video pullup inline during presentation — requires stable presentation mode first
- Contributor-managed reference library expansion — role expansion after core is stable

### Architecture Approach

The architecture is a standard Next.js App Router pattern: server components own initial data fetching and auth verification, client components own interactivity. The critical structural change from the current codebase is decomposing the 906-line VideoWatchView monolith into four independent components — VideoPlayer (YouTube API lifecycle), ChapterNav (chapter display and seek requests), VideoNotes (captain note read/edit), and CommentThread (fetch, post, threading) — assembled by VideoWatchView as coordinator. Each becomes independently testable and eliminates the YouTube API race condition where multiple mounts overwrite `window.onYouTubeIframeAPIReady`.

The database architecture change is equally critical: `sessions.videos` JSONB array becomes a proper `session_videos` table with foreign keys, indexes, and per-video metadata. This is the load-bearing change; every query, join, and API route depends on it. A one-time migration script converts existing JSONB data to rows before any new code goes live.

**Major components:**
1. VideoPlayer — YouTube IFrame API singleton lifecycle; Drive iframe management; exposes `seekTo(s)` handle and fires `onTimeUpdate` / `onEnded` callbacks; never polled
2. ChapterNav — chapter list display, active chapter tracking, seek dispatch via stable VideoPlayerHandle ref
3. ReviewQueue + PresentationMode — aggregates flagged comments and Q&A by sailor, drag-reorderable client state, per-item "mark reviewed" that persists to DB
4. NotificationBell — TanStack Query polling for unread count; Supabase Realtime as later enhancement
5. lib/youtube-api.ts — singleton module that loads the YT script once, maintains a callback queue, resolves all waiting `onYTReady(cb)` registrations when the API fires

### Critical Pitfalls

1. **YouTube IFrame API global callback overwrite** — Two VideoPlayer components mounting before the API loads causes the second to overwrite `window.onYouTubeIframeAPIReady`, silently breaking the first player. Fix: singleton `lib/youtube-api.ts` with callback queue; all components call `onYTReady(cb)` instead of assigning the global directly.

2. **JWT role defaulting to 'captain' on malformed tokens** — Active privilege escalation bug in current codebase. Any token missing a `role` field is treated as captain. Fix immediately: reject malformed tokens with 401; validate JWT payload shape with Zod; never default to an elevated role.

3. **JSONB video storage as unqueryable blob** — Cannot foreign-key comments to videos, cannot index, cannot paginate within a session. Recovery cost after features are built on top is HIGH. Fix: normalize to `session_videos` table as the very first schema change; run migration before any new code ships.

4. **iOS Safari Drive embed failures** — Drive embeds fail silently on iOS Safari with default privacy settings (cross-site tracking blocked). No error is thrown; the iframe is blank. Fix: always detect iframe load failure and show "Open in Drive" fallback link; test on a real iOS device with default settings before any video phase is marked done.

5. **Service role key leaking to client bundle** — `lib/supabase.ts` imported by a client component bundles `SUPABASE_SERVICE_ROLE_KEY` to the browser, granting full DB access to anyone in DevTools. Fix: `import 'server-only'` in `lib/supabase.ts`; enable RLS on all tables as defense-in-depth.

## Implications for Roadmap

Research points to a clear build order with hard dependencies. The schema is the foundation everything sits on. Auth security must be clean before role-gated features are built. The video player must work reliably before social/engagement features layer on top. Presentation mode is the capstone feature that exercises the entire stack.

### Phase 1: Schema Foundation and Auth Security

**Rationale:** JSONB storage and JWT role defaulting are both active bugs in a system with real users. Nothing else can be built correctly until these are fixed. The schema migration is a prerequisite for every subsequent feature; the auth fix is a security prerequisite. These have zero external dependencies and can be done in isolation.

**Delivers:** Normalized `session_videos` table with proper FKs and indexes; data migration from JSONB; three-role JWT system (Captain / Contributor / Viewer) with Zod payload validation; `import 'server-only'` on Supabase client; RLS enabled on all tables; Upstash rate limiting on login endpoint; bcrypt upgrade.

**Addresses:** Normalized schema (P1), three-role auth (P1)

**Avoids:** JSONB blob pitfall, JWT role-defaulting pitfall, service role leak pitfall

**Research flag:** Standard patterns — well-documented PostgreSQL normalization, Next.js server-only enforcement. Skip phase research.

### Phase 2: Video Player Foundation

**Rationale:** The platform's stated core value is reliable video playback with chapter navigation. This must be solid before any engagement features (comments, review queue, notifications) are built on top of it. YouTube API bugs are the root cause of the most reported failures. Drive embed reliability on iOS Safari must be tested and fallbacks shipped before the team relies on the app.

**Delivers:** YouTube IFrame API singleton loader in `lib/youtube-api.ts`; VideoPlayer / ChapterNav / VideoNotes / VideoWatchView decomposition; multi-video chapter coordination via `onStateChange` ENDED event (no polling); Drive iframe with error detection and "Open in Drive" fallback; `playsinline=1` on all YouTube embeds; iOS Safari manual test gate before phase sign-off.

**Addresses:** Reliable mobile video playback (P1), chapter navigation (P1)

**Avoids:** YouTube API global callback overwrite, iOS Safari iframe failures, postMessage polling pitfall

**Research flag:** Phase needs verification testing on real iOS Safari device — this cannot be emulated. Otherwise well-documented patterns.

### Phase 3: Core Interaction Layer

**Rationale:** With normalized schema and working video player, the team's core commenting workflow can be implemented correctly from the start. The review queue is the captain's primary workflow and aggregates everything upstream of it. Building these together ensures comments, flagging, and the queue are designed as a coherent system.

**Delivers:** Timestamped comments with send-to-captain flag and threaded replies; comment API with Zod validation, pagination (cursor-based, limit 20), and DB indexes on `(video_id, session_id, parent_id)`; captain review queue filtered and grouped by sailor; session manager and video import pipeline with papaparse replacing the custom CSV parser; Google Sheet import with Drive URL parsing and error handling.

**Addresses:** Timestamped comments with send-to-captain (P1), threaded replies (P1), captain review queue (P1), session management (P1), Google Sheet import (P1)

**Avoids:** Missing comment pagination trap, fragile CSV parsing, missing DB indexes

**Research flag:** Standard patterns for comments and pagination. Import pipeline edge cases (quoted commas, CRLF, empty rows) should be explicitly tested.

### Phase 4: Reference Library

**Rationale:** The reference library (two-level folder hierarchy, YouTube chapter navigation) is a standalone feature set with no upstream dependencies beyond the video player (Phase 2) and schema (Phase 1). It can ship as a discrete phase.

**Delivers:** Reference folder tree CRUD with two-level hierarchy; reference video CRUD with chapter definition; chapter navigation using the same VideoPlayer component from Phase 2; "From practice library" tab in VideoUploader; contributor role access to reference management.

**Addresses:** Reference library with folders (P1), chapter navigation for reference videos (P1)

**Research flag:** Standard patterns. No dedicated phase research needed.

### Phase 5: Q&A, Mentions, and Notifications

**Rationale:** These three features form a coherent engagement layer: Q&A posts feed the review queue alongside flagged comments; @mentions require user identity resolution; notifications depend on both mentions and user IDs. Building them together avoids building notification infrastructure twice.

**Delivers:** Q&A post model feeding review queue; @mention parsing in POST /api/comments (server-side regex, atomic insert of notification rows); notifications table `(id, user_id, type, payload, read_at, created_at)`; NotificationBell component with TanStack Query polling and badge count; direct links from notifications to the specific comment or video timestamp.

**Addresses:** Q&A posts (P2), @mentions (P2), in-app notification bell (P2)

**Avoids:** Notifications without destination links (UX pitfall), split-brain comment + notification inserts

**Research flag:** @mention parsing and notification delivery are standard patterns. Supabase Realtime as enhancement can be deferred — polling on mount is sufficient for 50 users.

### Phase 6: Presentation Mode and Search

**Rationale:** Presentation mode is the unique differentiator and the capstone feature. It requires the review queue (Phase 3), reference library (Phase 4), and video player (Phase 2) to all be solid. Full-text search is a natural companion — the same tsvector columns power both search and reference library browsing by topic. Tags on reference videos belong here as well.

**Delivers:** Presentation mode with drag-reorderable queue (Zustand for queue order, nuqs for active item URL param); per-item "mark reviewed" persisting to DB and filtered from active queue; reference video pullup (shadcn Sheet/Drawer) during presentation; Postgres tsvector + GIN indexes on session_videos, comments, articles, qa_posts; `/api/search?q=&types=` endpoint merging ts_rank results; tags on reference videos; personal timestamp bookmarks.

**Addresses:** Presentation mode (P2), tags (P2), full-text search (P2), personal bookmarks (P2)

**Avoids:** Reorder-not-persisting pitfall (explicitly flagged in "Looks Done But Isn't" checklist), no active-item URL for sharing

**Research flag:** Presentation mode drag-and-drop reordering and multi-panel layout may benefit from a focused research phase. Zustand + dnd-kit patterns are well-documented but the specific interaction design (sailor grouping, reference pullup, mark-reviewed flow) is custom to this app.

### Phase Ordering Rationale

- Schema and auth before everything else: JSONB storage and JWT role defaulting affect every feature built after them. Recovery cost if discovered late is HIGH. Fix first.
- Video player before comments: The commenting workflow requires a working player to capture timestamps. Building them in reverse creates a dead-end UX.
- Core interaction (comments + review queue) before engagement features: @mentions and notifications are only valuable if there are active comments to mention people in.
- Reference library before presentation mode: Presentation mode's reference video pullup depends on a working reference library.
- Presentation mode last: It is the integration test for the entire stack. If all dependencies are solid, presentation mode becomes assembly rather than debugging.

### Research Flags

Phases needing deeper research during planning:
- **Phase 6 (Presentation Mode):** The specific interaction design — sailor grouping, drag-reorder UX, reference video pullup within the queue — is custom to this workflow. Research dnd-kit patterns and Zustand queue state management before detailed planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema + Auth):** PostgreSQL normalization and Next.js server-only enforcement are well-documented.
- **Phase 2 (Video Player):** YouTube IFrame API singleton pattern is fully documented; the architecture is specified in ARCHITECTURE.md.
- **Phase 3 (Core Interaction):** Comment threading, pagination, and CSV import are standard patterns.
- **Phase 4 (Reference Library):** Extension of video player patterns from Phase 2.
- **Phase 5 (Q&A + Notifications):** Standard notification table pattern; Supabase Realtime is officially documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack is constrained (existing codebase). Additions (TanStack Query, Zustand, nuqs, shadcn/ui) sourced from official docs and confirmed community consensus. react-youtube staleness confirmed via npm registry. |
| Features | MEDIUM-HIGH | Table stakes from competitor analysis (Hudl, Coach Logic, Veo official docs). Differentiators validated against PROJECT.md ground truth. Sailing-specific workflows inferred from analogous team sports rather than sailing-specific research. |
| Architecture | HIGH | Architecture research drawn from direct codebase analysis plus established Next.js App Router patterns from official docs. Component split and schema normalization are well-precedented. |
| Pitfalls | HIGH | Most pitfalls confirmed as existing bugs in current codebase (CONCERNS.md analysis). YouTube API and iOS Safari issues corroborated by official YouTube docs and Apple community reports. |

**Overall confidence:** HIGH

### Gaps to Address

- **Sailing-specific UX conventions:** Competitor research covered generic sports coaching platforms. Sailing team workflows (regatta debrief vs. practice debrief, wind/tactical notation in comments) were not researched. Validate with the captain before designing the review queue grouping model.
- **Drive embed reliability SLA:** No authoritative documentation exists for Google Drive third-party embedding — it is an unsupported side effect of the Drive viewer. The fallback UX is the correct mitigation, but the team should be informed upfront that Drive embed availability is outside the app's control.
- **Presentation mode interaction design:** The drag-reorder + sailor grouping + reference pullup interaction is novel — no competitor has this exact workflow. UX patterns should be validated with the captain before Phase 6 planning.
- **Supabase free tier limits:** Research assumes free-tier Supabase is sufficient for 50 users. Verify that realtime connections, storage, and row counts stay within Supabase free tier during Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- Current codebase + CONCERNS.md analysis — existing bugs confirmed: YouTube race condition, JSONB fragility, service role exposure, JWT defaulting, postMessage polling
- Next.js 15 official docs — App Router patterns, server-only enforcement, Playwright E2E
- Supabase official docs — tsvector full-text search, Realtime, RLS, service role security
- TanStack Query v5 official docs — Next.js 15 App Router integration, prefetch/dehydration
- YouTube IFrame Player API Reference — onStateChange, YT.PlayerState.ENDED, origin parameter
- Upstash official docs — @upstash/ratelimit, Vercel Edge runtime support
- papaparse official docs — RFC 4180, Node.js support
- PROJECT.md — ground truth for constraints and requirements

### Secondary (MEDIUM confidence)
- nuqs.dev + InfoQ — nuqs v2 Next.js 15 App Router support; adoption by Vercel/Supabase/Sentry
- npm registry — react-youtube last published 2022; bcryptjs v3 from 2019
- Hudl, Coach Logic, Veo official product pages — competitor feature analysis
- Google Drive X-Frame-Options blocking community reports — embed reliability issues
- iOS Safari iframe no-fullscreen — Plyr issue #811, Apple Discussions

### Tertiary (LOW confidence)
- Competitor blog posts (Hudl, Coach Logic) — feature descriptions; may be out of date
- Filestage, Evercast vendor blogs — video annotation tools overview
- Medium post: Zero-Downtime JSONB Migration — normalization strategy

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
