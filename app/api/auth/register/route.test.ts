// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}))

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Sets up the supabase mock for a typical registration flow
function mockSupabase({
  inviteCode = 'valid-code',
  existingUser = null as unknown,
  newUser = null as unknown,
} = {}) {
  return async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'app_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { value: inviteCode },
                error: null,
              }),
            }),
          }),
        } as never
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: existingUser,
                error: existingUser ? null : { message: 'Not found' },
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newUser, error: null }),
            }),
          }),
        } as never
      }
      return {} as never
    })
  }
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 with fieldErrors for missing required fields', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({})
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('Invalid input')
    expect(data.details).toBeDefined()
    expect(data.details.inviteCode).toBeDefined()
    expect(data.details.username).toBeDefined()
    expect(data.details.password).toBeDefined()
  })

  it('returns 403 for wrong invite code', async () => {
    await mockSupabase({ inviteCode: 'correct-code' })()
    const { POST } = await import('./route')
    const req = makeRequest({
      inviteCode: 'wrong-code',
      username: 'newuser',
      displayName: 'New User',
      password: 'password123',
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe('Invalid invite code')
  })

  it('returns 409 for taken username', async () => {
    await mockSupabase({
      inviteCode: 'secret',
      existingUser: { id: 'existing-user-id' },
    })()
    const { POST } = await import('./route')
    const req = makeRequest({
      inviteCode: 'secret',
      username: 'taken_user',
      displayName: 'Taken User',
      password: 'password123',
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(409)
    expect(data.error).toBe('Username already taken')
  })

  it('returns 201 with user object and sets tf_session cookie on valid registration', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$12$hashedpassword' as never)
    await mockSupabase({
      inviteCode: 'secret',
      existingUser: null,
      newUser: {
        id: '550e8400-e29b-41d4-a716-446655440010',
        username: 'newuser',
        display_name: 'New User',
        role: 'viewer',
      },
    })()
    const { POST } = await import('./route')
    const req = makeRequest({
      inviteCode: 'secret',
      username: 'newuser',
      displayName: 'New User',
      password: 'password123',
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.user).toBeDefined()
    expect(data.user.role).toBe('viewer')
    expect(data.user.username).toBe('newuser')
    const cookies = res.headers.getSetCookie()
    expect(cookies.some((c: string) => c.startsWith('tf_session='))).toBe(true)
  })

  it('new user gets role viewer, is_seed=false, is_active=true in insert payload', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$12$hashedpassword' as never)
    const { supabase } = await import('@/lib/supabase')

    let capturedInsertData: unknown = null

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'app_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { value: 'secret' }, error: null }),
            }),
          }),
        } as never
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
          insert: vi.fn().mockImplementation((data: unknown) => {
            capturedInsertData = data
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: '550e8400-e29b-41d4-a716-446655440011',
                    username: 'sailor',
                    display_name: 'Sailor',
                    role: 'viewer',
                  },
                  error: null,
                }),
              }),
            }
          }),
        } as never
      }
      return {} as never
    })

    const { POST } = await import('./route')
    const req = makeRequest({
      inviteCode: 'secret',
      username: 'sailor',
      displayName: 'Sailor',
      password: 'password123',
    })
    await POST(req)
    expect(capturedInsertData).toMatchObject({
      role: 'viewer',
      is_active: true,
      is_seed: false,
    })
  })
})
