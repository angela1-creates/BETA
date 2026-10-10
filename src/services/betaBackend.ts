import type { AvailabilityRequest, BetaChallenge, ClimbingSession, Crew } from '../social'
import { createToken } from '../social'
import { supabase, uploadPrivateMedia } from './supabase'

const client = () => {
  if (!supabase) throw new Error('Supabase is not configured. Continue in clearly labeled demo mode.')
  return supabase
}

const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('')

export const betaBackend = {
  async signInWithEmail(email: string) {
    const { error } = await client().auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } })
    if (error) throw error
  },
  async signOut() { const { error } = await client().auth.signOut(); if (error) throw error },
  async currentUser() { const { data, error } = await client().auth.getUser(); if (error) throw error; return data.user },
  async saveProfile(profile: { displayName: string; isAdult: boolean; visibility: 'gym' | 'invited' }) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const { error } = await client().from('profiles').upsert({ id: user.id, display_name: profile.displayName, is_adult: profile.isAdult, visibility: profile.visibility })
    if (error) throw error
  },
  async createAvailability(input: AvailabilityRequest, gymId: string) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const { data, error } = await client().from('availability').insert({ owner_id: user.id, gym_id: gymId, starts_at: input.startsAt, ends_at: input.endsAt, expires_at: input.endsAt, disciplines: input.disciplines, looking_for: input.lookingFor, message: input.message, status: 'active' }).select().single()
    if (error) throw error; return data
  },
  async createCrew(input: Crew) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const { data, error } = await client().from('crews').insert({ owner_id: user.id, name: input.name, kind: input.kind, guardian_managed: input.guardianManaged || false }).select().single()
    if (error) throw error
    const membership = await client().from('crew_members').insert({ crew_id: data.id, profile_id: user.id, role: 'owner' })
    if (membership.error) throw membership.error
    return data
  },
  async createSession(input: ClimbingSession, gymId: string) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const { data, error } = await client().from('sessions').insert({ created_by: user.id, gym_id: gymId, starts_at: input.startsAt, status: input.status }).select().single()
    if (error) throw error
    const membership = await client().from('session_members').insert({ session_id: data.id, profile_id: user.id })
    if (membership.error) throw membership.error
    return data
  },
  async createClimb(input: { caption: string; sessionId?: string; file: File }) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const mediaPath = await uploadPrivateMedia(user.id, input.file)
    const { data, error } = await client().from('climbs').insert({ owner_id: user.id, session_id: input.sessionId, caption: input.caption, media_path: mediaPath, visibility: 'private' }).select().single()
    if (error) { await client().storage.from('climbing-media').remove([mediaPath]); throw error }
    return data
  },
  async createChallenge(input: BetaChallenge, climbId: string) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const { data, error } = await client().from('challenges').insert({ owner_id: user.id, climb_id: climbId, prompt: input.prompt, visibility: 'private' }).select().single()
    if (error) throw error; return data
  },
  async createShareLink(resourceType: 'climb' | 'challenge' | 'crew_invitation', resourceId: string, expiresAt?: string) {
    const user = await this.currentUser(); if (!user) throw new Error('Sign in required')
    const token = createToken(); const tokenHash = await sha256(token)
    const { error } = await client().from('share_links').insert({ owner_id: user.id, resource_type: resourceType, resource_id: resourceId, token_hash: tokenHash, expires_at: expiresAt })
    if (error) throw error
    return token
  },
  async revokeShareLink(resourceType: 'climb' | 'challenge' | 'crew_invitation', resourceId: string) {
    const { error } = await client().from('share_links').update({ revoked_at: new Date().toISOString() }).eq('resource_type', resourceType).eq('resource_id', resourceId).is('revoked_at', null)
    if (error) throw error
  }
}
