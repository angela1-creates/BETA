import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const backendConfigured = Boolean(url && anonKey)
export const supabase: SupabaseClient | null = backendConfigured ? createClient(url!, anonKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null

export const backendMode = backendConfigured ? 'supabase' : 'demo'

export async function uploadPrivateMedia(ownerId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`
  const result = await supabase.storage.from('climbing-media').upload(path, file, { upsert: false, contentType: file.type })
  if (result.error) throw result.error
  return result.data.path
}

export async function createSignedMediaUrl(path: string, seconds = 300) {
  if (!supabase) throw new Error('Supabase is not configured')
  const result = await supabase.storage.from('climbing-media').createSignedUrl(path, seconds)
  if (result.error) throw result.error
  return result.data.signedUrl
}
