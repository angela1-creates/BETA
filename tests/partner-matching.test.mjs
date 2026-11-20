import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/0004_partner_matching.sql', import.meta.url), 'utf8')
const lifecycleMigration = await readFile(new URL('../supabase/migrations/0007_partner_sessions_and_notifications.sql', import.meta.url), 'utf8')
const concurrencyMigration = await readFile(new URL('../supabase/migrations/0008_partner_session_concurrency.sql', import.meta.url), 'utf8')
const backend = await readFile(new URL('../src/services/partnerBackend.ts', import.meta.url), 'utf8')
const smsFunction = await readFile(new URL('../supabase/functions/partner-sms/index.ts', import.meta.url), 'utf8')
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

test('expressing interest does not hide availability and acceptance closes competitors atomically', () => {
  const send = lifecycleMigration.match(/create or replace function public\.send_partner_invitation[\s\S]*?\$\$;/)?.[0] || ''
  const respond = lifecycleMigration.match(/create or replace function public\.respond_partner_invitation[\s\S]*?\$\$;/)?.[0] || ''
  assert.doesNotMatch(send, /update public\.availability set status = 'pending'/)
  assert.match(respond, /for update/)
  assert.match(respond, /update public\.invitations set status = 'cancelled'[\s\S]*id <> invite\.id/)
  assert.match(respond, /tstzrange\(s\.starts_at, s\.ends_at/)
  assert.match(respond, /insert into public\.sessions[\s\S]*target\.ends_at/)
})

test('partner sessions support cancellation, reconfirmation, and completion outcomes', () => {
  for (const rpc of ['cancel_partner_session', 'reconfirm_partner_session', 'complete_partner_session', 'block_partner_profile']) {
    assert.match(lifecycleMigration, new RegExp(`create or replace function public\\.${rpc}`))
    assert.match(backend, new RegExp(`rpc\\('${rpc}'`))
  }
  assert.match(lifecycleMigration, /completion_response/)
  assert.match(lifecycleMigration, /next_status := case when[\s\S]*'completed'/)
  assert.match(lifecycleMigration, /'disputed'/)
})

test('SMS notifications are explicit opt-in and server-delivered', () => {
  assert.match(lifecycleMigration, /create table if not exists public\.partner_sms_preferences/)
  assert.match(lifecycleMigration, /revoke all on public\.partner_sms_preferences, public\.partner_notification_events from anon, authenticated/)
  assert.match(smsFunction, /TWILIO_VERIFY_SERVICE_SID/)
  assert.match(smsFunction, /PARTNER_NOTIFICATION_DISPATCH_SECRET/)
  assert.match(smsFunction, /Reply STOP to opt out or HELP for help/)
  assert.doesNotMatch(app, /TWILIO_ACCOUNT_SID|SUPABASE_SERVICE_ROLE_KEY/)
})

test('partner acceptance, responses, and SMS dispatch are concurrency safe', () => {
  assert.match(concurrencyMigration, /pg_advisory_xact_lock/)
  assert.match(concurrencyMigration, /for update of s/)
  assert.match(concurrencyMigration, /create or replace function public\.claim_partner_notification_events/)
  assert.match(concurrencyMigration, /for update skip locked/)
  assert.match(smsFunction, /rpc\('claim_partner_notification_events'/)
  assert.match(smsFunction, /searchParams\.set\('event'/)
  assert.match(smsFunction, /eq\('status', 'sending'\)/)
  assert.match(smsFunction, /mapped === 'sent'[\s\S]*\.in\('status', \['sending', 'sent'\]\)/)
  assert.match(smsFunction, /mapped === 'failed'[\s\S]*\.neq\('status', 'delivered'\)/)
})

test('availability captures a flexible window and exposes lifecycle actions', () => {
  assert.match(app, /name="startsAt"/)
  assert.match(app, /name="endsAt"/)
  assert.match(app, /Availability must be between 1 and 3 hours/)
  assert.match(app, /partnerBackend\.reconfirmSession/)
  assert.match(app, /partnerBackend\.completeSession/)
  assert.match(app, /SMS partner notifications/)
})

test('connected account copy distinguishes real and local-only features', () => {
  assert.match(accountModal, /Pilot backend connected/)
  assert.match(accountModal, /adult partner matching, private crews, and crew membership sync/)
  assert.match(accountModal, /Challenges and explicit share links remain stored locally/)
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
  assert.match(app, /\['crew', t\('nav\.crew'\)\]/)
  for (const key of ['pick', 'explore', 'try', 'share', 'support', 'return']) assert.match(app, new RegExp(`key: '${key}'`))
  assert.match(app, /nextConfirmedSession/)
  assert.match(app, /calendarHref\(nextSession\)/)
  assert.doesNotMatch(app, /quick-grid|Share a Climb|Climb With My Crew/)
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

test('public beta discovery is independent of crew membership and honest about coverage', async () => {
  const routeLab = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(routeLab, /className="discovery-filters"/)
  assert.match(routeLab, /routeLab\.library\.request/)
  assert.match(routeLab, /routeLab\.library\.curatedCoverage/)
  assert.match(routeLab, /publicHintLevels/)
  assert.doesNotMatch(routeLab, /Crew|crewId|crew membership/)
  assert.match(app, /function SharedDiscoveryActions/)
  assert.match(app, /Explore available beta/)
  assert.match(app, /onExplore=\{\(\) => open\('learn'\)\}/)
})

test('connected pilots require an account for personal recording, not curated hints', async () => {
  const routeLab = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(routeLab, /backendConfigured && \(!auth\.session \|\| !auth\.profile\?\.consentedAt\)/)
  assert.match(routeLab, /canRecord \? updateAttempt\(\{ hintLevelUsed: level \}\) : setPublicHintLevels/)
  assert.match(app, /function MyClimbs[\s\S]*backendConfigured && \(!auth\.session \|\| !auth\.profile\?\.consentedAt\)/)
})

test('Connect separates partner discovery from existing crews', async () => {
  const styles = await readFile(new URL('../src/social-fixes.css', import.meta.url), 'utf8')
  assert.match(app, /function ConnectTabs/)
  assert.match(app, /<ConnectTabs active="find"/)
  assert.match(app, /<ConnectTabs active="crew"/)
  assert.match(copy, /connect: \{ label: 'Connect', find: 'Find a Partner', crew: 'My Crew' \}/)
  assert.match(styles, /\.connect-tabs/)
})

test('Challenges opens on Beta Challenge without a Share Wall tab', async () => {
  const styles = await readFile(new URL('../src/social-fixes.css', import.meta.url), 'utf8')
  assert.match(app, /useState<'climb'\|'compare'\|'challenge'>\(initialSelected \? 'climb' : 'challenge'\)/)
  assert.doesNotMatch(app, /function SharedWall|tab === 'wall'/)
  assert.match(styles, /\.segmented > button:first-child \{ display: none; \}/)
  assert.match(styles, /button:nth-child\(3\) \{ order: 1; \}/)
})

test('My Climbs keeps Route Lab contextual and omits the Share Wall', () => {
  assert.match(app, /className="route-lab-inline"/)
  assert.doesNotMatch(app, /className="deep-panel"|<SharedWall/)
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
