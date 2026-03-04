import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export type Session = {
  id: string
  label: string
  videos: import('./types').SessionVideo[]
  is_active: boolean
  created_at: string
}

export type Comment = {
  id: string
  session_id: string | null
  video_id: string | null
  video_title: string | null
  author_name: string
  timestamp_seconds: number | null
  comment_text: string
  send_to_captain: boolean
  created_at: string
  parent_id: string | null
  reply_count?: number
}

export type User = {
  id: string
  username: string
  display_name: string
  role: 'captain' | 'contributor'
  created_at: string
}
