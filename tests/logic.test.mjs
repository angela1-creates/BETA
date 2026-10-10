import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeComparison } from '../src/compare.ts'

const step = (id, type, order) => ({ id, type, order, x: order * 10, y: order * 10, note: '' })

test('comparison counts aligned and adapted movement without judgment', () => {
  const predicted = [step('p1', 'LH', 1), step('p2', 'RF', 2), step('p3', 'RH', 3)]
  const actual = [step('a1', 'LH', 1), step('a2', 'LF', 2), step('a3', 'RH', 3)]
  assert.deepEqual(summarizeComparison(predicted, actual), {
    matches: 2,
    changed: 1,
    footEarlier: false,
    alternateSolution: false
  })
})

test('comparison notices when the climber uses a foot earlier', () => {
  const predicted = [step('p1', 'LH', 1), step('p2', 'RH', 2), step('p3', 'RF', 3)]
  const actual = [step('a1', 'LH', 1), step('a2', 'RF', 2), step('a3', 'RH', 3)]
  assert.equal(summarizeComparison(predicted, actual).footEarlier, true)
})

test('movement arrows do not inflate placement comparison counts', () => {
  const arrow = { ...step('arrow', 'MOVE', 2), endX: 40, endY: 30 }
  const predicted = [step('p1', 'LH', 1), arrow, step('p2', 'RH', 3)]
  const actual = [step('a1', 'LH', 1), step('a2', 'RH', 2)]
  const result = summarizeComparison(predicted, actual)
  assert.equal(result.matches, 2)
  assert.equal(result.changed, 0)
  assert.equal(result.alternateSolution, true)
})
