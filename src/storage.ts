import type { Attempt } from './types'

const KEY = 'beta-attempts-v1'

export function loadAttempts(): Record<string, Attempt> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') }
  catch { return {} }
}

export function saveAttempts(attempts: Record<string, Attempt>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(attempts))
    return true
  } catch {
    return false
  }
}
