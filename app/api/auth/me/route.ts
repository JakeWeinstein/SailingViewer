import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, username, display_name, role, is_active, must_change_password')
    .eq('id', payload.userId)
    .single()

  if (!user || !user.is_active) {
    // Clear stale cookie
    const response = NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    response.cookies.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' })
    return response
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
  })
}
