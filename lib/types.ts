export type VideoNote = {
  text: string
  timestamp?: number  // seconds
}

export type SessionVideo = {
  id: string
  name: string
  // Legacy single-note fields (backward compat)
  note?: string
  noteTimestamp?: number
  // New: multiple notes
  notes?: VideoNote[]
}

export type ReferenceVideo = {
  id: string           // DB UUID
  title: string
  type: 'drive' | 'youtube'
  video_ref: string    // Drive file ID or YouTube video ID
  note?: string        // legacy single note
  note_timestamp?: number
  notes?: VideoNote[]  // new multiple notes
  folder_id?: string | null
  parent_video_id?: string | null  // non-null for chapter entries
  start_seconds?: number | null    // chapter start timestamp in seconds
  created_at: string
}

export type ReferenceFolder = {
  id: string
  name: string
  description?: string | null
  parent_id?: string | null
  sort_order: number
  created_at: string
}

export type ArticleBlock =
  | { type: 'text'; content: string }
  | {
      type: 'video'
      // Self-contained video info (preferred):
      videoType?: 'drive' | 'youtube'
      videoRef?: string
      title?: string
      startSeconds?: number
      // Legacy: look up from reference_videos table:
      referenceVideoId?: string
      caption?: string
    }

export type Article = {
  id: string
  title: string
  author_id?: string | null
  author_name: string
  blocks: ArticleBlock[]
  is_published: boolean
  folder_id?: string | null
  created_at: string
  updated_at: string
}

export function thumbnailUrl(id: string) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w400-h225`
}

export function embedUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/preview`
}

export function youtubeThumbnailUrl(id: string) {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`
}

export function youtubeEmbedUrl(id: string, startSeconds?: number) {
  return startSeconds
    ? `https://www.youtube.com/embed/${id}?start=${startSeconds}`
    : `https://www.youtube.com/embed/${id}`
}

/** Parse a human-entered timestamp (H:MM:SS, M:SS, MM:SS, or raw seconds) into total seconds */
export function parseTimestamp(input: string): number | null {
  const parts = input.trim().replace(/s$/, '').split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}

/** Format seconds into a human-readable timestamp string */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Extract a Drive file ID from a share URL or raw ID string */
export function extractDriveFileId(input: string): string | null {
  const s = input.trim()
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s
  return null
}

/** Extract YouTube video ID and optional start time from a URL */
export function extractYouTubeInfo(input: string): { id: string; startSeconds?: number } | null {
  const s = input.trim()

  let startSeconds: number | undefined
  const tMatch = s.match(/[?&]t=(\d+)/)
  if (tMatch) startSeconds = parseInt(tMatch[1])
  const startMatch = s.match(/[?&]start=(\d+)/)
  if (startMatch) startSeconds = parseInt(startMatch[1])

  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return { id: short[1], startSeconds }

  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watch) return { id: watch[1], startSeconds }

  const embed = s.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embed) return { id: embed[1], startSeconds }

  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return { id: s, startSeconds }

  return null
}
