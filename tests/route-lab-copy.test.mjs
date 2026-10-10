import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

test('Route Lab entry actions describe their distinct destinations', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

  assert.match(source, />Choose a route <Icon name="arrow" \/><\/button>/)
  assert.match(source, />Open sample route<\/button>/)
  assert.doesNotMatch(source, />Read a route /)
  assert.doesNotMatch(source, />Try a demo<\/button>/)
})
