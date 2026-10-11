import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean)
const cors = (request: Request) => {
  const origin = request.headers.get('origin') || ''
  return { 'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'null', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('')

Deno.serve(async request => {
  const headers = { ...cors(request), 'Content-Type': 'application/json' }
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  const origin = request.headers.get('origin') || ''
  if (request.method !== 'POST' || !allowedOrigins.includes(origin)) return new Response(JSON.stringify({ error: 'Request not allowed' }), { status: 403, headers })
  const { email, referralCode } = await request.json().catch(() => ({ email: '', referralCode: '' }))
  const normalizedEmail = String(email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^[a-f0-9]{24}$/.test(String(referralCode))) return new Response(JSON.stringify({ error: 'A valid invitation link and email are required' }), { status: 400, headers })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: inviter } = await admin.from('profiles').select('id').eq('referral_code', referralCode).maybeSingle()
  if (!inviter) return new Response(JSON.stringify({ error: 'Invitation unavailable' }), { status: 404, headers })
  const since = new Date(Date.now() - 86400000).toISOString()
  const { count } = await admin.from('research_invite_requests').select('id', { count: 'exact', head: true }).eq('inviter_id', inviter.id).gte('created_at', since)
  if ((count || 0) >= 20) return new Response(JSON.stringify({ error: 'This invitation has reached its daily limit' }), { status: 429, headers })
  const emailHash = await digest(normalizedEmail)
  const { error: requestError } = await admin.from('research_invite_requests').insert({ inviter_id: inviter.id, email_hash: emailHash })
  if (requestError && requestError.code !== '23505') return new Response(JSON.stringify({ error: 'Could not record invitation' }), { status: 500, headers })

  const redirectTo = Deno.env.get('APP_REDIRECT_URL')!
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo })
  if (inviteError && !inviteError.message.toLowerCase().includes('already')) return new Response(JSON.stringify({ error: 'Could not send invitation' }), { status: 500, headers })
  return new Response(JSON.stringify({ sent: true }), { headers })
})
