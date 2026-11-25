import { z } from 'zod'
import { emailSchema, onboardingSchema, passwordSchema } from '../auth/schemas.ts'

export const preferenceSettingsSchema = onboardingSchema.extend({
  theme: z.enum(['warm', 'rose', 'lavender']),
  notificationsEnabled: z.boolean(),
  musicEnabled: z.boolean(),
  showOnlineStatus: z.boolean(),
  shareActivity: z.boolean(),
})

export const settingsActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile'), fullName: z.string().trim().min(2).max(80) }),
  z.object({ action: z.literal('email'), email: emailSchema, currentPassword: z.string().min(1).max(128) }),
  z.object({ action: z.literal('password'), currentPassword: z.string().min(1).max(128), password: passwordSchema, confirmPassword: z.string() })
    .refine((value) => value.password === value.confirmPassword, { message: 'Your passwords do not match.', path: ['confirmPassword'] }),
  z.object({ action: z.literal('preferences'), preferences: preferenceSettingsSchema }),
  z.object({ action: z.literal('delete-account'), currentPassword: z.string().min(1).max(128), confirmation: z.literal('DELETE MY ACCOUNT') }),
])
