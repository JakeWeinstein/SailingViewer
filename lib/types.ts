export type SessionVideo = {
  id: string
  name: string
  note?: string
  noteTimestamp?: number  // seconds — captain can pin a timecode to the note
}

export type ReferenceVideo = {
  id: string           // DB UUID
  title: string
  type: 'drive' | 'youtube'
  video_ref: string    // Drive file ID or YouTube video ID
  note?: string
  note_timestamp?: number
  created_at: string
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
