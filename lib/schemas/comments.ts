import { z } from 'zod'

export const CreateCommentSchema = z.object({
  video_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  timestamp_seconds: z.number().nonnegative().optional(),
  comment_text: z.string().min(1, 'Comment cannot be empty').max(5000).trim(),
  send_to_captain: z.boolean().default(false),
  parent_id: z.string().uuid().optional(),
})

export type CreateComment = z.infer<typeof CreateCommentSchema>

export const EditCommentSchema = z.object({
  comment_text: z.string().min(1, 'Comment cannot be empty').max(5000).trim(),
})

export type EditComment = z.infer<typeof EditCommentSchema>

export const CommentQuerySchema = z.object({
  videoId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  captainOnly: z
    .string()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .optional(),
  type: z.enum(['qa']).optional(),
  parentId: z.string().uuid().optional(),
})

export type CommentQuery = z.infer<typeof CommentQuerySchema>
