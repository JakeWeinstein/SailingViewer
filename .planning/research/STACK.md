# Stack Research

**Domain:** Team video review platform (sailing team — Next.js + Supabase rewrite)
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH (core stack HIGH, supporting libraries MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (pin current) | Full-stack framework | Already constrained. App Router is the correct model: server components render data-heavy views, client islands handle video player + comment interactivity. No reason to switch. |
| React | 19.x | UI rendering | Ships with Next.js 15. React 19 improvements to Context and `useActionState` reduce need for external state libs. |
| TypeScript | 5.x (strict) | Type safety | Already in use. Strict mode catches the unsafe type casts that caused the `role === 'captain'` silent default bug. Non-negotiable for this rewrite. |
| Tailwind CSS | 3.4.x | Styling | Already in use, good fit. v4 is in RC but has breaking changes; stay on 3.4.x until v4 is stable. |
| Supabase | @supabase/supabase-js 2.x | PostgreSQL + Realtime | Already constrained. Service role key stays server-only (API routes + server components). Add anon key for Realtime subscriptions in client components only — never service role client-side. |

### State Management

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | ^5.0 | Client-side global state | Presentation mode queue ordering, notification badge count, active session state. Use where multiple unrelated components need shared mutable state. Do NOT use for server data — that's TanStack Query's job. |
| TanStack Query | ^5.0 | Async server state | Comments list, session videos, review queue, notifications. Handles caching, background refetch, optimistic updates. Works with App Router via prefetch + dehydration pattern. |
| nuqs | ^2.x | URL-synced state | Search query, active chapter, selected video, filter state in review queue. Keeps state shareable via URL — critical for presentation mode. Used by Vercel, Supabase, and Sentry internally. |
| React Context | built-in | Auth session, theme | Only for low-churn globals (current user role/identity). React 19 context is fast enough for this use case. Do not use for lists or frequently-updated data. |

**Pattern:** Server components own data fetching. TanStack Query owns client-side cache of that data. Zustand owns UI-only state that isn't server data. nuqs owns state that belongs in the URL.

### Video Players

This project embeds two fundamentally different video sources: Google Drive (iframe only, no API access) and YouTube (IFrame Player API required for seek + auto-advance). They need separate handling.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom YouTube component (raw IFrame API) | N/A | YouTube playback with full API control | Chapters, auto-advance between multi-video chapters, seek-to-timestamp from comments. `react-youtube` is 3 years stale (last publish 2022, v10.1.0). Build a thin wrapper around `window.YT.Player` directly — it's ~80 lines and gives full control over onStateChange, getCurrentTime, seekTo. |
| Google Drive iframe | N/A | Drive video embedding | Pure `<iframe>` with Drive preview URL. No API access is possible (org constraint). Wrap in a responsive container with `aspect-ratio: 16/9`. Seek-to-timestamp for Drive videos is not possible — document this limitation clearly. |

**Do NOT use react-player for this project.** It abstracts away YouTube IFrame API events in ways that make programmatic seeking unreliable. The existing codebase's chapter-advance bugs stem from this abstraction mismatch. Direct IFrame API gives `onStateChange`, `seekTo`, and `getCurrentTime` without workarounds. react-lite-youtube-embed is great for static embeds but provides no programmatic API — wrong tool here.

**YouTube API singleton pattern:** The existing bug where two `VideoWatchView` instances overwrite `window.onYouTubeIframeAPIReady` must be fixed at the app level. Load the script once in `app/layout.tsx` via a module-scoped promise. Multiple player instances attach via `new window.YT.Player(elementId, config)` after the API is ready.

### Component Library

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest (CLI-installed, no version pin) | Accessible UI primitives | Dialogs, dropdowns, popovers, tooltips, command palette (search), sheet/drawer for mobile. shadcn copies component source into your repo — you own the code. Built on Radix UI primitives + Tailwind. Perfect fit for a Tailwind-already project. |
| lucide-react | ^0.471 (current) | Icons | Already in use, keep it. |

**shadcn/ui is the right call here.** It's not a dependency — it's generated code you own. It gives accessible keyboard navigation, focus trapping, and ARIA attributes for free on modals/dialogs (critical for presentation mode). Headless UI is a viable alternative but is tied to Tailwind Labs and has less ecosystem momentum in 2025.

### Validation

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.x | Schema validation | All API route inputs (body + query params), Supabase response parsing, environment variable validation. Zod v3 is the ecosystem standard — every tRPC/Next.js tutorial uses it, type inference is battle-tested. v4 is in beta as of early 2026; migrate when stable. |

**Use Zod at every API boundary.** The CONCERNS.md documents multiple type-unsafe query param reads and silent `as SomeType` casts. Zod `safeParse` on every route handler eliminates this class of bug. Parse Supabase responses with Zod too — the JSONB blob bugs in sessions.videos came from trusting the DB shape.

### Search

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| Postgres tsvector (via Supabase) | built-in | Full-text search | Search across video titles, comment text, article content, Q&A posts. Add `fts tsvector GENERATED ALWAYS AS (to_tsvector('english', ...)) STORED` column to each searchable table. GIN index on fts column. Query via `supabase.from('comments').select().textSearch('fts', query)`. |

**Do not add a third-party search service.** The team is 50 people. Postgres FTS with GIN indexes is fast enough for this scale and costs nothing. Algolia/Typesense are overkill and violate the free-tier constraint. Supabase documents this pattern with generated columns + GIN and it is the correct approach.

### Notifications (In-App)

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| Supabase Realtime | built-in | Push new notifications to client | Subscribe to INSERT events on `notifications` table filtered by `user_id`. Client opens WebSocket connection only when user is logged in. |
| TanStack Query | ^5.0 | Notification list fetch + badge count | Fetch unread count on mount, invalidate on Realtime event. Start without Realtime — polling on page load is sufficient for a 50-person team. Add Realtime as an enhancement if the UX feels stale. |

**Pattern:** Create a `notifications` table with `(id, user_id, type, payload JSONB, read_at, created_at)`. Write to it from API routes when @mentions or captain responses occur. Client subscribes to its own rows via Supabase Realtime. Badge count = count of rows where `read_at IS NULL`. This is zero-cost infrastructure — no third-party notification service needed.

### Auth

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jose | ^5.x | JWT signing + verification | Keep for token issuance. Upgrade to latest 5.x. |
| bcrypt (native) | ^5.x | Password hashing | Replace `bcryptjs` (unmaintained v3). Use `bcrypt` (the native C++ binding) — faster, actively maintained. On Vercel it compiles correctly. Alternatively: Node's built-in `crypto.pbkdf2` via `util.promisify` requires no native build at all and is always available. |

**Do NOT use Supabase Auth.** The invite-code + role system is custom and would require significant Supabase Auth customization. The existing JWT approach with `jose` is correct for this scale. Fix the security gaps (rate limiting on login, token payload validation with Zod, remove captain-default fallback for missing role) rather than migrating auth systems.

### Rate Limiting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/ratelimit | ^2.x | Per-user/per-IP rate limiting on API routes | Login endpoint (brute force protection), comment submission, sheet import. Upstash Redis has a generous free tier (10k requests/day) compatible with the budget constraint. Works in Vercel Edge runtime. |

**Upstash Redis is the correct choice.** Vercel serverless functions are stateless — in-memory rate limiting doesn't work across invocations. Upstash provides serverless Redis with free tier. The `@upstash/ratelimit` package has first-class Vercel/Next.js support with sliding window algorithm.

### CSV Parsing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| papaparse | ^5.x | Google Sheet CSV import | Replace the custom char-by-char parser in `app/api/import-sheet/route.ts`. papaparse handles quoted fields, CRLF, malformed rows. Works in Node.js. No dependencies. RFC 4180 compliant. |

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^2.x | Unit + integration tests | Auth logic, Zod schemas, utility functions, API route handlers (via `createMocks`). ~4x faster than Jest for this stack. Native ESM + TypeScript support. |
| React Testing Library | ^16.x | Component tests | Comment thread rendering, VideoPlayer state, notification badge. Test behavior not implementation. |
| Playwright | ^1.x | End-to-end tests | Login flow, video chapter navigation, comment submission, presentation mode queue reordering. Next.js officially recommends Playwright for App Router E2E. |
| @vitest/coverage-v8 | ^2.x | Coverage reports | Track which API routes and auth paths are covered. |

**Testing priority order for the rewrite:** Auth flow first (the current codebase has zero auth tests and this is the highest risk area). Then API route validation (Zod schemas are fast to test). Then component behavior. E2E tests for the video player specifically — the chapter auto-advance bug is a pure E2E concern, not unit-testable.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9 + eslint-config-next | Linting | Already configured. Keep. Add `eslint-plugin-react-hooks` rules for exhaustive deps. |
| Prettier | Formatting | Add if not present. Consistent formatting reduces noise in diffs. |
| @types/papaparse | Type definitions | Required for papaparse in TypeScript. |
| @types/bcrypt | Type definitions | Required if using bcrypt (native). |

---

## Installation

```bash
# State management
npm install zustand @tanstack/react-query @tanstack/react-query-devtools nuqs

# Component library (shadcn CLI — do not npm install directly)
npx shadcn@latest init

# Validation
npm install zod

# CSV parsing
npm install papaparse
npm install -D @types/papaparse

# Password hashing (replace bcryptjs)
npm install bcrypt
npm install -D @types/bcrypt

# Rate limiting
npm install @upstash/ratelimit @upstash/redis

# Testing
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D playwright @playwright/test
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Zustand | Redux Toolkit | Only if team has Redux expertise and needs Redux DevTools for complex state debugging. Overkill for this app's state surface. |
| TanStack Query | SWR | SWR is simpler but lacks optimistic update primitives and the prefetch/dehydration pattern needed for App Router. TanStack Query v5 is the standard for Next.js data fetching. |
| nuqs | useSearchParams + manual sync | Fine for 1-2 params. nuqs is worth it once you have 3+ URL params with type coercion. |
| Custom YT IFrame wrapper | react-youtube | react-youtube is 3 years stale (v10.1.0, last published 2022). Use it only if you want a quick spike; don't build production chapter logic on it. |
| Custom YT IFrame wrapper | react-player | react-player adds abstraction that fights against programmatic YouTube API control. The existing chapter bugs are partly caused by this mismatch. |
| Postgres FTS (tsvector) | Algolia / Typesense | Use Algolia if search becomes a core differentiator, you need typo-tolerance, or the dataset grows beyond ~100k documents. At 50 users, Postgres FTS is sufficient and free. |
| Supabase Realtime | Pusher / Ably | External pub/sub services cost money and add a third-party dependency. Supabase Realtime is already in the infrastructure. |
| bcrypt (native) | bcryptjs | bcryptjs if you need a pure-JS fallback with zero native compilation. Acceptable but slower. |
| bcrypt (native) | @node-rs/bcrypt | @node-rs/bcrypt (Rust binding) is faster still, but has smaller ecosystem and less community validation. Standard bcrypt is fine. |
| Vitest | Jest | Jest remains valid but has slower startup with ESM. Vitest is the community direction for new Next.js projects in 2025. |
| Playwright | Cypress | Both are solid. Playwright has broader browser coverage (Safari/WebKit) and is better for testing iframe postMessage behavior — relevant for YouTube chapter E2E tests. |
| shadcn/ui | Radix UI (unstyled) | Use raw Radix if you have a custom design system team and don't want pre-styled components. For a sailing team app with one developer, shadcn/ui's defaults save significant time. |
| Upstash Redis | Vercel KV | Vercel KV is Upstash Redis under the hood. Use @upstash/ratelimit directly to avoid Vercel vendor lock-in on the rate limiting abstraction. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| react-player | Abstracts YouTube IFrame API in ways that break programmatic seek + auto-advance. The chapter transition bugs in the current codebase originate here. | Custom YT IFrame wrapper (~80 lines) |
| react-youtube v10.1.0 | Last published 2022. Unmaintained. No React 19 support verified. | Custom YT IFrame wrapper or direct IFrame API |
| bcryptjs v3 | Released 2019. Unmaintained. Pure JS is slower and the library has had no security updates in years. | bcrypt (native) or Node crypto.pbkdf2 |
| redux / @reduxjs/toolkit | Architectural overkill for a 50-user team app. Adds boilerplate and cognitive overhead for state that Zustand handles in 10 lines. | Zustand |
| Supabase Auth (built-in) | Current custom JWT + invite-code + role system cannot map cleanly to Supabase Auth without significant rework of the role model. The cost exceeds the benefit for this scale. | jose + custom JWT (fix the security gaps instead) |
| react-markdown without sanitization | XSS risk. react-markdown does not sanitize HTML by default. The current codebase is vulnerable. | Use with `rehype-sanitize` plugin, or use `remark-gfm` + explicit whitelist |
| Global window.onYouTubeIframeAPIReady | Race condition when multiple player components mount. Current bug in the codebase. | App-level YouTube API loader (singleton promise pattern in layout.tsx) |
| `as SomeType` TypeScript casts on DB responses | Silent runtime failures when DB shape changes. Root cause of the JSONB blob bugs. | Zod `.safeParse()` on all Supabase responses |
| Algolia / Typesense | Cost + complexity not justified at 50 users. Violates free-tier budget constraint. | Postgres tsvector + GIN index via Supabase |

---

## Stack Patterns by Variant

**For video pages (mobile primary):**
- Render session metadata as server component
- Mount `<VideoPlayer>` as client component (needs YouTube IFrame API)
- Mount `<CommentThread>` as client component with TanStack Query
- Use `aspect-ratio: 16/9` CSS on video container; never hardcode pixel heights
- Drive embeds: pure iframe, accept no-seek limitation, document it

**For presentation mode:**
- Queue order lives in Zustand (mutable, drag-reorderable, not server state)
- "Mark as reviewed" writes to DB via Server Action + optimistic update in TanStack Query
- Active item URL param via nuqs so captain can share the current slide URL
- Reference video pullup: shadcn Sheet/Drawer component, lazy-loaded

**For search:**
- Add `fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(field1,'') || ' ' || coalesce(field2,''))) STORED` to: `session_videos`, `comments`, `articles`, `qa_posts`
- GIN index on each fts column
- Single API endpoint `/api/search?q=&types=videos,comments,articles` — query each table, merge + rank results by `ts_rank`
- nuqs manages the `q` and `types` URL params so search state is shareable

**For notifications:**
- Table: `notifications (id uuid, user_id uuid, type text, payload jsonb, read_at timestamptz, created_at timestamptz)`
- Write from: comment reply handler, @mention parser, captain response handler
- Read: TanStack Query, fetched on mount, badge = `count(*)` where `read_at IS NULL`
- Realtime: Add Supabase Realtime subscription in phase 2 if polling feels laggy

**For auth security (rewrite must fix):**
- Zod-validate JWT payload shape; reject malformed tokens (no defaulting to captain)
- Upstash rate limiting on `/api/auth/login` (5 attempts per IP per 15 minutes)
- Captain login should hash the captain password with bcrypt at startup (not plaintext env var comparison)
- Add CSRF protection via `SameSite=Strict` cookie + `Origin` header check on mutations

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.x | React 19.x | Required pair. Do not mix React 18 with Next.js 15. |
| TanStack Query ^5.0 | React 19.x | v5 supports React 19. v4 does not — do not use v4. |
| Zustand ^5.0 | React 19.x | Zustand v5 rewrote internals for React 19 concurrent mode. Do not use v4 with React 19. |
| shadcn/ui (CLI) | Tailwind 3.4.x | shadcn has limited Tailwind v4 support in 2026; wait for stable v4 migration guide. |
| nuqs ^2.x | Next.js 15 App Router | nuqs v2 has explicit Next.js 15 App Router support. v1 does not. |
| @upstash/ratelimit ^2.x | Vercel Edge + Node.js | Works in both runtimes. Confirm UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars are set. |
| Playwright ^1.x | Next.js 15 | Official support. Use `next/experimental-jest-environment` alternative is not needed — Playwright runs against the actual dev/test server. |
| Vitest ^2.x | React 19 + Next.js 15 | Vitest cannot test async Server Components. Use Playwright for those paths. Client components and utility functions are fully testable with Vitest. |

---

## Sources

- WebSearch: State management in 2025 — Zustand vs Jotai vs Context (MEDIUM confidence; multiple community sources agree)
- WebSearch: nuqs at React Advanced 2025 — used by Vercel, Supabase, Sentry (MEDIUM confidence; InfoQ + official nuqs.dev)
- WebSearch: TanStack Query v5 + Next.js 15 App Router integration (HIGH confidence; official TanStack docs)
- WebSearch: react-youtube npm — last published 2022, v10.1.0, no recent updates (HIGH confidence; npm registry)
- WebSearch: react-player maintenance transferred to Mux (MEDIUM confidence; multiple sources confirm)
- WebSearch: Supabase Realtime with Next.js 15 — official Supabase docs pattern (HIGH confidence; official docs)
- WebSearch: Supabase tsvector + GIN full text search — official Supabase docs (HIGH confidence; official docs)
- WebSearch: Vitest vs Jest for Next.js 15 — official Next.js testing docs recommend Vitest (HIGH confidence; nextjs.org/docs)
- WebSearch: shadcn/ui recommendation for Tailwind + Next.js projects — community consensus (MEDIUM confidence)
- WebSearch: Upstash rate limiting — official Upstash + Vercel template (HIGH confidence; official docs)
- WebSearch: papaparse RFC 4180 compliant, Node.js + browser support (HIGH confidence; official papaparse docs)
- WebSearch: bcryptjs unmaintained v3 from 2019 (MEDIUM confidence; npm page + community posts)
- WebSearch: Zod v3 ecosystem standard; v4 in beta (MEDIUM confidence; community sources)

---

*Stack research for: TheoryForm — team video review platform rewrite*
*Researched: 2026-03-10*
