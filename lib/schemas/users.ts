import { z } from 'zod'

export const UpdateRoleSchema = z.object({
  role: z.enum(['captain', 'contributor', 'viewer']),
})

export const UpdateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(50).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false
      return true
    },
    { message: 'Current password required to set new password' }
  )

export const ResetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8),
})
