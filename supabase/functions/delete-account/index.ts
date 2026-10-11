import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean)
const cors = (request: Request) => {
  const origin = request.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async request => {
  const headers = { ...cors(request), 'Content-Type': 'application/json' }
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  if (!allowedOrigins.includes(request.headers.get('origin') || '')) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers })
  const body = await request.json().catch(() => ({}))
  if (body.confirmation !== 'DELETE') return new Response(JSON.stringify({ error: 'Deletion confirmation missing' }), { status: 400, headers })

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers })

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } })
  const paths: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await admin.storage.from('climbing-media').list(userData.user.id, { limit: 100, offset })
    if (error) return new Response(JSON.stringify({ error: 'Could not enumerate private media' }), { status: 500, headers })
    const batch = (data || []).filter(item => item.id).map(item => `${userData.user.id}/${item.name}`)
    paths.push(...batch)
    if ((data || []).length < 100) break
    offset += 100
  }
  if (paths.length) {
    const { error } = await admin.storage.from('climbing-media').remove(paths)
    if (error) return new Response(JSON.stringify({ error: 'Could not delete private media' }), { status: 500, headers })
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id)
  if (deleteError) return new Response(JSON.stringify({ error: 'Could not delete account' }), { status: 500, headers })
  return new Response(JSON.stringify({ deleted: true }), { headers })
})
