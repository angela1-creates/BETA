import { useEffect, useState } from 'react'
import { useResearchAuth } from '../researchAuth'
import { researchBackend, type ConsentInput, type ReferralMetrics } from '../services/researchBackend'
import { AccessibleModal } from './AccessibleModal'

export function ResearchAccountModal({ onClose }: { onClose: () => void }) {
  const auth = useResearchAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [experienceLevel, setExperienceLevel] = useState<ConsentInput['experienceLevel']>('recreational')
  const [primaryStyle, setPrimaryStyle] = useState<ConsentInput['primaryStyle']>('bouldering')
  const [heightCm, setHeightCm] = useState('')
  const [wingspanCm, setWingspanCm] = useState('')
  const [adult, setAdult] = useState(false)
  const [consent, setConsent] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [metrics, setMetrics] = useState<ReferralMetrics | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!auth.profile?.consentedAt) return
    void researchBackend.referralMetrics().then(setMetrics).catch(() => setMetrics(null))
  }, [auth.profile?.consentedAt])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try { await action() }
    catch { /* ResearchAuth exposes the actionable error in the dialog. */ }
    finally { setBusy(false) }
  }
  const sendLink = async () => run(async () => { await auth.sendMagicLink(email.trim()); setSent(true) })
  const saveConsent = async () => run(async () => auth.saveConsent({
    displayName: displayName.trim(), experienceLevel, primaryStyle,
    heightCm: heightCm ? Number(heightCm) : undefined,
    wingspanCm: wingspanCm ? Number(wingspanCm) : undefined,
  }))
  const referralUrl = auth.profile?.referralCode ? `${location.origin}${location.pathname}?ref=${auth.profile.referralCode}` : ''
  const copyReferral = async () => {
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return <AccessibleModal title="Research account" onClose={onClose}>
    {!auth.configured ? <div className="account-state"><span className="kicker">Setup required</span><h3>Private research accounts are not connected.</h3><p>Add the Supabase URL and anonymous browser key in Vercel after applying the reviewed migrations. The social demo remains local until then.</p></div>
      : auth.loading ? <div className="account-state"><p>Checking your research session…</p></div>
      : !auth.session ? <div className="account-state"><span className="kicker">Research pilot</span><h3>Save your route reads across devices.</h3><p>Enter your email address and we will send a one-time sign-in link. New testers can create an account here.</p><label>Email address<input type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setSent(false); auth.clearError() }} placeholder="you@example.com"/></label><button className="primary-button coral full" disabled={busy || !email.includes('@')} onClick={() => void sendLink()}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>{researchBackend.googleAuthConfigured && <button className="secondary-button full" disabled={busy} onClick={() => void run(auth.signInWithGoogle)}>Continue with Google</button>}{sent && <p className="form-success" role="status">Check your email. Open the link on this device to finish signing in.</p>}</div>
      : !auth.profile?.consentedAt ? <div className="account-state consent-state"><span className="kicker">Before the study</span><h3>Your climbing belongs to you.</h3><p>BETA stores your private route photos, predicted and actual movement, reflections, and the limited study details below. Researchers should use exported, de-identified results. You can withdraw and delete your account and media at any time.</p><label>Name shown to you<input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={60}/></label><div className="form-row"><label>Climbing experience<select value={experienceLevel} onChange={event => setExperienceLevel(event.target.value as ConsentInput['experienceLevel'])}><option value="new">New climber</option><option value="recreational">Recreational</option><option value="experienced">Experienced</option></select></label><label>Primary climbing style<select value={primaryStyle} onChange={event => setPrimaryStyle(event.target.value as ConsentInput['primaryStyle'])}><option value="bouldering">Bouldering</option><option value="top_rope">Top rope</option><option value="lead">Lead</option><option value="mixed">Mixed</option></select></label></div><div className="form-row"><label>Height, cm <small>optional</small><input type="number" min="100" max="250" value={heightCm} onChange={event => setHeightCm(event.target.value)}/></label><label>Wingspan, cm <small>optional</small><input type="number" min="100" max="280" value={wingspanCm} onChange={event => setWingspanCm(event.target.value)}/></label></div><label className="check-label"><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)}/>I confirm I am 18 or older.</label><label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>I consent to participate in this research pilot and to the private storage described above.</label><button className="primary-button coral full" disabled={busy || !displayName.trim() || !adult || !consent} onClick={() => void saveConsent()}>{busy ? 'Saving…' : 'Consent and continue'}</button><button className="secondary-button full" disabled={busy} onClick={() => void run(auth.signOut)}>Log out without consenting</button><details className="delete-account"><summary>Delete this unconsented account</summary><p>You can delete the login account without joining the study. Type DELETE to continue.</p><input value={deleteText} onChange={event => setDeleteText(event.target.value)} aria-label="Type DELETE to confirm account deletion"/><button className="danger-button full" disabled={busy || deleteText !== 'DELETE'} onClick={() => void run(async () => { await auth.deleteAccount(); onClose() })}>{busy ? 'Deleting…' : 'Delete account'}</button></details></div>
      : <div className="account-state"><span className="kicker">Pilot backend connected</span><h3>{auth.profile.displayName}</h3><p>{auth.session.user.email}. Private Route Lab data and media sync to your account. Real adult partner matching is available to consenting pilot participants. Crews, challenges, and the Share Wall remain stored locally on this device.</p><section className="referral-panel"><span className="kicker">Invite a climber</span><p>Share this unique link with a climber you know. BETA records aggregate recruitment progress, not their email or profile details.</p><div className="copy-row"><input readOnly value={referralUrl} aria-label="Your research invitation link"/><button className="secondary-button" onClick={() => void copyReferral()}>{copied ? 'Copied' : 'Copy link'}</button></div><div className="referral-metrics"><span><strong>{metrics?.invited ?? 0}</strong> invited</span><span><strong>{metrics?.signedUp ?? 0}</strong> signed up</span><span><strong>{metrics?.completedWorkflow ?? 0}</strong> completed workflow</span></div></section><button className="secondary-button full" disabled={busy} onClick={() => void run(auth.signOut)}>Log out</button><details className="delete-account"><summary>Delete account and private media</summary><p>This permanently removes your account records and uploaded media. Type DELETE to continue.</p><input value={deleteText} onChange={event => setDeleteText(event.target.value)} aria-label="Type DELETE to confirm account deletion"/><button className="danger-button full" disabled={busy || deleteText !== 'DELETE'} onClick={() => void run(async () => { await auth.deleteAccount(); onClose() })}>{busy ? 'Deleting…' : 'Delete my account and media'}</button></details></div>}
    {auth.error && <p className="form-error" role="alert">{auth.error}</p>}
  </AccessibleModal>
}
