import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedMemoryPhoto } from '../src/lib/memories/image-types.ts'
import { annualDateInYear, daysTogether, daysUntil } from '../src/lib/days/date-math.ts'

test('photo validation checks actual image signatures and the eight-megabyte limit', () => {
  const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
  const jpeg = Uint8Array.from([0xff,0xd8,0xff])
  const webp = Uint8Array.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])
  assert.equal(isAllowedMemoryPhoto(png,'image/png',png.length),true)
  assert.equal(isAllowedMemoryPhoto(jpeg,'image/jpeg',jpeg.length),true)
  assert.equal(isAllowedMemoryPhoto(webp,'image/webp',webp.length),true)
  assert.equal(isAllowedMemoryPhoto(png,'image/jpeg',png.length),false)
  assert.equal(isAllowedMemoryPhoto(new Uint8Array([1,2,3]),'image/png',3),false)
  assert.equal(isAllowedMemoryPhoto(png,'image/png',8*1024*1024+1),false)
})

test('days together and countdowns use calendar days and handle leap-day anniversaries', () => {
  const start=new Date(2020,0,1),today=new Date(2020,0,10),event=new Date(2020,0,14)
  assert.equal(daysTogether(start,today),10)
  assert.equal(daysUntil(event,today),4)
  assert.equal(daysUntil(today,today),0)
  assert.equal(annualDateInYear('2024-02-29',2025).getDate(),28)
})
