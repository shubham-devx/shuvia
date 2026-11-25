import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128)
export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { error: 'Please agree to the Terms and Privacy Policy.' }),
}).refine((value) => value.password === value.confirmPassword, { message: 'Your passwords do not match.', path: ['confirmPassword'] })
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128), rememberMe: z.boolean().default(true) })
export const forgotPasswordSchema = z.object({ email: emailSchema })
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, { message: 'Your passwords do not match.', path: ['confirmPassword'] })

export const expectationOptions = ['Build a stronger connection', 'Have fun together', 'Make long-distance relationships exciting', 'Share romantic moments', 'Create beautiful memories', 'Explore everything'] as const
export const relationshipOptions = ['Long-distance', 'Together but living separately', 'Newly in love', 'Married', 'Just exploring together', 'Prefer not to say'] as const
export const activityOptions = ['Romantic games', 'Truth or Dare', 'Love questions', 'Virtual dates', 'Love notes', 'Shared memories'] as const
export const discoveryOptions = ['Instagram', 'Friends', 'Google', 'Other'] as const
export const onboardingSchema = z.object({
  expectations: z.array(z.enum(expectationOptions)).max(expectationOptions.length),
  relationshipType: z.enum(relationshipOptions).nullable(),
  interestedActivities: z.array(z.enum(activityOptions)).max(activityOptions.length),
  discoverySource: z.enum(discoveryOptions).nullable(),
})

export type OnboardingData = z.infer<typeof onboardingSchema>
