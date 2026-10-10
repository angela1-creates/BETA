import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const backendConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const googleAuthConfigured = import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED === 'true'
export const supabase: SupabaseClient | null = backendConfigured ? createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null

export const backendMode = backendConfigured ? 'supabase' : 'demo'

export async function uploadPrivateMedia(ownerId: string, file: File, onProgress?: (percent: number) => void) {
  if (!supabase) throw new Error('Supabase is not configured')
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase environment is incomplete')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sign in required')
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${supabaseUrl}/storage/v1/object/climbing-media/${encodedPath}`)
    request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.setRequestHeader('apikey', supabaseAnonKey)
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) }
    request.onerror = () => reject(new Error('Upload interrupted. Your local draft is still available.'))
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed (${request.status}): ${request.responseText || 'Storage rejected the file'}`))
    request.send(file)
  })
  onProgress?.(100)
  return path
}

export async function createSignedMediaUrl(path: string, seconds = 300) {
  if (!supabase) throw new Error('Supabase is not configured')
  const result = await supabase.storage.from('climbing-media').createSignedUrl(path, seconds)
  if (result.error) throw result.error
  return result.data.signedUrl
}
