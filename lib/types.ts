export type SessionVideo = {
  id: string
  name: string
  note?: string
  noteTimestamp?: number  // seconds — captain can pin a timecode to the note
}

export function thumbnailUrl(id: string) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w400-h225`
}

export function embedUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/preview`
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
