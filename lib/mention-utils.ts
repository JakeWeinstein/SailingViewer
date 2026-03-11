// mention-utils.ts — NOT server-only; shared between server routes and client rendering

import type { SupabaseClient } from '@supabase/supabase-js'

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }

/**
 * Split text into mention and text segments.
 * @mention tokens use /@([a-zA-Z0-9_]+)/g.
 * Mention segment value includes the @ prefix (e.g., "@alice").
 */
export function parseMentions(text: string): MentionSegment[] {
  if (!text) return [{ type: 'text', value: '' }]

  const segments: MentionSegment[] = []
  const regex = /@([a-zA-Z0-9_]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before this mention
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'mention', value: `@${match[1]}` })
    lastIndex = regex.lastIndex
  }

  // Remaining text after last mention
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  // If no segments were produced (no mentions, empty string), return text segment
  if (segments.length === 0) {
    segments.push({ type: 'text', value: text })
  }

  return segments
}

/**
 * Parse @username patterns in commentText, look up user IDs, and bulk-insert
 * mention notification rows. Self-mentions are filtered out.
 * Fire-and-forget safe: caller should catch errors.
 */
export async function createMentionNotifications(
  commentId: string,
  commentText: string,
  authorId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const segments = parseMentions(commentText)
  const usernames = segments
    .filter((s): s is Extract<MentionSegment, { type: 'mention' }> => s.type === 'mention')
    .map((s) => s.value.slice(1)) // strip @

  if (usernames.length === 0) return

  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .in('username', usernames)

  if (!users || users.length === 0) return

  const notifications = users
    .filter((u: { id: string; username: string }) => u.id !== authorId)
    .map((u: { id: string; username: string }) => ({
      user_id: u.id,
      type: 'mention' as const,
      source_id: commentId,
      is_read: false,
    }))

  if (notifications.length === 0) return

  await supabase.from('notifications').insert(notifications)
}

/**
 * Create a reply notification for the parent comment's author, if they are
 * not the same user as the replier.
 * Fire-and-forget safe: caller should catch errors.
 */
export async function createReplyNotification(
  commentId: string,
  parentId: string,
  authorId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: parent } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', parentId)
    .single()

  if (!parent || parent.author_id === authorId) return

  await supabase.from('notifications').insert({
    user_id: parent.author_id,
    type: 'reply',
    source_id: commentId,
    is_read: false,
  })
}

/**
 * After a captain saves a video note, create captain_response notifications
 * for distinct users who flagged (send_to_captain=true) comments on that video.
 * Fire-and-forget safe: caller should catch errors.
 */
export async function createCaptainResponseNotifications(
  sessionId: string,
  videoId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: flagged } = await supabase
    .from('comments')
    .select('id, author_id')
    .eq('send_to_captain', true)
    .eq('video_id', videoId)
    .eq('session_id', sessionId)

  if (!flagged || flagged.length === 0) return

  // Collect distinct author_ids with one representative source_id each
  const seen = new Set<string>()
  const notifications: { user_id: string; type: 'captain_response'; source_id: string; is_read: false }[] = []

  for (const comment of flagged as { id: string; author_id: string }[]) {
    if (!seen.has(comment.author_id)) {
      seen.add(comment.author_id)
      notifications.push({
        user_id: comment.author_id,
        type: 'captain_response',
        source_id: comment.id,
        is_read: false,
      })
    }
  }

  if (notifications.length === 0) return

  await supabase.from('notifications').insert(notifications)
}
