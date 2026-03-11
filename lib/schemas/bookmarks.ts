import { z } from 'zod'

export const CreateBookmarkSchema = z.object({
  video_id: z.string().min(1),
  session_id: z.string().uuid().optional(),
  timestamp_seconds: z.number().nonnegative().int(),
  video_title: z.string().max(200).optional(),
})

export type CreateBookmark = z.infer<typeof CreateBookmarkSchema>
