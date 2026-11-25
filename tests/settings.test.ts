import assert from 'node:assert/strict'
import test from 'node:test'
import { settingsActionSchema } from '../src/lib/settings/schemas.ts'

test('settings accept scoped profile, email, and preference changes', () => {
  assert.equal(settingsActionSchema.safeParse({ action: 'profile', fullName: '  Shubham Verma  ' }).data?.action, 'profile')
  assert.equal(settingsActionSchema.safeParse({ action: 'email', email: ' NEW@example.com ', currentPassword: 'current' }).success, true)
  assert.equal(settingsActionSchema.safeParse({ action: 'preferences', preferences: {
    expectations: ['Build a stronger connection'], relationshipType: 'Long-distance', interestedActivities: ['Love notes'], discoverySource: 'Friends',
    theme: 'lavender', notificationsEnabled: false, musicEnabled: true, showOnlineStatus: false, shareActivity: false,
  } }).success, true)
})

test('sensitive settings require matching passwords and an exact deletion phrase', () => {
  assert.equal(settingsActionSchema.safeParse({ action: 'password', currentPassword: 'current', password: 'a sufficiently long password', confirmPassword: 'different' }).success, false)
  assert.equal(settingsActionSchema.safeParse({ action: 'delete-account', currentPassword: 'current', confirmation: 'DELETE MY ACCOUNT' }).success, true)
  assert.equal(settingsActionSchema.safeParse({ action: 'delete-account', currentPassword: 'current', confirmation: 'delete my account' }).success, false)
})
