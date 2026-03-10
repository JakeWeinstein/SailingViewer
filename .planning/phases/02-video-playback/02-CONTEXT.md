# Phase 2: Video Playback - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Reliable YouTube-based video playback on mobile and desktop, with chapter navigation and multi-part video transitions. This phase replaces all Google Drive embeds with YouTube, integrates the YouTube Data API for auto-importing practice videos, and leverages the YouTube IFrame API for programmatic timecode access.

</domain>

<decisions>
## Implementation Decisions

### Video Storage — All-in on YouTube
- Drop Google Drive embeds entirely — all video content (practice AND reference) is YouTube-only
- Practice videos uploaded as unlisted YouTube videos on a team channel
- Reference library also switches to YouTube-only (existing Drive reference videos will need re-adding as YouTube links)
- This eliminates the iOS Safari Drive embed blocking issue entirely (the #1 known blocker from Phase 1)
- YouTube handles adaptive bitrate, transcoding, and universal device support

### Auto-Import via YouTube Data API
- YouTube Data API v3 with OAuth — captain authorizes once, app discovers new uploads automatically
- App reads the channel's "uploads" playlist to find new unlisted videos
- Requires Google Cloud project with YouTube Data API enabled + OAuth consent screen
- Free tier: 10,000 quota units/day (listing videos costs ~1-3 units per call — more than sufficient)
- New uploads auto-create a new session (named by upload date); captain can rename/reorganize after
- Polling frequency and implementation details are Claude's discretion

### Timestamped Comments
- YouTube IFrame API `getCurrentTime()` enables auto-capture of current playback time
- Default behavior: posting a comment auto-attaches the current timestamp
- User can clear the timestamp if the comment isn't time-specific, or manually edit it
- This replaces the current manual-entry-only timestamp workflow — major UX improvement

### Player Layout — Modal Overlay
- Keep current modal overlay pattern: full-screen modal with video left (65%) + sidebar right (35%)
- On mobile, stacks vertically (video on top, sidebar below)
- Escape key and backdrop click to close (existing behavior)

### Chapter Navigation — Vertical List
- Chapters displayed as a vertical stacked list in the sidebar (replacing current pill buttons)
- Each entry shows chapter title, timestamp, and optional description
- Active chapter highlighted
- Handles many chapters better than pills, which get crowded beyond 3-8

### Mobile Experience — Auto-Fullscreen
- Opening a video on mobile (375px) triggers auto-fullscreen via YouTube API
- Tap to exit fullscreen back to the comments/chapters view
- YouTube's native mobile controls handle the in-player experience

### Claude's Discretion
- YouTube API polling frequency and error retry strategy
- OAuth token refresh flow implementation
- Session auto-naming format (date-based, but exact format flexible)
- Chapter list styling and active chapter highlight treatment
- Loading states during YouTube video processing
- Error handling for API quota limits or OAuth expiration
- Player keyboard shortcuts
- Playback speed and quality controls (YouTube provides these natively)
- Migration approach for existing Drive-based data

</decisions>

<specifics>
## Specific Ideas

- The primary motivation for the YouTube switch is programmatic timecode access — `getCurrentTime()` enables one-tap timestamped comments instead of manual entry, which is the core interaction for team members reviewing practice videos
- YouTube's IFrame API also enables chapter auto-tracking (detect which chapter is playing) and multi-video auto-advance (detect video end to transition to next part)
- The Google Sheet import pipeline can be simplified or replaced — captain just uploads to YouTube and the app discovers videos automatically

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VideoWatchView.tsx`: YouTube IFrame API integration already exists (YTPlayer type, script loading, `getCurrentTime()` polling, `seekTo()`, multi-video postMessage listener). Needs refactoring but core patterns are reusable.
- `lib/types.ts`: `youtubeEmbedUrl()`, `youtubeThumbnailUrl()`, `parseTimestamp()`, `formatTime()`, `extractYouTubeInfo()` — all directly reusable
- Comment composer with timestamp input — adapt to use auto-capture instead of manual entry

### Established Patterns
- YouTube IFrame API script loading with `onYouTubeIframeAPIReady` callback
- Chapter auto-tracking via 1-second `getCurrentTime()` polling interval
- Multi-video chapter transitions via `postMessage` listener for `onStateChange` events
- Modal overlay with backdrop click/Escape close
- Tailwind + clsx conditional styling

### Integration Points
- `session_videos` table (`drive_file_id` column) — needs to become YouTube video ID field or renamed
- `reference_videos` table (`type` column currently 'drive' | 'youtube', `video_ref` column) — simplifies to YouTube-only
- OAuth token storage — new requirement, needs secure server-side storage
- YouTube Data API polling — new server-side cron or on-demand endpoint
- `app/api/import-sheet/route.ts` — replaced by YouTube API auto-import

</code_context>

<deferred>
## Deferred Ideas

- YouTube Data API auto-import could be enhanced later with playlist-based organization (map YouTube playlists to sessions)
- Manual URL paste as a simpler fallback import method (if org restricts YouTube API like they did Drive API)
- Picture-in-picture mode for watching while browsing other content

</deferred>

---

*Phase: 02-video-playback*
*Context gathered: 2026-03-10*
