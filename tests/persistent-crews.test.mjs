import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/0005_persistent_crews.sql', import.meta.url), 'utf8')
const invitationFix = await readFile(new URL('../supabase/migrations/0006_fix_crew_invitation_expiry.sql', import.meta.url), 'utf8')
const backend = await readFile(new URL('../src/services/crewBackend.ts', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/SocialApp.tsx', import.meta.url), 'utf8')
const auth = await readFile(new URL('../src/services/researchBackend.ts', import.meta.url), 'utf8')

test('crew creation and invitation acceptance are atomic server operations', () => {
  assert.match(migration, /create or replace function public\.create_crew/)
  assert.match(migration, /insert into public\.crews[\s\S]*insert into public\.crew_members/)
  assert.match(migration, /create or replace function public\.respond_crew_invitation/)
  assert.match(migration, /for update/)
  assert.match(migration, /on conflict \(crew_id, profile_id\) do nothing/)
  assert.match(backend, /rpc\('create_crew'/)
  assert.match(backend, /rpc\('respond_crew_invitation'/)
})

test('crew data is member-only and browser writes go through constrained RPCs', () => {
  assert.match(migration, /enable row level security/)
  assert.match(migration, /members read crews[\s\S]*private\.is_current_crew_member/)
  assert.match(migration, /members read memberships[\s\S]*private\.is_current_crew_member/)
  assert.match(migration, /revoke insert, update, delete on public\.crews, public\.crew_members, public\.crew_invitations from authenticated/)
  assert.match(migration, /grant select on public\.crews, public\.crew_members, public\.crew_invitations to authenticated/)
  assert.doesNotMatch(backend, /\.from\('crews'\)\.insert/)
  assert.doesNotMatch(backend, /\.from\('crew_members'\)\.insert/)
})

test('invitation secrets are generated in the browser but only hashes are persisted', () => {
  assert.match(backend, /crypto\.getRandomValues/)
  assert.match(backend, /subtle\.digest\('SHA-256'/)
  assert.match(backend, /p_token_hash: tokenHash/)
  assert.doesNotMatch(migration, /\btoken\s+text/)
  assert.match(migration, /token_hash text not null unique/)
  assert.match(migration, /interval '7 days'/)
  assert.match(migration, /status = 'revoked'/)
})

test('invitation preview is limited and acceptance requires adult consent', () => {
  const resolver = migration.match(/create or replace function public\.resolve_crew_invitation[\s\S]*?\$\$;/)?.[0] || ''
  assert.match(resolver, /crew_name text, inviter_name text, expires_at timestamptz/)
  assert.doesNotMatch(resolver, /email|height_cm|wingspan_cm/)
  assert.match(migration, /respond_crew_invitation[\s\S]*public\.is_adult_research_participant/)
  assert.match(app, /CrewInvitationView/)
  assert.match(app, /consentToJoin/)
})

test('crew invitation survives magic-link and OAuth redirects', () => {
  assert.match(auth, /\['crewInvite', 'ref'\]/)
  assert.match(app, /URLSearchParams\(location\.search\)\.get\('crewInvite'\)/)
})

test('connected crew share preserves the browser user gesture', () => {
  const persistentCrew = app.match(/function MyCrewPersistent[\s\S]*?function MyCrewV2/)?.[0] || ''
  const prepare = persistentCrew.match(/const openInvite[\s\S]*?const closeInvite/)?.[0] || ''
  const send = persistentCrew.match(/const sendInvite[\s\S]*?const revoke/)?.[0] || ''
  assert.match(prepare, /crewBackend\.createInvitation/)
  assert.doesNotMatch(send, /crewBackend\.createInvitation/)
  assert.match(send, /platform\.share\.share\([\s\S]*preparedInvite\.url/)
})

test('crew invitation expiry query qualifies output-column names', () => {
  assert.match(invitationFix, /update public\.crew_invitations as ci/)
  assert.match(invitationFix, /ci\.status = 'pending' and ci\.expires_at <= now\(\)/)
  assert.doesNotMatch(invitationFix, /where status = 'pending' and expires_at <= now\(\)/)
})

test('crew failures expose Supabase messages inside the invitation modal', () => {
  assert.match(app, /const errorMessage =/)
  assert.match(app, /inviteExpires[\s\S]*role="alert">\{error\}/)
  assert.match(app, /realMode && !error/)
})
