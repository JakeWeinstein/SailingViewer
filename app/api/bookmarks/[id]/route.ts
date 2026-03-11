import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'

// DELETE /api/bookmarks/[id] — auth required, ownership enforced
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getTokenPayload(req)
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Fetch the bookmark to verify ownership
  const { data: bookmark, error: fetchError } = await supabase
    .from('bookmarks')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (fetchError || !bookmark) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
  }

  if (bookmark.user_id !== payload.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('bookmarks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
