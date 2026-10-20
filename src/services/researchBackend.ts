import type { Session, User } from '@supabase/supabase-js'
import type { Attempt, Route } from '../types'
import { createSignedMediaUrl, googleAuthConfigured, supabase, uploadPrivateMedia } from './supabase'

export interface ResearchProfile {
  id: string
  displayName: string
  consentedAt?: string
  experienceLevel?: 'new' | 'recreational' | 'experienced'
  primaryStyle?: 'bouldering' | 'top_rope' | 'lead' | 'mixed'
  heightCm?: number
  wingspanCm?: number
  referralCode: string
}

export interface ConsentInput {
  displayName: string
  experienceLevel: NonNullable<ResearchProfile['experienceLevel']>
  primaryStyle: NonNullable<ResearchProfile['primaryStyle']>
  heightCm?: number
  wingspanCm?: number
}

export interface ReferralMetrics { invited: number; signedUp: number; completedWorkflow: number }
export interface RemoteResearchData { routes: Route[]; attempts: Record<string, Attempt> }

const client = () => {
  if (!supabase) throw new Error('The research backend is not configured.')
  return supabase
}

const redirectUrl = () => {
  const target = new URL(import.meta.env.BASE_URL, location.origin)
  const current = new URLSearchParams(location.search)
  for (const key of ['crewInvite', 'ref']) {
    const value = current.get(key)
    if (value) target.searchParams.set(key, value)
  }
  return target.toString()
}
const currentUser = async (): Promise<User> => {
  const { data, error } = await client().auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in required')
  return data.user
}

const toProfile = (row: Record<string, unknown>): ResearchProfile => ({
  id: String(row.id),
  displayName: String(row.display_name || ''),
  consentedAt: row.consented_at ? String(row.consented_at) : undefined,
  experienceLevel: row.experience_level as ResearchProfile['experienceLevel'],
  primaryStyle: row.primary_style as ResearchProfile['primaryStyle'],
  heightCm: row.height_cm == null ? undefined : Number(row.height_cm),
  wingspanCm: row.wingspan_cm == null ? undefined : Number(row.wingspan_cm),
  referralCode: String(row.referral_code || ''),
})

export const researchBackend = {
  googleAuthConfigured,
  async session(): Promise<Session | null> {
    const { data, error } = await client().auth.getSession()
    if (error) throw error
    return data.session
  },
  async signInWithEmail(email: string) {
    const { error } = await client().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } })
    if (error) throw error
  },
  async requestReferralInvite(email: string, referralCode: string) {
    const { error } = await client().functions.invoke('request-research-invite', { body: { email, referralCode } })
    if (error) throw error
  },
  async signInWithGoogle() {
    if (!googleAuthConfigured) throw new Error('Google login is not enabled for this pilot.')
    const { error } = await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } })
    if (error) throw error
  },
  async signOut() {
    const { error } = await client().auth.signOut()
    if (error) throw error
  },
  async profile(): Promise<ResearchProfile | null> {
    const user = await currentUser()
    const { data, error } = await client().from('profiles').select('id,display_name,consented_at,experience_level,primary_style,height_cm,wingspan_cm,referral_code').eq('id', user.id).maybeSingle()
    if (error) throw error
    return data ? toProfile(data) : null
  },
  async saveConsent(input: ConsentInput): Promise<ResearchProfile> {
    const user = await currentUser()
    const { data, error } = await client().from('profiles').upsert({
      id: user.id,
      display_name: input.displayName.trim(),
      is_adult: true,
      visibility: 'invited',
      consented_at: new Date().toISOString(),
      experience_level: input.experienceLevel,
      primary_style: input.primaryStyle,
      height_cm: input.heightCm ?? null,
      wingspan_cm: input.wingspanCm ?? null,
    }).select('id,display_name,consented_at,experience_level,primary_style,height_cm,wingspan_cm,referral_code').single()
    if (error) throw error
    return toProfile(data)
  },
  async claimReferral(code: string) {
    const { data, error } = await client().rpc('claim_research_referral', { code })
    if (error) throw error
    return Boolean(data)
  },
  async referralMetrics(): Promise<ReferralMetrics> {
    const { data, error } = await client().rpc('my_research_referral_metrics')
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return { invited: Number(row?.invited || 0), signedUp: Number(row?.signed_up || 0), completedWorkflow: Number(row?.completed_workflow || 0) }
  },
  async loadResearchData(): Promise<RemoteResearchData> {
    const user = await currentUser()
    const [{ data: routeRows, error: routeError }, { data: attemptRows, error: attemptError }] = await Promise.all([
      client().from('research_routes').select('*').eq('owner_id', user.id).order('created_at'),
      client().from('route_attempts').select('*').eq('owner_id', user.id),
    ])
    if (routeError) throw routeError
    if (attemptError) throw attemptError
    const routeById = new Map<string, Record<string, unknown>>()
    const routes = await Promise.all((routeRows || []).map(async row => {
      routeById.set(row.id, row)
      const mediaUrl = row.media_path ? await createSignedMediaUrl(row.media_path) : ''
      return {
        id: row.route_key,
        remoteId: row.id,
        title: row.title,
        image: mediaUrl,
        grade: row.grade || 'Open',
        colorName: row.color_name || 'Custom',
        notes: row.source_kind === 'upload' ? 'Your private route study.' : '',
        insight: 'Start with what catches your attention.',
        accent: '#315c4d',
        hints: [],
        mediaPath: row.media_path || undefined,
        ownerUploaded: row.source_kind === 'upload',
      } satisfies Route
    }))
    const attempts: Record<string, Attempt> = {}
    await Promise.all((attemptRows || []).map(async row => {
      const linkedRoute = routeById.get(row.route_id)
      if (!linkedRoute) return
      attempts[String(linkedRoute.route_key)] = {
        predictedBeta: row.predicted_beta || [], actualBeta: row.actual_beta || [],
        hintLevelUsed: row.hint_level_used, confidenceBefore: row.confidence_before, confidenceAfter: row.confidence_after,
        reflection: { surprised: '', misread: '', noticed: '', hintImpact: '', ...(row.reflection || {}) },
        mediaPath: row.media_path || undefined, mediaKind: row.media_kind || undefined,
        mediaUrl: row.media_path ? await createSignedMediaUrl(row.media_path) : undefined,
      }
    }))
    return { routes: routes.filter(route => route.ownerUploaded), attempts }
  },
  async ensureRoute(route: Route) {
    const user = await currentUser()
    const { data, error } = await client().from('research_routes').upsert({
      owner_id: user.id, route_key: route.id, title: route.title, grade: route.grade,
      color_name: route.colorName, media_path: route.mediaPath || null, source_kind: route.ownerUploaded ? 'upload' : 'builtin',
    }, { onConflict: 'owner_id,route_key' }).select('id').single()
    if (error) throw error
    return String(data.id)
  },
  async saveAttempt(route: Route, attempt: Attempt) {
    const user = await currentUser()
    const routeId = await this.ensureRoute(route)
    const { data, error } = await client().from('route_attempts').upsert({
      owner_id: user.id, route_id: routeId, predicted_beta: attempt.predictedBeta, actual_beta: attempt.actualBeta,
      hint_level_used: attempt.hintLevelUsed, confidence_before: attempt.confidenceBefore,
      confidence_after: attempt.confidenceAfter, reflection: attempt.reflection,
      media_path: attempt.mediaPath || null, media_kind: attempt.mediaKind || null,
    }, { onConflict: 'owner_id,route_id' }).select('id').single()
    if (error) throw error
    return String(data.id)
  },
  async createUploadedRoute(file: File, onProgress?: (percent: number) => void): Promise<Route> {
    const user = await currentUser()
    const routeKey = `upload-${crypto.randomUUID()}`
    const mediaPath = await uploadPrivateMedia(user.id, file, onProgress)
    const route: Route = {
      id: routeKey, title: file.name.replace(/\.[^.]+$/, '') || 'My route', image: '', grade: 'Open', colorName: 'Custom',
      accent: '#315c4d', notes: 'Your private route study.', insight: 'Start with what catches your attention.',
      hints: [], mediaPath, ownerUploaded: true,
    }
    try {
      route.remoteId = await this.ensureRoute(route)
      route.image = await createSignedMediaUrl(mediaPath)
      return route
    } catch (error) {
      await client().storage.from('climbing-media').remove([mediaPath])
      throw error
    }
  },
  async uploadAttemptMedia(route: Route, attempt: Attempt, file: File, onProgress?: (percent: number) => void) {
    const user = await currentUser()
    await this.saveAttempt(route, attempt)
    const mediaPath = await uploadPrivateMedia(user.id, file, onProgress)
    const routeId = await this.ensureRoute(route)
    const mediaKind = file.type.startsWith('video/') ? 'video' as const : 'image' as const
    const { error } = await client().from('route_attempts').update({ media_path: mediaPath, media_kind: mediaKind }).eq('owner_id', user.id).eq('route_id', routeId)
    if (error) { await client().storage.from('climbing-media').remove([mediaPath]); throw error }
    if (attempt.mediaPath) await client().storage.from('climbing-media').remove([attempt.mediaPath])
    return { mediaPath, mediaKind, mediaUrl: await createSignedMediaUrl(mediaPath) }
  },
  async deleteAttemptMedia(route: Route, attempt: Attempt) {
    if (!attempt.mediaPath) return
    const user = await currentUser()
    const routeId = await this.ensureRoute(route)
    const { error } = await client().from('route_attempts').update({ media_path: null, media_kind: null }).eq('owner_id', user.id).eq('route_id', routeId)
    if (error) throw error
    const removal = await client().storage.from('climbing-media').remove([attempt.mediaPath])
    if (removal.error) throw removal.error
  },
  async deleteAccount() {
    const { error } = await client().functions.invoke('delete-account', { body: { confirmation: 'DELETE' } })
    if (error) throw error
  },
}
