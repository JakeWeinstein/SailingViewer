import { z } from 'zod'

export const CreateReferenceVideoSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  type: z.literal('youtube'),
  video_ref: z.string().min(1, 'video_ref is required').trim(),
  tags: z.array(z.string()).default([]),
  note_timestamp: z.number().optional(),
  folder_id: z.string().uuid().optional().nullable(),
  parent_video_id: z.string().uuid().optional().nullable(),
  start_seconds: z.number().nonnegative().optional().nullable(),
})

export type CreateReferenceVideo = z.infer<typeof CreateReferenceVideoSchema>

export const UpdateReferenceVideoSchema = z.object({
  title: z.string().min(1).trim().optional(),
  type: z.literal('youtube').optional(),
  video_ref: z.string().min(1).trim().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional().nullable(),
  noteTimestamp: z.number().optional().nullable(),
  notes: z.array(z.object({ text: z.string(), timestamp: z.number().optional() })).optional(),
  folder_id: z.string().uuid().optional().nullable(),
  parent_video_id: z.string().uuid().optional().nullable(),
  start_seconds: z.number().nonnegative().optional().nullable(),
})

export type UpdateReferenceVideo = z.infer<typeof UpdateReferenceVideoSchema>

export const TagFilterSchema = z.object({
  tags: z.string().optional(), // comma-separated tag string
  allTags: z.string().optional(), // "true" to fetch all unique tags
})

export type TagFilter = z.infer<typeof TagFilterSchema>
