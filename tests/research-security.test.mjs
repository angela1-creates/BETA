import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

const migration = await readFile(new URL('../supabase/migrations/0003_research_mvp.sql', import.meta.url), 'utf8')
const deleteFunction = await readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8')
const inviteFunction = await readFile(new URL('../supabase/functions/request-research-invite/index.ts', import.meta.url), 'utf8')
const backend = await readFile(new URL('../src/services/researchBackend.ts', import.meta.url), 'utf8')
const authProvider = await readFile(new URL('../src/researchAuth.tsx', import.meta.url), 'utf8')

test('research records enforce owner-scoped CRUD with RLS', () => {
  for (const table of ['research_routes', 'route_attempts', 'research_referrals']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(migration, new RegExp(`owners ${operation} research routes`))
    assert.match(migration, new RegExp(`owners ${operation} route attempts`))
  }
  assert.match(migration, /owner_id = auth\.uid\(\)/)
})

test('referral reporting is aggregate-only and authenticated', () => {
  assert.match(migration, /extensions\.gen_random_bytes\(12\)/)
  assert.doesNotMatch(migration, /(?<!extensions\.)gen_random_bytes\(12\)/)
  assert.match(migration, /revoke all on function public\.my_research_referral_metrics\(\) from public/)
  assert.match(migration, /grant execute on function public\.my_research_referral_metrics\(\) to authenticated/)
  assert.doesNotMatch(migration, /create policy .*research_referrals for select/)
})

test('account deletion keeps the service role inside an origin-restricted Edge Function', () => {
  assert.match(deleteFunction, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(deleteFunction, /Origin not allowed/)
  assert.match(deleteFunction, /auth\.admin\.deleteUser/)
  assert.doesNotMatch(backend, /SERVICE_ROLE/)
})

test('Google login is gated and email magic links remain available', () => {
  assert.match(backend, /signInWithOtp/)
  assert.match(backend, /shouldCreateUser: false/)
  assert.match(backend, /googleAuthConfigured/)
  assert.match(backend, /signInWithOAuth/)
})

test('auth state callbacks defer profile queries until the Supabase session lock is released', () => {
  assert.match(authProvider, /onAuthStateChange[\s\S]*window\.setTimeout[\s\S]*loadProfile/)
})

test('referral invites validate origin, rate limit, and keep email out of research tables', () => {
  assert.match(inviteFunction, /allowedOrigins\.includes/)
  assert.match(inviteFunction, />= 20/)
  assert.match(inviteFunction, /inviteUserByEmail/)
  assert.match(migration, /email_hash text not null/)
  assert.doesNotMatch(migration, /research_invite_requests[\s\S]*email text/)
})
