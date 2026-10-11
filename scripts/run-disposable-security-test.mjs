import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceRoleKey) {
  console.error('BLOCKED: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and the server-only SUPABASE_TEST_SERVICE_ROLE_KEY are required.')
  process.exit(2)
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const users = []

const createTester = async label => {
  const email = `beta-security-${label}-${crypto.randomUUID()}@example.com`
  const password = `Beta!${crypto.randomUUID()}aA1`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user)
  return { email, password }
}

const removeUserMedia = async userId => {
  const { data, error: listError } = await admin.storage.from('climbing-media').list(userId, { limit: 100 })
  if (listError) throw listError
  if (data?.length) {
    const { error: removeError } = await admin.storage.from('climbing-media').remove(data.map(item => `${userId}/${item.name}`))
    if (removeError) throw removeError
  }
}

try {
  const [testerA, testerB] = await Promise.all([createTester('a'), createTester('b')])
  const child = spawn(process.execPath, ['scripts/verify-supabase-security.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      BETA_TEST_USER_A_EMAIL: testerA.email,
      BETA_TEST_USER_A_PASSWORD: testerA.password,
      BETA_TEST_USER_B_EMAIL: testerB.email,
      BETA_TEST_USER_B_PASSWORD: testerB.password,
    },
  })
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
  if (exitCode !== 0) throw new Error(`Live authorization test exited with code ${exitCode}`)
} finally {
  const cleanupErrors = []
  for (const user of users) {
    try {
      await removeUserMedia(user.id)
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) throw error
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Disposable security-test cleanup failed')
}
