import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

test('modal focus setup does not rerun when controlled inputs render', async () => {
  const modal = await readFile(new URL('../src/components/AccessibleModal.tsx', import.meta.url), 'utf8')

  assert.match(modal, /const closeRef = useRef\(onClose\)/)
  assert.match(modal, /closeRef\.current = onClose/)
  assert.match(modal, /button:not\(\[aria-label="Close"\]\)/)
  assert.doesNotMatch(modal, /\}, \[onClose\]\)/)
})
