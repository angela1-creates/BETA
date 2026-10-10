import type { MoveStep } from './types'

export function summarizeComparison(predicted: MoveStep[], actual: MoveStep[]) {
  const predictedMoves = predicted.filter(step => step.type !== 'MOVE')
  const actualMoves = actual.filter(step => step.type !== 'MOVE')
  const matches = predictedMoves.filter((step, index) => actualMoves[index]?.type === step.type).length
  const changed = Math.max(predictedMoves.length, actualMoves.length) - matches
  const actualFirstFoot = actualMoves.findIndex(step => step.type === 'LF' || step.type === 'RF')
  const predictedFirstFoot = predictedMoves.findIndex(step => step.type === 'LF' || step.type === 'RF')

  return {
    matches,
    changed,
    footEarlier: actualFirstFoot >= 0 && predictedFirstFoot >= 0 && actualFirstFoot < predictedFirstFoot,
    alternateSolution: actual.length !== predicted.length
  }
}
