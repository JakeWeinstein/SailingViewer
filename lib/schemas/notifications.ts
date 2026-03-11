import { z } from 'zod'

export const MarkReadSchema = z
  .object({
    id: z.string().uuid().optional(),
    markAll: z.boolean().optional(),
  })
  .refine((data) => data.id || data.markAll, {
    message: 'Provide id or markAll',
  })

export type MarkRead = z.infer<typeof MarkReadSchema>
