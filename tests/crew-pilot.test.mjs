import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/SocialApp.tsx', import.meta.url), 'utf8')
const social = await readFile(new URL('../src/social.ts', import.meta.url), 'utf8')
const demo = await readFile(new URL('../src/demo.ts', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/social-fixes.css', import.meta.url), 'utf8')

test('existing-crew pilot supports the smallest observable beta exchange', () => {
  assert.match(social, /interface CrewPilot/)
  assert.match(social, /sessionDates: \[string, string\?\]/)
  assert.match(social, /wantsHelp: boolean/)
  assert.match(social, /responses: CrewPilotResponse\[\]/)
  assert.match(social, /responseOutcome\?: 'helped' \| 'not_for_me' \| 'another_way'/)
  assert.match(demo, /members: \['You', 'Alex', 'Maya', 'Jordan', 'Sam', 'Nana Jo'\]/)
  assert.match(demo, /Pick one problem together\. Explore different approaches\./)
  assert.match(app, /function CrewPilotPanel/)
  assert.match(app, /Contribute to crew/)
  assert.match(app, /Respond within the crew/)
  assert.match(app, /Did .* try a response/)
  assert.match(app, /Invite to another session/)
  assert.match(app, /crew_pilot_contribution_added/)
  assert.match(app, /crew_pilot_response_added/)
  assert.match(app, /crew_pilot_beta_tried/)
  assert.match(app, /crew_pilot_next_session_observed/)
  assert.match(app, /crew_pilot_next_invite_sent/)
  assert.match(app, /crew_pilot_started/)
  assert.match(app, /crewOverride=\{\{ id: crews\[0\]\.id/)
  for (const key of ['pick', 'explore', 'try', 'share', 'support', 'return']) assert.match(app, new RegExp(`key: '${key}'`))
  assert.match(app, /onNavigate\('crew'\).*home\.crew/)
  assert.match(styles, /\.crew-pilot/)
})

test('crew pilot keeps contribution optional and states its causal limits', () => {
  assert.match(app, /Attach a saved climb \(optional\)/)
  assert.match(app, /No photo or video/)
  assert.match(app, /No contribution is required to participate/)
  assert.match(app, /crew only on this device/)
  assert.match(app, /cannot establish that familiarity caused sharing or comfort/)
  assert.match(app, /does not prove BETA caused the crew to return/)
  assert.match(app, /public contribution remains untested/)
  assert.match(demo, /crewPilots: parsed\.crewPilots \|\| initial\.crewPilots/)
})

test('home ends with the concrete crew example instead of a duplicate loop', () => {
  assert.doesNotMatch(app, /className="story-strip"/)
  assert.match(app, /<ProductTour onNavigate=\{onNavigate\}\/?>/)
})

test('challenge creation is not gated by the response reveal control', () => {
  assert.doesNotMatch(app, /const \[reviewed, setReviewed\]/)
  assert.doesNotMatch(app, /disabled=\{!reviewed/)
  assert.match(app, /disabled=\{!challengeTitle\.trim\(\) \|\| !challengePrompt\.trim\(\)\}/)
  assert.match(app, /revealResponses: false/)
  assert.match(app, /t\('share\.hiddenHelp'\)/)
})
