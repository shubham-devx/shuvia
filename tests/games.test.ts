import assert from 'node:assert/strict'
import test from 'node:test'
import { categories, gameCatalog, promptBank } from '../src/lib/games/bank.ts'

test('every listed game has a non-repeating curated deck for each selectable mood', () => {
  const contentCategories = categories.filter((category) => category.id !== 'mixed')
  for (const game of gameCatalog) {
    const prompts = promptBank[game.id]
    assert.equal(prompts.length, 10, `${game.name} should have ten curated prompts`)
    assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length, `${game.name} prompt IDs should be unique`)
    for (const category of contentCategories) {
      assert.equal(prompts.filter((prompt) => prompt.category === category.id).length, 2, `${game.name} should include ${category.label} prompts`)
    }
  }
})

test('the answer pattern and choice cards are defined for their game rules', () => {
  assert.equal(gameCatalog.find((game) => game.id === 'truth-or-dare')?.answerMode, 'turn')
  assert.equal(gameCatalog.find((game) => game.id === 'how-well-do-you-know-me')?.answerMode, 'guess')
  assert.equal(gameCatalog.find((game) => game.id === 'guess-my-answer')?.answerMode, 'guess')
  for (const gameId of ['would-you-rather', 'this-or-that'] as const) {
    assert.ok(promptBank[gameId].every((prompt) => prompt.kind === 'choice' && prompt.optionA && prompt.optionB))
  }
  assert.ok(promptBank['emoji-love-challenge'].every((prompt) => prompt.kind === 'emoji'))
  for (const category of categories.filter((item) => item.id !== 'mixed')) {
    const truthOrDare = promptBank['truth-or-dare'].filter((prompt) => prompt.category === category.id)
    assert.deepEqual(new Set(truthOrDare.map((prompt) => prompt.kind)), new Set(['truth','dare']))
  }
})

test('the mixed deck includes all moods without repeating a prompt', () => {
  for (const game of gameCatalog) {
    const prompts = promptBank[game.id]
    assert.equal(new Set(prompts.map((prompt) => prompt.category)).size, 5)
  }
})
