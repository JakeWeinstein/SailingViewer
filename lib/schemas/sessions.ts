import { z } from 'zod'

export const CreateSessionSchema = z.object({
  label: z.string().min(1, 'Label is required').max(200, 'Label is too long').trim(),
})

export type CreateSession = z.infer<typeof CreateSessionSchema>

export const CloseSessionSchema = z.object({
  next_label: z.string().trim().optional(),
})

export type CloseSession = z.infer<typeof CloseSessionSchema>

export const AddVideoSchema = z.object({
  youtube_url: z.string().min(1, 'youtube_url is required'),
})

export type AddVideo = z.infer<typeof AddVideoSchema>
