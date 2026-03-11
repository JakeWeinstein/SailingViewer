import { z } from 'zod'

export const CreateCommentSchema = z.object({
  video_id: z.string().min(1).optional(),
  session_id: z.string().uuid().optional(),
  timestamp_seconds: z.number().nonnegative().optional(),
  comment_text: z.string().min(1, 'Comment cannot be empty').max(5000).trim(),
  send_to_captain: z.boolean().default(false),
  parent_id: z.string().uuid().optional(),
  youtube_attachment: z.string().max(20).optional(),
})

export type CreateComment = z.infer<typeof CreateCommentSchema>

export const EditCommentSchema = z.object({
  comment_text: z.string().min(1, 'Comment cannot be empty').max(5000).trim(),
})

export type EditComment = z.infer<typeof EditCommentSchema>

export const CommentQuerySchema = z.object({
  videoId: z.string().min(1).optional(),
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

export const ReviewCommentSchema = z.object({
  is_reviewed: z.boolean(),
})

export type ReviewComment = z.infer<typeof ReviewCommentSchema>

export const ReorderSchema = z.object({
  session_id: z.string().uuid(),
  order: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int().nonnegative(),
      })
    )
    .min(1),
})

export type Reorder = z.infer<typeof ReorderSchema>

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200).trim(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>
