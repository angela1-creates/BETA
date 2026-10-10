import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const routeAssets = [
  'feet-first-v1-blue.webp',
  'weight-shift-v3-coral.webp',
  'multiple-betas-v4-sage.webp',
  'library-v1-blue.webp',
  'library-v2-yellow.webp',
  'library-v3-coral.webp',
  'library-v4-sage.webp',
  'library-v5-purple.webp'
]

const realRouteAssets = Array.from({ length: 6 }, (_, index) => `real-study-v${index + 1}.jpg`)

test('the route library ships each original route image', () => {
  for (const asset of routeAssets) {
    assert.equal(existsSync(new URL(`../public/routes/${asset}`, import.meta.url)), true, asset)
  }
})

test('the route lab ships six credited real climbing photos locally', () => {
  for (const asset of realRouteAssets) {
    assert.equal(existsSync(new URL(`../public/routes/${asset}`, import.meta.url)), true, asset)
  }
  assert.equal(existsSync(new URL('../public/routes/PHOTO_CREDITS.md', import.meta.url)), true)
})

test('study level and visible hold description remain separate attributes', () => {
  const source = readFileSync(new URL('../src/data.ts', import.meta.url), 'utf8')
  assert.match(source, /grade: 'V1 study', colorName: 'Mixed holds'/)
  assert.match(source, /grade: 'V3 study', colorName: 'Mixed holds'/)
  assert.match(source, /grade: 'V4 study', colorName: 'Mixed holds'/)
})

test('real-photo grades are disclosed as unverified study levels', () => {
  const source = readFileSync(new URL('../src/data.ts', import.meta.url), 'utf8')
  assert.match(source, /grade: 'V1 study'/)
  assert.match(source, /not the original gym grade/)
  assert.match(source, /V6:/)
})
