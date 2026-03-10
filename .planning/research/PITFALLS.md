# Pitfalls Research

**Domain:** Team video review platform — Google Drive + YouTube embeds, timestamped comments, role-based access, weekly review queue workflow
**Researched:** 2026-03-10
**Confidence:** HIGH (most pitfalls drawn directly from current codebase analysis + confirmed by web research)

---

## Critical Pitfalls

### Pitfall 1: YouTube IFrame API Global Callback Overwrite

**What goes wrong:**
`window.onYouTubeIframeAPIReady` is a single global function. If two video components mount before the YouTube script finishes loading, the second component's assignment overwrites the first. The first component's player never initializes. This is the root cause of the current multi-video chapter transition failures — the player reference becomes stale or undefined.

**Why it happens:**
Developers follow the YouTube IFrame API quickstart, which assumes one player per page. The global callback pattern breaks silently when React mounts multiple component instances.

**How to avoid:**
Move YouTube API loading to a single app-level singleton (e.g., `lib/youtube.ts`) that maintains a callback queue. Components register a callback; the singleton resolves all queued callbacks when the API loads. Use `YT.ready()` (the undocumented but stable ready hook) rather than `onYouTubeIframeAPIReady` in components. Expose a `loadYouTubeAPI(): Promise<typeof YT>` utility that components await.

**Warning signs:**
- Player initializes on first page load but not after navigation
- Second video on the same page never plays
- Console shows `YT is not defined` intermittently
- `onYouTubeIframeAPIReady` defined in multiple files

**Phase to address:**
Video player foundation phase (earliest phase touching YouTube playback)

---

### Pitfall 2: Google Drive Embed Reliability is Not Guaranteed

**What goes wrong:**
Google Drive embeds using `/file/d/{id}/preview` work until they don't. Google has set `X-Frame-Options: SAMEORIGIN` on some Drive responses, `Content-Security-Policy` restrictions have tightened, and 403 errors surface intermittently — especially when share permissions change or accounts are audited. There is no Google-supported SLA for third-party iframe embedding.

**Why it happens:**
The organization prohibits the Drive API, so the app depends on publicly sharable preview URLs. These URLs are not a documented embedding product — they are a side effect of the Drive file viewer. Google has broken them before without announcement.

**How to avoid:**
- Build a fallback state: detect iframe load failure (`onError`, `load` event with `contentDocument` check) and show a "Open in Drive" link rather than a blank frame
- Never assume an embed will load — design the UI around the possibility it won't
- Store the raw Drive file ID separately from any embed URL so the URL pattern can be updated without a data migration
- Document that Drive embed reliability is outside the app's control and set team expectations accordingly

**Warning signs:**
- Videos load on one device but not another
- "Refused to display in a frame" console errors
- Blank iframes with no error state shown to user
- Team reports videos "disappeared" after a practice session

**Phase to address:**
Video player foundation phase — embed fallback must ship with the player, not be added later

---

### Pitfall 3: iOS Safari Breaks Video in Iframes Differently Than Every Other Platform

**What goes wrong:**
iOS Safari does not support the Fullscreen API for non-native elements. Google Drive iframes on iOS Safari frequently fail to play at all (reported by multiple users as a known issue since 2019). YouTube embeds require `playsinline=1` or they attempt to launch the native YouTube app instead of playing inline. The combination of Drive embeds + iOS + third-party cookies blocked is the most common failure mode for team members watching on phones.

**Why it happens:**
Apple's platform policies restrict autoplay, fullscreen from iframes, and cross-origin media. Third-party cookie blocking (on by default in Safari) can prevent Drive from reading auth state, causing 403s on video requests even for publicly shared files.

**How to avoid:**
- Always include `allow="autoplay; fullscreen; picture-in-picture"` on Drive iframes
- Always include `playsinline=1` in YouTube embed URLs
- Test Drive embed playback specifically on iOS Safari with "Prevent Cross-Site Tracking" enabled — this is the default setting
- Accept that Drive video playback on iOS Safari will have a measurably lower success rate than other platforms; expose a prominent "Open in Drive" escape hatch
- Do not attempt to replicate native video controls inside the iframe — they are unreachable from JavaScript on iOS

**Warning signs:**
- QA passes on desktop but team members report broken videos from phones
- Blank Drive iframes specifically on iOS, working on Android
- YouTube videos open the YouTube app instead of playing in the page
- No error is thrown — the iframe simply renders empty

**Phase to address:**
Video player foundation phase — must be explicitly tested on iOS Safari before any phase is marked complete

---

### Pitfall 4: JSONB Video Storage Makes Queries Impossible and Migration Painful

**What goes wrong:**
`sessions.videos` as a JSONB array means: you cannot query "which sessions contain video X", you cannot add a foreign key from comments to videos, you cannot paginate videos within a session, and any schema change to the video shape requires an application-level migration of every session row. This is the stated root cause of the current bug-ridden codebase.

**Why it happens:**
JSONB is the easiest way to store a list of heterogeneous objects during early development. The cost only becomes apparent when you need to query or join on the contents.

**How to avoid:**
Normalize immediately in the rewrite. Create a `session_videos` table: `(id, session_id, drive_file_id, title, position, note, note_timestamp, created_at)`. This enables foreign keys from comments, efficient per-video queries, and paginated video lists. Do not use a hybrid approach — the old schema's problems came from the JSONB blob; a hybrid preserves those problems.

**Migration strategy:** Write a one-time migration script that reads each session's `videos` JSONB array and inserts rows into `session_videos`. Run it before deploying any new code that reads from the normalized table. Verify row count matches.

**Warning signs:**
- Code contains `(session.videos as SessionVideo[])` type casts
- Comments reference `video_id` as a string that must be looked up inside JSONB
- Adding a field to a video requires updating every session row
- "What session is this video in?" cannot be answered with a simple query

**Phase to address:**
Database schema phase — must be first, before any feature work. Everything else depends on clean video data.

---

### Pitfall 5: Service Role Key Leaking to the Client Bundle

**What goes wrong:**
`lib/supabase.ts` using `SUPABASE_SERVICE_ROLE_KEY` is imported by client components. Next.js App Router does not automatically prevent this — only environment variables prefixed `NEXT_PUBLIC_` are explicitly client-safe, but non-prefixed vars can still leak if imported from a module that gets bundled client-side. The service role key bypasses all Row Level Security. If it reaches the browser, the entire database is compromised.

**Why it happens:**
The distinction between server-only and client-allowed modules is not enforced by default. It requires explicit use of the `server-only` package or restricting Supabase client creation to API routes and Server Components only.

**How to avoid:**
- Add `import 'server-only'` at the top of `lib/supabase.ts` — this causes a build error if the module is accidentally imported client-side
- Create a separate `lib/supabase-client.ts` using only the anon key for any client-side usage
- All database operations go through API routes or Server Components, never directly from Client Components
- Enable RLS on all tables as a defense-in-depth layer even with API-level auth

**Warning signs:**
- `lib/supabase.ts` imported inside a `'use client'` component
- No `server-only` import in database utility files
- `SUPABASE_SERVICE_ROLE_KEY` appears in browser network DevTools responses
- RLS is disabled on tables

**Phase to address:**
Database schema + auth foundation phase — this is a security pre-requisite before any data is live

---

### Pitfall 6: JWT Role Defaulting to Captain on Malformed Tokens

**What goes wrong:**
The current auth code defaults a missing `role` claim to `'captain'`. This means any old or malformed token grants captain-level access. In a three-role rewrite (Captain / Contributor / Viewer), the default for ambiguous tokens must be the lowest privilege role, not the highest.

**Why it happens:**
A backward-compatibility shortcut for old captain tokens became a security hole. The reasoning was "old tokens were captain tokens" — but this logic breaks the moment other roles exist.

**How to avoid:**
- Reject tokens with missing or unrecognized `role` values — return 401, never default to any role
- On rewrite, all existing tokens should be invalidated (short expiry + forced re-login, or token version field)
- Validate the full shape of the token payload with a schema validator (zod) before trusting any field

**Warning signs:**
- Auth logic contains `|| 'captain'` or `?? 'captain'`
- No schema validation on decoded JWT payload
- Role check is `if role !== 'contributor'` instead of `if role === 'captain'`

**Phase to address:**
Auth foundation phase — must be resolved before any role-gated feature is built

---

### Pitfall 7: Multi-Video Chapter Transition via postMessage Polling

**What goes wrong:**
The current implementation polls `getCurrentTime()` every 1 second to detect when a video ends and advance to the next chapter. This approach has three failure modes: (1) it misses the exact end moment if the poll interval straddles it, (2) it drains battery on mobile, (3) it uses `postMessage` parsing without strict origin validation, creating a security surface.

**Why it happens:**
The YouTube IFrame API does not fire a clean "video ended" event in all contexts. Developers fall back to polling as the path of least resistance.

**How to avoid:**
- Use the `onStateChange` event with state `YT.PlayerState.ENDED` (value `0`) — this fires reliably when a video completes
- Set up the event handler during player initialization, not in a useEffect with stale closure
- For the `message` event listener used for postMessage fallback, always validate `event.origin === 'https://www.youtube.com'` before parsing
- Auto-advance logic should live in a dedicated state machine, not inline in a 900-line component

**Warning signs:**
- `setInterval` or `setTimeout` loops polling `getCurrentTime()`
- `window.addEventListener('message', ...)` without origin check
- Chapter auto-advance works intermittently on desktop, rarely on mobile
- Reports of chapters "skipping" or "getting stuck"

**Phase to address:**
Video player foundation phase — chapter advance must be event-driven from day one

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| JSONB for video list | Flexible, no migration needed early | No FK constraints, no queryability, silent type failures | Never for data that's queried or joined |
| Single global YouTube callback | Quickstart is copy-paste simple | Breaks silently with multiple players | Never in React where multiple instances are normal |
| Captain password as env var | No user table needed | Unrotatable without deploy, no rate limiting | MVP only — must migrate before real team data |
| Skip RLS, rely on API auth | Faster development, no policy writing | Service role leak = total exposure | Never when using service role key |
| Dual note formats (legacy + new) | Backward-compatible | Double the code paths, silent bugs when one path missed | Temporary only — set migration deadline at start |
| Inlining all video logic in one component | Fewer files to manage | 900-line components are untestable and unmodifiable | Never — component boundaries should be drawn from the start |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| YouTube IFrame API | Global `window.onYouTubeIframeAPIReady` in component | Singleton loader with callback queue; use `YT.ready()` in components |
| YouTube IFrame API | Relying on `getCurrentTime()` polling for end detection | Use `onStateChange` event, `YT.PlayerState.ENDED` |
| YouTube IFrame API | Not including `origin` parameter in embed URL | Always set `origin=https://yourdomain.com` to enable full postMessage API |
| Google Drive embed | Not handling load failure | `onError` + `load` event fallback; always show "Open in Drive" escape hatch |
| Google Drive embed | Building UI that requires the iframe to be interactive | Drive iframes are opaque — you cannot read playback state, time, or events from them |
| Google Drive embed | Assuming share link format is stable | Store raw file ID; reconstruct embed URL at render time from a constant template |
| Google Sheets import | Homegrown CSV parser | Use `papaparse` — handles quoted fields, CRLF, BOM, irregular columns |
| Supabase service role | Importing supabase client in client components | `import 'server-only'` in `lib/supabase.ts`; client components never touch DB directly |
| Supabase RLS | Disabling RLS in development and forgetting to re-enable | Enable RLS and write permissive dev policies instead of disabling entirely |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching reply counts as a separate RPC per comment | Review queue slow when sessions have 50+ comments | COUNT aggregate in the initial comments query with a LEFT JOIN | ~20 comments in a session |
| Loading all comments for a video with no pagination | Page hangs loading comments, memory grows | Cursor-based pagination (limit 20, load-more) | ~100 comments per video |
| 1-second polling interval on YouTube player | Battery drain on mobile, main thread jank | Event-driven (`onStateChange`), never poll | Immediately — every mobile user is affected |
| No database indexes on FK columns | Comment queries slow as team adds more videos | Indexes on `comments(video_id)`, `comments(session_id)`, `comments(parent_id)` | ~5,000 comment rows |
| Direct thumbnail URLs from Drive/YouTube CDN | Slow page load on slow connections; image not lazy-loaded | Next.js `<Image>` with `sizes`, lazy loading | Every mobile user on cellular |
| tsvector search across all columns without materialized view | Search feels slow for queries returning many results | Materialized view or stored tsvector column with GIN index; refresh on write | ~10,000 rows across comments + articles |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key reachable from client bundle | Total database compromise — bypasses all RLS | `import 'server-only'` in database modules; RLS as defense-in-depth |
| JWT role defaulting to 'captain' on missing field | Privilege escalation for anyone with an old/crafted token | Reject malformed tokens; validate payload shape with zod; never default to elevated role |
| No rate limiting on login endpoint | Brute-force captain password | Rate limiting middleware (e.g., `@upstash/ratelimit` on Vercel Edge) |
| `postMessage` from YouTube iframe without origin check | Crafted messages from malicious iframes can trigger chapter advance or seek | Always check `event.origin === 'https://www.youtube.com'` before handling |
| Comment text stored without length limits | Database row size attacks; UI overflow bugs | Server-side validation: max 2000 chars for comments, enforce at API layer with zod |
| Google Sheet import accepting arbitrary sheet IDs | Any authenticated user can exfiltrate any public Google Sheet | Not fully preventable (sheets are public); rate-limit imports per user; log all import attempts |
| No soft deletes | Data loss from accidental or malicious deletes | `deleted_at` nullable timestamp on comments, sessions, reference videos |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual indication when Drive embed fails to load | Team members think the video is loading, wait, give up — assume the content is broken | Detect iframe load failure; show "Video unavailable — open in Drive" with a direct link |
| Timestamp comment requires knowing exact seconds | Team members have to watch video, pause, read the time code, then switch to comment form | Auto-capture current playback time when user opens comment form; allow editing |
| Comment form not visible while watching video on mobile | Users must scroll away from video to comment, losing their place | Sticky comment input at bottom of screen on mobile; video stays visible above fold |
| Chapter navigation UI disappears mid-video | Users lose context of where they are in a multi-chapter session | Persistent chapter list panel or collapsible overlay that doesn't obscure video |
| Review queue has no "done reviewing" state | Captain walks through queue in presentation mode and items reappear next week | Per-item "mark reviewed" that persists to database; reviewed items filtered from active queue |
| @mention notifications with no in-app destination link | User sees badge, clicks, doesn't know where to go | Every notification links directly to the specific comment, video timestamp, or article section |
| Article video embeds use same Drive/YouTube logic | Bugs in player surface in articles too, with no fallback | Articles need the same embed fallback UX as video pages — extract shared `<EmbedBlock>` component |

---

## "Looks Done But Isn't" Checklist

- [ ] **Drive embed:** Often missing error state — verify blank iframe shows fallback link, not just blank space
- [ ] **YouTube chapter advance:** Often missing the end-of-video event on mobile — verify by watching a multi-video chapter to completion on iOS Safari
- [ ] **Timestamped comment:** Often missing time capture on mobile — verify that opening the comment form on a playing video pre-fills the current timestamp
- [ ] **Role-based access:** Often missing database-layer enforcement — verify that Viewer role cannot reach contributor API endpoints even with manually crafted requests
- [ ] **Google Sheets import:** Often missing CSV edge cases — verify import handles Drive URLs with extra query params, mixed column orders, empty rows
- [ ] **Search:** Often missing cross-table results — verify search returns comments, articles, and video titles not just sessions
- [ ] **Presentation mode:** Often missing reorder persistence — verify reordering the review queue survives a page refresh
- [ ] **Notification bell:** Often missing unread count reset — verify reading a notification clears the badge, not just opening the notifications panel
- [ ] **Mobile video:** Always test on a real iOS Safari device with default privacy settings — emulators do not reproduce Drive embed failures

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| JSONB videos discovered after features are built on top | HIGH | Write backfill migration; update all API routes to use normalized table; regression test every video feature |
| Service role key leaked to client bundle | HIGH (emergency) | Rotate service role key immediately in Supabase; force re-deploy; audit logs for unauthorized access |
| YouTube API global callback overwrite | MEDIUM | Refactor to singleton loader; replace all component-level script injection in one PR |
| Google Drive embeds blocked by policy change | MEDIUM | Add fallback link (1 day of work); communicate to team; no architectural change needed if file IDs are stored separately |
| JWT role defaulting to captain discovered in production | HIGH | Rotate AUTH_SECRET to invalidate all tokens; force re-login for all users; fix validation; re-deploy |
| Chapter auto-advance broken by YouTube API change | MEDIUM | Fall back to manual "Next Chapter" button; notify team; investigate API change |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| YouTube API global callback overwrite | Video player foundation | Two VideoPlayer components on same page both initialize correctly |
| Drive embed load failure silent | Video player foundation | Revoke share permission on a test video; confirm fallback UI appears |
| iOS Safari video failures | Video player foundation | Manual test on real iOS Safari device before phase sign-off |
| JSONB video storage | Database schema (first phase) | All video queries use `session_videos` table; no JSONB casts in codebase |
| Service role key client leak | Database schema + auth | `grep 'supabase' $(find src -name '*.tsx' -o -name '*.ts')` shows no client component imports of server-only module |
| JWT role defaulting to captain | Auth foundation | Token with no `role` field returns 401, never 200 |
| postMessage polling for chapter end | Video player foundation | `onStateChange` ENDED event fires on all tested browsers; no setInterval in player code |
| Missing Drive embed fallback | Video player foundation | UI test: embed with invalid file ID shows "Open in Drive" link |
| No pagination on comments | API layer phase | API returns 20 comments with cursor; 21st comment not loaded until scroll |
| RLS not enabled | Database schema | Supabase dashboard confirms RLS enabled on all tables; anon key cannot read protected rows |
| Google Sheets CSV parsing fragility | Import pipeline phase | Import test file with quoted commas, CRLF line endings, and empty rows — all parse correctly |

---

## Sources

- Current codebase analysis (`CONCERNS.md` — 2026-03-10): YouTube race condition, JSONB fragility, service role exposure, JWT defaulting, postMessage polling confirmed as existing issues
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference) — `onStateChange`, `YT.PlayerState.ENDED`, `origin` parameter, `onAutoplayBlocked` event
- [Google Drive X-Frame-Options blocking community reports](https://community.latenode.com/t/x-frame-options-blocking-google-drive-pdf-embedding/23291) — ongoing third-party embed reliability issues (MEDIUM confidence — community reports, not official Google documentation)
- [iOS iframe no fullscreen — Plyr issue #811](https://github.com/sampotts/plyr/issues/811) — iOS Safari fullscreen API unavailable for iframe-embedded video
- [Google Drive video not playing on iOS Safari — Apple Discussions](https://discussions.apple.com/thread/252015568) — cross-site tracking blocking Drive embeds on iOS (MEDIUM confidence)
- [Zero-Downtime JSONB Migration Guide](https://medium.com/@shinyjai2011/zero-downtime-postgresql-jsonb-migration-a-practical-guide-for-scalable-schema-evolution-9f74124ef4a1) — normalize early, hybrid model risks
- [When to Avoid JSONB — Heap Engineering](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) — always-extracted keys should be promoted to columns
- [Next.js Security: Server Components and Secret Exposure](https://nextjs.org/blog/security-nextjs-server-components-actions) — `server-only` package, client bundle leakage patterns
- [Supabase RBAC Custom Claims](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — JWT role caching, RLS policy testing
- [postMessage Security — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) — origin validation requirements
- [Supabase Full Text Search Docs](https://supabase.com/docs/guides/database/full-text-search) — tsvector, GIN indexes, multi-column search limitations

---
*Pitfalls research for: team video review platform (sailing — TheoryForm)*
*Researched: 2026-03-10*
