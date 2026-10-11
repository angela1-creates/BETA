import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

test('Route Lab entry actions describe their distinct destinations', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const copy = await readFile(new URL('../src/i18n.ts', import.meta.url), 'utf8')

  assert.match(source, /routeLab\.home\.choose/)
  assert.match(source, /routeLab\.home\.sample/)
  assert.match(copy, /choose: 'Choose a route'/)
  assert.match(copy, /sample: 'Open sample route'/)
  assert.doesNotMatch(source, />Read a route /)
  assert.doesNotMatch(source, />Try a demo<\/button>/)
})
