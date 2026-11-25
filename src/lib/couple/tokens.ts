import 'server-only'

import { createHash, createHmac, randomBytes } from 'node:crypto'
import { authFlowSecret } from '@/lib/server-env'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createInvitationToken() { return randomBytes(32).toString('base64url') }

export function createInvitationCode() {
  const bytes = randomBytes(10)
  const raw = Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join('')
  return `${raw.slice(0, 5)}-${raw.slice(5)}`
}

export function hashInvitationToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('That invitation link is invalid.')
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeInvitationCode(value: string) {
  const normalized = value.replace(/[\s-]/g, '').toUpperCase()
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(normalized)) throw new Error('Enter the 10-character invitation code.')
  return normalized
}

export function hashInvitationCode(code: string) {
  return createHmac('sha256', authFlowSecret()).update(normalizeInvitationCode(code)).digest('hex')
}
