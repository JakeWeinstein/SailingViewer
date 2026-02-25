import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import DashboardView from '@/components/DashboardView'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload) redirect('/dashboard/login')

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500 text-sm">
        Failed to load sessions: {error.message}
      </div>
    )
  }

  return (
    <DashboardView
      initialSessions={sessions ?? []}
      userRole={payload.role}
      userName={payload.userName ?? (payload.role === 'captain' ? 'Captain' : 'Contributor')}
    />
  )
}
