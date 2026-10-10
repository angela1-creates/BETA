import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceRoleKey) {
  console.error('BLOCKED: public Supabase URL/key and the server-only test service-role key are required.')
  process.exit(2)
}

const browserClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const accidentallyCreated = []

try {
  const signup = await browserClient.auth.signUp({
    email: `beta-closed-signup-${crypto.randomUUID()}@example.com`,
    password: `Beta!${crypto.randomUUID()}aA1`,
  })
  if (signup.data.user) accidentallyCreated.push(signup.data.user.id)
  if (!signup.error) throw new Error('Public email signup is still enabled')

  const anonymous = await browserClient.auth.signInAnonymously()
  if (anonymous.data.user) accidentallyCreated.push(anonymous.data.user.id)
  if (!anonymous.error) throw new Error('Anonymous sign-in is still enabled')

  console.log('PASS: unrestricted email signup and anonymous account creation are disabled.')
} finally {
  for (const userId of accidentallyCreated) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error
  }
}
