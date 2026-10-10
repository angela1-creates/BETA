import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAttempts, saveAttempts } from '../src/storage.ts'

test('invalid saved data falls back to an empty attempt collection', () => {
  globalThis.localStorage = { getItem: () => '{not-json' }
  assert.deepEqual(loadAttempts(), {})
})

test('storage quota errors do not interrupt the climbing workspace', () => {
  globalThis.localStorage = {
    setItem: () => { throw new Error('Quota exceeded') }
  }
  assert.equal(saveAttempts({}), false)
})
