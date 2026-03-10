import { NextRequest, NextResponse } from 'next/server'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { RegisterSchema } from '@/lib/schemas/auth'
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
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { inviteCode, username, displayName, password } = parsed.data

  // Validate invite code from app_config table
  const { data: configRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'invite_code')
    .single()

  if (!configRow || configRow.value !== inviteCode) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
  }

  const cleanUsername = username.trim().toLowerCase()

  // Check username uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', cleanUsername)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      username: cleanUsername,
      display_name: displayName.trim(),
      password_hash,
      role: 'viewer',
      is_active: true,
      is_seed: false,
    })
    .select('id, username, display_name, role')
    .single()

  if (error || !newUser) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create user' }, { status: 500 })
  }

  const token = await signToken({
    role: 'viewer',
    userId: newUser.id,
    userName: newUser.display_name,
  })

  const response = NextResponse.json(
    {
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.display_name,
        role: newUser.role,
      },
    },
    { status: 201 }
  )
  setCookie(response, token)
  return response
}
