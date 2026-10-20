import { createClient } from '@supabase/supabase-js'

const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'BETA_TEST_USER_A_EMAIL', 'BETA_TEST_USER_A_PASSWORD', 'BETA_TEST_USER_B_EMAIL', 'BETA_TEST_USER_B_PASSWORD']
const missing = required.filter(key => !process.env[key])
if (missing.length) {
  console.error(`BLOCKED: missing ${missing.join(', ')}. Create two disposable, adult pilot accounts before running this live authorization test.`)
  process.exit(2)
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const a = makeClient(), b = makeClient(), anonymous = makeClient()
const signIn = async (client, email, password) => {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}
const expectNoRows = (label, result) => {
  if (result.error) throw new Error(`${label}: unexpected API error: ${result.error.message}`)
  if ((result.data || []).length) throw new Error(`${label}: cross-account rows were exposed`)
}
const inviteToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
const hashToken = async token => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), byte => byte.toString(16).padStart(2, '0')).join('')

const userA = await signIn(a, process.env.BETA_TEST_USER_A_EMAIL, process.env.BETA_TEST_USER_A_PASSWORD)
const userB = await signIn(b, process.env.BETA_TEST_USER_B_EMAIL, process.env.BETA_TEST_USER_B_PASSWORD)
for (const [client, user, label] of [[a, userA, 'Tester A'], [b, userB, 'Tester B']]) {
  const { error } = await client.from('profiles').upsert({ id: user.id, display_name: label, is_adult: true, visibility: 'invited', consented_at: new Date().toISOString(), experience_level: 'recreational', primary_style: 'bouldering' })
  if (error) throw error
}

const routeKey = `security-${crypto.randomUUID()}`
const { data: route, error: routeError } = await a.from('research_routes').insert({ owner_id: userA.id, route_key: routeKey, title: 'RLS test route', source_kind: 'builtin' }).select().single()
if (routeError) throw routeError
const { data: attempt, error: attemptError } = await a.from('route_attempts').insert({ owner_id: userA.id, route_id: route.id, predicted_beta: [{ id: 'one' }], actual_beta: [{ id: 'two' }], reflection: { noticed: 'private' } }).select().single()
if (attemptError) throw attemptError

expectNoRows('B SELECT route', await b.from('research_routes').select('*').eq('id', route.id))
expectNoRows('B SELECT attempt', await b.from('route_attempts').select('*').eq('id', attempt.id))
expectNoRows('B UPDATE route', await b.from('research_routes').update({ title: 'stolen' }).eq('id', route.id).select())
expectNoRows('B UPDATE attempt', await b.from('route_attempts').update({ reflection: { noticed: 'stolen' } }).eq('id', attempt.id).select())
expectNoRows('B DELETE route', await b.from('research_routes').delete().eq('id', route.id).select())
expectNoRows('B DELETE attempt', await b.from('route_attempts').delete().eq('id', attempt.id).select())
const crossInsert = await b.from('research_routes').insert({ owner_id: userA.id, route_key: `attack-${crypto.randomUUID()}`, title: 'attack', source_kind: 'builtin' })
if (!crossInsert.error) throw new Error('B INSERT as A was not rejected')

const mediaPath = `${userA.id}/security-${crypto.randomUUID()}.png`
const upload = await a.storage.from('climbing-media').upload(mediaPath, new Blob(['private'], { type: 'image/png' }), { contentType: 'image/png' })
if (upload.error) throw upload.error
{
  const bDownload = await b.storage.from('climbing-media').download(mediaPath)
  if (!bDownload.error) throw new Error('B downloaded A media')
  const bSigned = await b.storage.from('climbing-media').createSignedUrl(mediaPath, 1)
  if (!bSigned.error) throw new Error('B generated a signed URL for A media')
  const anonymousSigned = await anonymous.storage.from('climbing-media').createSignedUrl(mediaPath, 1)
  if (!anonymousSigned.error) throw new Error('Anonymous user generated a signed URL')
  const aSigned = await a.storage.from('climbing-media').createSignedUrl(mediaPath, 1)
  if (aSigned.error) throw aSigned.error
  const beforeExpiry = await fetch(aSigned.data.signedUrl)
  if (!beforeExpiry.ok) throw new Error('Owner signed URL was not initially usable')
  await new Promise(resolve => setTimeout(resolve, 2100))
  const afterExpiry = await fetch(aSigned.data.signedUrl)
  if (afterExpiry.ok) throw new Error('Signed URL remained usable after expiry')
  await a.storage.from('climbing-media').remove([mediaPath])
}

const secondDevice = makeClient()
await signIn(secondDevice, process.env.BETA_TEST_USER_A_EMAIL, process.env.BETA_TEST_USER_A_PASSWORD)
const reloaded = await secondDevice.from('route_attempts').select('id').eq('id', attempt.id).single()
if (reloaded.error || !reloaded.data) throw new Error('A could not reload saved data from a second client')

const { data: crewId, error: crewError } = await a.rpc('create_crew', { p_name: 'Security test crew', p_kind: 'Friends', p_guardian_managed: false })
if (crewError) throw crewError
expectNoRows('B SELECT crew before invitation acceptance', await b.from('crews').select('*').eq('id', crewId))
expectNoRows('B SELECT membership before invitation acceptance', await b.from('crew_members').select('*').eq('crew_id', crewId))

const token = inviteToken()
const tokenHash = await hashToken(token)
const invitation = await a.rpc('create_crew_invitation', { p_crew_id: crewId, p_token_hash: tokenHash })
if (invitation.error) throw invitation.error
const preview = await anonymous.rpc('resolve_crew_invitation', { p_token_hash: tokenHash })
if (preview.error || preview.data?.length !== 1) throw new Error('Anonymous invitee could not resolve the limited crew invitation preview')
if (JSON.stringify(preview.data).match(/email|height_cm|wingspan_cm/)) throw new Error('Crew invitation preview exposed private profile fields')
const acceptance = await b.rpc('respond_crew_invitation', { p_token_hash: tokenHash, p_response: 'accepted' })
if (acceptance.error) throw acceptance.error
const joined = await b.rpc('my_crews')
if (joined.error || !joined.data?.some(crew => crew.id === crewId)) throw new Error('Accepted crew did not persist for Tester B')
const removeMember = await a.rpc('remove_crew_member', { p_crew_id: crewId, p_profile_id: userB.id })
if (removeMember.error) throw removeMember.error
const afterRemoval = await b.rpc('my_crews')
if (afterRemoval.error || afterRemoval.data?.some(crew => crew.id === crewId)) throw new Error('Removed member retained crew access')

const revokedToken = inviteToken()
const revokedHash = await hashToken(revokedToken)
const revocable = await a.rpc('create_crew_invitation', { p_crew_id: crewId, p_token_hash: revokedHash })
if (revocable.error) throw revocable.error
const invitationId = Array.isArray(revocable.data) ? revocable.data[0]?.id : revocable.data?.id
const revocation = await a.rpc('revoke_crew_invitation', { p_invitation_id: invitationId })
if (revocation.error) throw revocation.error
const revokedPreview = await anonymous.rpc('resolve_crew_invitation', { p_token_hash: revokedHash })
if (revokedPreview.error || revokedPreview.data?.length) throw new Error('Revoked crew invitation remained resolvable')
const deleteCrew = await a.rpc('delete_crew', { p_crew_id: crewId })
if (deleteCrew.error) throw deleteCrew.error

await a.from('research_routes').delete().eq('id', route.id)
console.log('PASS: two-account CRUD isolation, crew membership boundaries, invitation acceptance/revocation, second-client persistence, private media, signed URL authorization, and expiry verified.')
