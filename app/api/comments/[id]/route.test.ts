import { describe, it } from 'vitest'

describe('PATCH /api/comments/[id] — review lifecycle (REV-03)', () => {
  it.todo('marks comment as reviewed with is_reviewed=true, sets reviewed_at')
  it.todo('restores comment with is_reviewed=false, clears reviewed_at')
  it.todo('rejects non-captain with 403')
  it.todo('returns 400 for invalid body')
})

describe('PATCH /api/comments/[id] — inline reply (REV-07)', () => {
  it.todo('creates reply comment with parent_id linking to original')
})
