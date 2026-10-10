import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

test('modal focus setup does not rerun when controlled inputs render', async () => {
  const source = await readFile(new URL('../src/SocialApp.tsx', import.meta.url), 'utf8')
  const modal = source.slice(source.indexOf('function AccessibleModal'), source.indexOf('function PageTitle'))

  assert.match(modal, /const closeRef = useRef\(onClose\)/)
  assert.match(modal, /closeRef\.current = onClose/)
  assert.match(modal, /button:not\(\[aria-label="Close"\]\)/)
  assert.doesNotMatch(modal, /\}, \[onClose\]\)/)
})
