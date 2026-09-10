export type Tool = 'LH' | 'RH' | 'LF' | 'RF' | 'MOVE'

export interface MoveStep {
  id: string
  type: Tool
  x: number
  y: number
  endX?: number
  endY?: number
  order: number
  note: string
}

export interface Reflection {
  surprised: string
  misread: string
  noticed: string
  hintImpact: string
}

export interface Attempt {
  predictedBeta: MoveStep[]
  actualBeta: MoveStep[]
  hintLevelUsed: number
  confidenceBefore: number
  confidenceAfter: number
  reflection: Reflection
}

export interface Route {
  id: string
  title: string
  image: string
  grade: string
  notes: string
  insight: string
  accent: string
  hints: string[]
}

export type Screen = 'home' | 'library' | 'workspace' | 'compare' | 'research' | 'about'
