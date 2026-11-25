import 'server-only'

import { z } from 'zod'

export function serviceRoleKey() { return z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY) }
export function brevoEnv() {
  return z.object({
    BREVO_API_KEY: z.string().min(1),
    BREVO_SENDER_EMAIL: z.string().email(),
    BREVO_SENDER_NAME: z.string().min(1).default('Shuvia'),
  }).parse(process.env)
}
export function authFlowSecret() { return z.string().min(32).parse(process.env.AUTH_FLOW_SECRET) }
export function siteUrl() { return z.string().url().parse(process.env.NEXT_PUBLIC_SITE_URL) }
