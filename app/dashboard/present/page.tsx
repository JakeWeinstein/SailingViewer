import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'
import PresentationMode from '@/components/PresentationMode'

export default async function PresentPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || payload.role !== 'captain') {
    redirect('/dashboard')
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, label, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Loading…
      </div>
    }>
      <PresentationMode
        sessions={sessions ?? []}
        userName={payload.userName ?? 'Captain'}
      />
    </Suspense>
  )
}
