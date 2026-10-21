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
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8')

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
  assert.match(accountModal, /adult partner matching, private crews, and crew membership sync/)
  assert.match(accountModal, /Challenges and the Share Wall remain stored locally/)
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

test('pilot navigation and product tour expose the complete BETA loop', () => {
  assert.match(app, /\['home', t\('nav\.home'\)\]/)
  assert.match(app, /\['learn', t\('nav\.routeLab'\)\]/)
  assert.match(app, /\['climbs', t\('nav\.climbs'\)\]/)
  assert.match(app, /\['share', t\('nav\.challenges'\)\]/)
  assert.match(app, /\['find', t\('nav\.connect'\)\]/)
  for (const key of ['read', 'climbs', 'challenge', 'connect']) assert.match(app, new RegExp(`key: '${key}'`))
  assert.match(app, /nextConfirmedSession/)
  assert.match(app, /calendarHref\(nextSession\)/)
})

test('Route Lab reduces annotation friction and identifies the target route', async () => {
  const routeLab = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const canvas = await readFile(new URL('../src/components/RouteCanvas.tsx', import.meta.url), 'utf8')
  assert.match(routeLab, /LH: 'RH', RH: 'LF', LF: 'RF', RF: 'LH'/)
  assert.match(routeLab, /if \(step\.type !== 'MOVE'\) setTool\(nextPlacementTool\[step\.type\]\)/)
  assert.match(routeLab, /routeLab\.workspace\.quickRead/)
  assert.match(canvas, /className="route-target"/)
  assert.match(canvas, /routeLab\.canvas\.solve/)
})

test('Connect separates partner discovery from existing crews', async () => {
  const styles = await readFile(new URL('../src/social-fixes.css', import.meta.url), 'utf8')
  assert.match(app, /function ConnectTabs/)
  assert.match(app, /<ConnectTabs active="find"/)
  assert.match(app, /<ConnectTabs active="crew"/)
  assert.match(copy, /connect: \{ label: 'Connect', find: 'Find a Partner', crew: 'My Crew' \}/)
  assert.match(styles, /\.connect-tabs/)
})

test('Challenges opens on Beta Challenge and hides the duplicate My Climb tab', async () => {
  const styles = await readFile(new URL('../src/social-fixes.css', import.meta.url), 'utf8')
  assert.match(app, /useState<'climb'\|'compare'\|'challenge'\|'wall'>\(initialSelected \? 'climb' : 'challenge'\)/)
  assert.match(styles, /\.segmented > button:first-child \{ display: none; \}/)
  assert.match(styles, /button:nth-child\(3\) \{ order: 1; \}/)
})

test('link previews describe the connected climbing product', () => {
  assert.match(index, /<title>BETA — Climb better, together<\/title>/)
  assert.match(index, /property="og:title"/)
  assert.match(index, /property="og:image"/)
  assert.match(index, /name="twitter:card" content="summary_large_image"/)
})

test('Route Lab canvas uses a stable viewport height on mobile', async () => {
  const styles = await readFile(new URL('../src/social-fixes.css', import.meta.url), 'utf8')
  assert.match(styles, /\.route-canvas \{[^}]*height: min\(70svh, 780px\)/)
  assert.match(styles, /@media \(max-width: 480px\) \{ \.route-canvas \{ height: 64svh/)
})

test('crew invitations use real join links only when the backend is connected', () => {
  assert.match(app, /channel: 'share'/)
  assert.match(app, /crewFlow\.inviteText/)
  assert.match(app, /\?crewInvite=/)
  assert.match(app, /backendConfigured \? <MyCrewPersistent/)
  assert.match(app, /: <MyCrewV2/)
  assert.match(platform, /\[input\.text, input\.url\]\.filter\(Boolean\)\.join/)
})

test('crew recap opens a real crew-specific view', () => {
  assert.match(app, /setRecapCrew\(crew\)/)
  assert.match(app, /item\.crewId === recapCrew\.id/)
  assert.match(app, /crewFlow\.recapPrivacy/)
  assert.doesNotMatch(app, /notify\(t\('crew\.recapOpened'\)\)/)
})
