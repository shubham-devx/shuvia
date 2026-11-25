import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseCard, chooseWheelCard, dailySurprises, isWheelCategory, wheelCategories, wheelCards } from '../src/lib/surprises/bank.ts'

test('every love wheel category has a distinct set of curated cards', () => {
  assert.equal(wheelCategories.length, 6)
  for (const category of wheelCategories) {
    assert.ok(wheelCards[category.id].length >= 5)
    assert.equal(new Set(wheelCards[category.id]).size, wheelCards[category.id].length)
    assert.ok(isWheelCategory(category.id))
  }
})

test('wheel and category selection stay within their chosen categories', () => {
  const card = chooseWheelCard((max) => max - 1)
  assert.equal(card.category, wheelCategories.at(-1)?.id)
  assert.ok(wheelCards[card.category].includes(card.text))
  assert.equal(chooseCard('compliment', () => 0), wheelCards.compliment[0])
  assert.equal(isWheelCategory('private-answer'), false)
})

test('daily surprises are nonempty and cover multiple moods', () => {
  assert.ok(dailySurprises.length >= 8)
  assert.ok(dailySurprises.every((card) => card.text.trim().length > 20))
  assert.ok(new Set(dailySurprises.map((card) => card.category)).size >= 5)
})
