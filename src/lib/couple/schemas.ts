import { z } from 'zod'

export const coupleActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), consentPolicy: z.literal(true) }),
  z.object({ action: z.literal('regenerate') }),
  z.object({ action: z.literal('preview-token'), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  z.object({ action: z.literal('accept-token'), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), consentPolicy: z.literal(true) }),
  z.object({ action: z.literal('preview-code'), code: z.string().trim().min(10).max(16).refine((value) => /^[A-HJ-NP-Z2-9]{10}$/.test(value.replace(/[\s-]/g, '').toUpperCase())) }),
  z.object({ action: z.literal('accept-code'), code: z.string().trim().min(10).max(16).refine((value) => /^[A-HJ-NP-Z2-9]{10}$/.test(value.replace(/[\s-]/g, '').toUpperCase())), consentPolicy: z.literal(true) }),
  z.object({ action: z.literal('decline-token'), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  z.object({ action: z.literal('decline-code'), code: z.string().trim().min(10).max(16).refine((value) => /^[A-HJ-NP-Z2-9]{10}$/.test(value.replace(/[\s-]/g, '').toUpperCase())) }),
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('withdraw') }),
  z.object({ action: z.literal('disconnect') }),
])

export type CoupleAction = z.infer<typeof coupleActionSchema>
