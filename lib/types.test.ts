import { describe, it, expect } from 'vitest'
import {
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  extractYouTubeInfo,
  formatTime,
  parseTimestamp,
} from '@/lib/types'

describe('youtubeEmbedUrl', () => {
  it('returns embed URL without start param when no startSeconds', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('returns embed URL with start param when startSeconds provided', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', 90)).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90',
    )
  })

  it('omits start param when startSeconds is 0', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', 0)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })
})

describe('youtubeThumbnailUrl', () => {
  it('returns mqdefault thumbnail URL', () => {
    expect(youtubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    )
  })
})

describe('extractYouTubeInfo', () => {
  it('parses standard watch URL', () => {
    const result = extractYouTubeInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('dQw4w9WgXcQ')
    expect(result?.startSeconds).toBeUndefined()
  })

  it('parses short youtu.be URL', () => {
    const result = extractYouTubeInfo('https://youtu.be/dQw4w9WgXcQ')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('dQw4w9WgXcQ')
  })

  it('extracts start timestamp from ?t= param', () => {
    const result = extractYouTubeInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')
    expect(result?.id).toBe('dQw4w9WgXcQ')
    expect(result?.startSeconds).toBe(42)
  })

  it('extracts start timestamp from ?start= param', () => {
    const result = extractYouTubeInfo('https://www.youtube.com/embed/dQw4w9WgXcQ?start=120')
    expect(result?.id).toBe('dQw4w9WgXcQ')
    expect(result?.startSeconds).toBe(120)
  })

  it('parses bare 11-char video ID', () => {
    const result = extractYouTubeInfo('dQw4w9WgXcQ')
    expect(result?.id).toBe('dQw4w9WgXcQ')
  })

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeInfo('https://example.com/video')).toBeNull()
  })
})

describe('formatTime', () => {
  it('formats seconds under one minute as M:SS', () => {
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(59)).toBe('0:59')
  })

  it('formats seconds over one minute as M:SS', () => {
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(600)).toBe('10:00')
  })

  it('formats seconds over one hour as H:MM:SS', () => {
    expect(formatTime(3661)).toBe('1:01:01')
    expect(formatTime(7200)).toBe('2:00:00')
  })
})

describe('parseTimestamp', () => {
  it('parses M:SS format', () => {
    expect(parseTimestamp('1:30')).toBe(90)
    expect(parseTimestamp('0:05')).toBe(5)
  })

  it('parses MM:SS format', () => {
    expect(parseTimestamp('10:00')).toBe(600)
  })

  it('parses H:MM:SS format', () => {
    expect(parseTimestamp('1:01:01')).toBe(3661)
  })

  it('parses raw seconds as integer', () => {
    expect(parseTimestamp('90')).toBe(90)
  })

  it('strips trailing s suffix', () => {
    expect(parseTimestamp('90s')).toBe(90)
  })

  it('returns null for non-numeric input', () => {
    expect(parseTimestamp('abc')).toBeNull()
  })
})
