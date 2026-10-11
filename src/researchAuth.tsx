import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { backendConfigured, supabase } from './services/supabase'
import { researchBackend, type ConsentInput, type ResearchProfile } from './services/researchBackend'

interface ResearchAuthValue {
  configured: boolean
  loading: boolean
  session: Session | null
  profile: ResearchProfile | null
  error: string
  sendMagicLink(email: string): Promise<void>
  signInWithGoogle(): Promise<void>
  saveConsent(input: ConsentInput): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
  clearError(): void
}

const ResearchAuthContext = createContext<ResearchAuthValue | null>(null)
const REFERRAL_KEY = 'beta-research-referral'

export function ResearchAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ResearchProfile | null>(null)
  const [loading, setLoading] = useState(backendConfigured)
  const [error, setError] = useState('')

  const loadProfile = async (nextSession: Session | null) => {
    setSession(nextSession)
    if (!nextSession) { setProfile(null); return }
    try { setProfile(await researchBackend.profile()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load your research profile.') }
  }

  useEffect(() => {
    const referral = new URLSearchParams(location.search).get('ref')
    if (referral) sessionStorage.setItem(REFERRAL_KEY, referral)
    if (!supabase) { setLoading(false); return }
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
      return loadProfile(data.session)
    }).finally(() => setLoading(false))
    // Supabase runs auth callbacks while holding its session lock. Defer profile
    // queries until the callback returns so OAuth and magic-link redirects cannot
    // deadlock while trying to use the same client.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => { void loadProfile(nextSession) }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<ResearchAuthValue>(() => ({
    configured: backendConfigured, loading, session, profile, error,
    async sendMagicLink(email) { setError(''); try { const referral = sessionStorage.getItem(REFERRAL_KEY); if (referral) await researchBackend.requestReferralInvite(email, referral); else await researchBackend.signInWithEmail(email) } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not send the sign-in link.'; setError(message); throw cause } },
    async signInWithGoogle() { setError(''); try { await researchBackend.signInWithGoogle() } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not start Google login.'; setError(message); throw cause } },
    async saveConsent(input) { setError(''); try { const next = await researchBackend.saveConsent(input); setProfile(next); const referral = sessionStorage.getItem(REFERRAL_KEY); if (referral) { await researchBackend.claimReferral(referral); sessionStorage.removeItem(REFERRAL_KEY) } } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not save consent.'; setError(message); throw cause } },
    async signOut() { setError(''); await researchBackend.signOut(); setSession(null); setProfile(null) },
    async deleteAccount() { setError(''); try { await researchBackend.deleteAccount(); setSession(null); setProfile(null) } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not delete the account.'; setError(message); throw cause } },
    clearError() { setError('') },
  }), [loading, session, profile, error])

  return <ResearchAuthContext.Provider value={value}>{children}</ResearchAuthContext.Provider>
}

export function useResearchAuth() {
  const value = useContext(ResearchAuthContext)
  if (!value) throw new Error('useResearchAuth must be used inside ResearchAuthProvider')
  return value
}
