import { z } from 'zod'

export const TokenPayloadSchema = z.object({
  role: z.enum(['captain', 'contributor', 'viewer']),
  userId: z.string().uuid(),
  userName: z.string().min(1),
})

export type TokenPayload = z.infer<typeof TokenPayloadSchema>

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  password: z.string().min(1, 'Password is required'),
})

export const RegisterSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, and underscores only'),
  displayName: z.string().min(1, 'Display name is required').max(50),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
