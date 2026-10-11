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

await a.from('research_routes').delete().eq('id', route.id)
console.log('PASS: two-account CRUD isolation, second-client persistence, private media, signed URL authorization, and expiry verified.')
