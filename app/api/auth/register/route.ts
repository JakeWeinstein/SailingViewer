import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { inviteCode, username, displayName, password } = await req.json()

  if (!inviteCode || inviteCode !== process.env.INVITE_CODE) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
  }

  if (!username?.trim() || !displayName?.trim() || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const cleanUsername = username.trim().toLowerCase()

  // Check uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', cleanUsername)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const { error } = await supabase.from('users').insert({
    username: cleanUsername,
    display_name: displayName.trim(),
    password_hash,
    role: 'contributor',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
