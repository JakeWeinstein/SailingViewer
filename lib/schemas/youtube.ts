import { z } from 'zod'

// ─── Import response ──────────────────────────────────────────────────────────

export const ImportResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  sessions_created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
})

export type ImportResponse = z.infer<typeof ImportResponseSchema>

// ─── Status response ──────────────────────────────────────────────────────────

export const YouTubeStatusSchema = z.discriminatedUnion('connected', [
  z.object({
    connected: z.literal(true),
    channelId: z.string(),
  }),
  z.object({
    connected: z.literal(false),
  }),
])

export type YouTubeStatus = z.infer<typeof YouTubeStatusSchema>
