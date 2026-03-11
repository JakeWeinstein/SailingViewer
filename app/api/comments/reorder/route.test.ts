import { describe, it } from 'vitest'

describe('PATCH /api/comments/reorder (REV-05)', () => {
  it.todo('updates sort_order for multiple comments in one request')
  it.todo('validates session_id ownership')
  it.todo('rejects non-captain with 403')
  it.todo('returns 400 for empty order array')
})
