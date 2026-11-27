import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activityOptions,
  discoveryOptions,
  expectationOptions,
  forgotPasswordSchema,
  loginSchema,
  onboardingSchema,
  resetPasswordSchema,
  signupSchema,
} from '../src/lib/auth/schemas.ts'
import { safeInternalPath } from '../src/lib/auth/redirect.ts'
import { coupleActionSchema } from '../src/lib/couple/schemas.ts'

test('signup requires valid email, matching strong-enough passwords, and agreement', () => {
  const valid = signupSchema.safeParse({ fullName: 'Shubham Verma', email: 'SHUBHAM@example.com ', password: 'love-shuvia-2026', confirmPassword: 'love-shuvia-2026', acceptTerms: true })
  assert.equal(valid.success, true)
  if (valid.success) assert.equal(valid.data.email, 'shubham@example.com')
  assert.equal(signupSchema.safeParse({ fullName: 'S', email: 'bad', password: 'short', confirmPassword: 'different', acceptTerms: false }).success, false)
})

test('login accepts valid credentials and defaults remember-me to true', () => {
  const parsed = loginSchema.safeParse({ email: 'person@example.com', password: 'any-existing-password' })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.equal(parsed.data.rememberMe, true)
  assert.equal(loginSchema.safeParse({ email: 'bad', password: '' }).success, false)
})

test('forgot-password and reset-password validate user input', () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: 'person@example.com' }).success, true)
  assert.equal(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ password: 'new-shuvia-password', confirmPassword: 'new-shuvia-password' }).success, true)
  assert.equal(resetPasswordSchema.safeParse({ password: 'new-shuvia-password', confirmPassword: 'not-the-same' }).success, false)
})

test('onboarding allows multi-selects and validates every selected option', () => {
  assert.equal(onboardingSchema.safeParse({ expectations: [expectationOptions[0], expectationOptions[1]], relationshipType: 'Long-distance', interestedActivities: [activityOptions[0]], discoverySource: discoveryOptions[0] }).success, true)
  assert.equal(onboardingSchema.safeParse({ expectations: ['Not a Shuvia option'], relationshipType: 'Unknown', interestedActivities: [], discoverySource: null }).success, false)
})

test('auth callbacks and login only accept safe internal return paths', () => {
  assert.equal(safeInternalPath('/space?welcome=1'), '/space?welcome=1')
  assert.equal(safeInternalPath('//evil.example'), '/onboarding')
  assert.equal(safeInternalPath('/\\\\evil.example'), '/onboarding')
  assert.equal(safeInternalPath('/auth/callback'), '/onboarding')
})

test('couple actions require explicit consent and validate invitation code characters', () => {
  assert.equal(coupleActionSchema.safeParse({ action: 'create', consentPolicy: true }).success, true)
  assert.equal(coupleActionSchema.safeParse({ action: 'create' }).success, false)
  assert.equal(coupleActionSchema.safeParse({ action: 'accept-code', code: 'ABCDE-FG234', consentPolicy: true }).success, true)
  assert.equal(coupleActionSchema.safeParse({ action: 'preview-code', code: 'OOOOO-00000' }).success, false)
  assert.equal(coupleActionSchema.safeParse({ action: 'decline-code', code: 'ABCDE-FG234' }).success, true)
  assert.equal(coupleActionSchema.safeParse({ action: 'decline-token', token: 'A'.repeat(43) }).success, true)
  assert.equal(coupleActionSchema.safeParse({ action: 'regenerate' }).success, true)
  assert.equal(coupleActionSchema.safeParse({ action: 'disconnect' }).success, true)
  assert.equal(safeInternalPath('/invite/abc_123'), '/invite/abc_123')
  assert.equal(safeInternalPath('/join?code=ABCDE-FG234&resume=1'), '/join?code=ABCDE-FG234&resume=1')
})
