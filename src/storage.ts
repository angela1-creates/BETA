import type { Attempt } from './types'

const KEY = 'beta-attempts-v1'
const DIRTY_KEY = 'beta-attempts-dirty-v1'

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

export function loadDirtyAttemptIds(attempts: Record<string, Attempt>) {
  try {
    const saved = localStorage.getItem(DIRTY_KEY)
    if (saved === null) return new Set(Object.keys(attempts))
    return new Set<string>(JSON.parse(saved))
  } catch {
    return new Set(Object.keys(attempts))
  }
}

export function markAttemptDirty(routeId: string) {
  const dirty = loadDirtyAttemptIds(loadAttempts())
  dirty.add(routeId)
  try { localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty])) } catch { /* Local draft saving remains best effort. */ }
}

export function clearAttemptDirty(routeId: string) {
  const dirty = loadDirtyAttemptIds(loadAttempts())
  dirty.delete(routeId)
  try { localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty])) } catch { /* Remote save still succeeded. */ }
}
