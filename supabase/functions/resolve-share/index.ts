import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
  const { token } = await request.json().catch(() => ({ token: '' }))
  if (typeof token !== 'string' || token.length < 30) return new Response('Invalid link', { status: 400, headers: cors })
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(value => value.toString(16).padStart(2, '0')).join('')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: link } = await admin.from('share_links').select('resource_type,resource_id,expires_at,revoked_at').eq('token_hash', digest).maybeSingle()
  if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) <= new Date())) return new Response('Link unavailable', { status: 404, headers: cors })
  const table = link.resource_type === 'climb' ? 'climbs' : link.resource_type === 'challenge' ? 'challenges' : null
  if (!table) return Response.json({ resourceType: link.resource_type, resourceId: link.resource_id }, { headers: cors })
  const { data: resource, error } = await admin.from(table).select('*').eq('id', link.resource_id).single()
  if (error || !resource) return new Response('Link unavailable', { status: 404, headers: cors })
  let mediaUrl: string | null = null
  if (resource.media_path) {
    const signed = await admin.storage.from('climbing-media').createSignedUrl(resource.media_path, 300)
    mediaUrl = signed.data?.signedUrl || null
  }
  return Response.json({ resourceType: link.resource_type, resource: { ...resource, media_path: undefined }, mediaUrl }, { headers: { ...cors, 'Cache-Control': 'no-store' } })
})
