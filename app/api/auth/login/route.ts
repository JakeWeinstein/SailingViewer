import { NextRequest, NextResponse } from 'next/server'
import { signToken, COOKIE_NAME } from '@/lib/auth'
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
  const { password, username } = body

  // Contributor login: username + password
  if (username) {
    if (!username.trim() || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, display_name, password_hash, role')
      .eq('username', username.trim().toLowerCase())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const token = await signToken({
      role: user.role as 'captain' | 'contributor',
      userId: user.id,
      userName: user.display_name,
    })

    const response = NextResponse.json({ ok: true, role: user.role, userName: user.display_name })
    setCookie(response, token)
    return response
  }

  // Captain login: password only
  if (!password || password !== process.env.CAPTAIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await signToken({ role: 'captain', userName: 'Captain' })
  const response = NextResponse.json({ ok: true, role: 'captain', userName: 'Captain' })
  setCookie(response, token)
  return response
}
