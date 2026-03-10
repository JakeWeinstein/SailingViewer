import { describe, test } from 'vitest'

// Session video API routes are updated in Plan 06.
// These stubs verify the normalized schema includes youtube_video_id.

describe('GET /api/sessions/[id]', () => {
  test.todo('GET returns session_videos with youtube_video_id field')
  test.todo('session video list includes position ordering')
})
