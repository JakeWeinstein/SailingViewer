// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  getTokenPayload: vi.fn(),
  COOKIE_NAME: 'tf_session',
}))

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/search')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString(), { method: 'GET' })
}

const MOCK_RESULTS = [
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    type: 'video',
    title: 'Upwind mark rounding drill',
    snippet: 'Upwind mark rounding drill',
    url_hint: '550e8400-e29b-41d4-a716-446655440020',
    rank: 0.9,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440030',
    type: 'comment',
    title: 'Alice',
    snippet: '[1:30] Good upwind tack technique',
    url_hint: '550e8400-e29b-41d4-a716-446655440010',
    rank: 0.7,
    created_at: '2026-03-02T00:00:00Z',
  },
]

describe('GET /api/search (CONT-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns results from search_all RPC', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.rpc).mockResolvedValue({ data: MOCK_RESULTS, error: null } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ q: 'upwind' })
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(2)
    expect(data[0].type).toBe('video')
    expect(data[1].type).toBe('comment')

    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('search_all', {
      search_query: 'upwind',
      result_limit: 20,
    })
  })

  it('validates q parameter is present and non-empty', async () => {
    const { GET } = await import('./route')

    // Missing q
    const req = makeGetRequest({})
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('respects limit parameter', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ q: 'tack', limit: '5' })
    await GET(req)

    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('search_all', {
      search_query: 'tack',
      result_limit: 5,
    })
  })

  it('returns empty array for no matches', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ q: 'xyznonexistent' })
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual([])
  })

  it('does not require authentication', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.rpc).mockResolvedValue({ data: MOCK_RESULTS, error: null } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ q: 'upwind' })
    const res = await GET(req)

    // Should succeed without auth
    expect(res.status).toBe(200)
  })

  it('returns 500 when RPC fails', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ q: 'upwind' })
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
