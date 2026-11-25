import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { authFlowSecret } from '@/lib/server-env'

const COOKIE_NAME = 'shuvia_recovery_flow'
const MAX_AGE_SECONDS = 10 * 60

function signature(value: string) {
  return createHmac('sha256', authFlowSecret()).update(value).digest('hex')
}

export function recoveryCookieName() { return COOKIE_NAME }
export function recoveryCookieValue() {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  return `${timestamp}.${signature(timestamp)}`
}
export function validRecoveryCookie(value?: string) {
  if (!value) return false
  const [timestamp, supplied] = value.split('.')
  if (!timestamp || !supplied || !/^\d+$/.test(timestamp)) return false
  const age = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (age < 0 || age > MAX_AGE_SECONDS) return false
  let expected: string
  try { expected = signature(timestamp) } catch { return false }
  const left = Buffer.from(supplied, 'hex')
  const right = Buffer.from(expected, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}
export const recoveryCookieMaxAge = MAX_AGE_SECONDS
