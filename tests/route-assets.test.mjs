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

test('the route library ships each original route image', () => {
  for (const asset of routeAssets) {
    assert.equal(existsSync(new URL(`../public/routes/${asset}`, import.meta.url)), true, asset)
  }
})

test('difficulty and hold color remain separate route attributes', () => {
  const source = readFileSync(new URL('../src/data.ts', import.meta.url), 'utf8')
  for (const label of ['Blue', 'Yellow', 'Coral', 'Sage', 'Purple']) {
    assert.match(source, new RegExp(`colorName: '${label}'`))
  }
  assert.match(source, /grade: 'V1', colorName: 'Blue'/)
  assert.match(source, /grade: 'V3', colorName: 'Coral'/)
  assert.match(source, /grade: 'V4', colorName: 'Sage'/)
})
