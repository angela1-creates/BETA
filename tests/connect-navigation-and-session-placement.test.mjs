import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/SocialApp.tsx', import.meta.url), 'utf8')
const copy = await readFile(new URL('../src/i18n.ts', import.meta.url), 'utf8')

test('Climb Together opens partner discovery and makes it the first connect option', () => {
  assert.match(copy, /crew: 'Climb Together'/)
  assert.match(app, /const destination = \(id: Screen\) => id === 'crew' \? 'find' : id/)
  assert.match(app, /<ConnectTabs active="find"/)
  assert.match(app, /connect\.find[\s\S]*connect\.crew/)
  assert.match(app, /onNavigate\('find'\).*home\.find/)
})

test('current partner discovery excludes past sessions and My Climbs owns history follow-up', () => {
  assert.match(app, /const upcomingPartnerSessions = realMode \? activity\.sessions\.filter/)
  assert.match(app, /new Date\(session\.endsAt\)\.getTime\(\) > Date\.now\(\)/)
  assert.match(app, /<h2>Upcoming sessions<\/h2>/)
  assert.match(app, /function MyClimbs[\s\S]*<h2>Past sessions<\/h2>/)
  assert.match(app, /aria-label="How did it go\?"/)
  assert.doesNotMatch(app, /Confirmed plans and follow-up/)
})
