import { NextRequest, NextResponse } from 'next/server'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { LoginSchema } from '@/lib/schemas/auth'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

function setCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { username, password } = parsed.data

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, display_name, password_hash, role, is_active')
    .eq('username', username.trim().toLowerCase())
    .single()

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const match = await bcrypt.compare(password, user.password_hash)
  if (!match) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Update last_login_at
  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)

  const token = await signToken({
    role: user.role as 'captain' | 'contributor' | 'viewer',
    userId: user.id,
    userName: user.display_name,
  })

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    },
  })
  setCookie(response, token)
  return response
}
