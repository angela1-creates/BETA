import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/0004_partner_matching.sql', import.meta.url), 'utf8')
const backend = await readFile(new URL('../src/services/partnerBackend.ts', import.meta.url), 'utf8')
const gyms = await readFile(new URL('../src/movementGyms.ts', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/SocialApp.tsx', import.meta.url), 'utf8')
const copy = await readFile(new URL('../src/i18n.ts', import.meta.url), 'utf8')
const platform = await readFile(new URL('../src/platform.ts', import.meta.url), 'utf8')
const accountModal = await readFile(new URL('../src/components/ResearchAccountModal.tsx', import.meta.url), 'utf8')

test('Bay Area Movement pilot includes all five official locations', () => {
  for (const location of ['Belmont', 'Mountain View', 'San Francisco', 'Santa Clara', 'Sunnyvale']) {
    assert.match(gyms, new RegExp(`Movement ${location}`))
    assert.match(migration, new RegExp(`Movement ${location}`))
  }
  assert.match(gyms, /Movement Mountain View'[\s\S]*disciplines: \['Bouldering'\]/)
  assert.match(gyms, /Movement Santa Clara'[\s\S]*disciplines: \['Bouldering'\]/)
})

test('partner discovery is consented-adult-only and exposes a limited projection', () => {
  assert.match(migration, /is_adult_research_participant/)
  assert.match(migration, /p\.is_adult/)
  assert.match(migration, /p\.consented_at is not null/)
  assert.match(migration, /revoke all on function public\.partner_board\(uuid\) from public/)
  assert.doesNotMatch(migration.match(/create or replace function public\.partner_board[\s\S]*?\$\$;/)?.[0] || '', /height_cm|wingspan_cm|email/)
})

test('invitation acceptance is an atomic server-side session transition', () => {
  assert.match(migration, /for update/)
  assert.match(migration, /status = 'confirmed'/)
  assert.match(migration, /insert into public\.sessions/)
  assert.match(migration, /insert into public\.session_members/)
  assert.match(backend, /rpc\('respond_partner_invitation'/)
  assert.match(migration, /invitations_sender_id_fkey[\s\S]*on delete cascade/)
  assert.match(migration, /sessions_created_by_fkey[\s\S]*on delete cascade/)
})

test('connected account copy distinguishes real and local-only features', () => {
  assert.match(accountModal, /Pilot backend connected/)
  assert.match(accountModal, /Real adult partner matching is available/)
  assert.match(accountModal, /Crews, challenges, and the Share Wall remain stored locally/)
  assert.doesNotMatch(accountModal, /matching remain demo-only/)
})

test('connected deployments never fall back to fictional matching actions', () => {
  assert.match(app, /const visibleDemo = backendConfigured \? \[\] : demo\.requests\.filter/)
  assert.match(app, /if \(backendConfigured\) \{[\s\S]*?complete adult consent before publishing availability/)
})

test('share card handoff and media-backed download are explicit', () => {
  assert.match(app, /climbs\.manageShare/)
  assert.match(copy, /manageShare: 'View or manage sharing →'/)
  assert.match(app, /onShare\(climb\.id\)/)
  assert.match(app, /drawCover\(ctx, media/)
  assert.match(app, /shareWall\.description/)
  assert.match(app, /shareWall\.disclosure/)
  assert.match(app, /shareWall\.copy/)
  assert.match(app, /shared a climb on BETA/)
})

test('Route Lab retains product navigation and a visible return action', () => {
  assert.match(app, /route-lab-shell[\s\S]*<Header screen=\{screen\}/)
  assert.match(app, /routeLab\.context\.back/)
})

test('crew invitations share useful text without a dead join link', () => {
  assert.match(app, /channel: 'share'/)
  assert.match(app, /crewFlow\.inviteText/)
  assert.doesNotMatch(app, /\?crewInvite=/)
  assert.match(platform, /\[input\.text, input\.url\]\.filter\(Boolean\)\.join/)
})

test('crew recap opens a real crew-specific view', () => {
  assert.match(app, /setRecapCrew\(crew\)/)
  assert.match(app, /item\.crewId === recapCrew\.id/)
  assert.match(app, /crewFlow\.recapPrivacy/)
  assert.doesNotMatch(app, /notify\(t\('crew\.recapOpened'\)\)/)
})
