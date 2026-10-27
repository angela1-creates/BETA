import { useEffect, useRef, useState } from 'react'
import LegacyRouteLab from './App'
import { loadDemoState, saveDemoState } from './demo'
import { calendarHref, createToken, hasPendingInvitation, isRequestActive, nextConfirmedSession, requestDisplayStatus, screenHref, trackEvent, transitionInvitation, transitionRequest } from './social'
import type { AvailabilityRequest, BetaChallenge, CalendarSession, ClimbMoment, Crew, CrewPilotContributionKind, DemoState, Invitation, SessionProposal } from './social'
import { Icon } from './components/Icon'
import { AccessibleModal } from './components/AccessibleModal'
import { ResearchAccountModal } from './components/ResearchAccountModal'
import { useResearchAuth } from './researchAuth'
import { useTranslation } from 'react-i18next'
import { backendConfigured } from './services/supabase'
import { platform, type MediaDraft } from './platform'
import { MOVEMENT_GYMS, movementGymByName } from './movementGyms'
import { partnerBackend, type PartnerActivity, type PartnerRequest } from './services/partnerBackend'
import { crewBackend, type CrewInvitationPreview, type CrewInvitationRecord, type CrewRecord } from './services/crewBackend'
import './social-fixes.css'

type Screen = 'home' | 'find' | 'climbs' | 'share' | 'crew' | 'learn'
const uid = () => Math.random().toString(36).slice(2, 10)
const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string' ? cause.message : fallback
const initialScreen = (): Screen => {
  const requested = new URLSearchParams(location.search).get('screen')
  return requested && ['home', 'find', 'climbs', 'share', 'crew', 'learn'].includes(requested) ? requested as Screen : 'home'
}

export default function SocialApp() {
  const { i18n, t } = useTranslation()
  const auth = useResearchAuth()
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [demo, setDemo] = useState<DemoState>(loadDemoState)
  const [toast, setToast] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [shareClimbId, setShareClimbId] = useState('')
  const sharedToken = new URLSearchParams(location.search).get('shared')
  const crewInviteToken = new URLSearchParams(location.search).get('crewInvite')
  useEffect(() => { saveDemoState(demo) }, [demo])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer) }, [toast])
  const update = (next: DemoState, event?: string) => setDemo(event ? trackEvent(next, event) : next)
  useEffect(() => { const onPopState = () => setScreen(initialScreen()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState) }, [])
  const navigate = (next: Screen) => { if (next !== 'share') setShareClimbId(''); setScreen(next); history.pushState({ screen: next }, '', screenHref(location.pathname, location.search, next)); window.scrollTo(0, 0) }
  if (crewInviteToken) return <div className="app-shell social-shell"><CrewInvitationView token={crewInviteToken} onAccount={() => setAccountOpen(true)}/>{accountOpen && <ResearchAccountModal onClose={() => setAccountOpen(false)}/>}</div>
  if (sharedToken) return <SharedView demo={demo} token={sharedToken}/>
  if (screen === 'learn') return <div className="app-shell social-shell route-lab-shell"><Header screen={screen} onNavigate={navigate} language={i18n.language} onLanguage={language => void i18n.changeLanguage(language)} accountLabel={auth.session?.user.email?.[0]?.toUpperCase() || 'A'} onAccount={() => setAccountOpen(true)}/><div className="route-lab-return"><button className="text-button" onClick={() => navigate('climbs')}>{t('routeLab.context.back')}</button><span><strong>{t('routeLab.context.title')}</strong><small>{t('routeLab.context.subtitle')}</small></span></div><div className="nested-lab"><LegacyRouteLab /></div>{accountOpen && <ResearchAccountModal onClose={() => setAccountOpen(false)}/>}</div>
  return <div className="app-shell social-shell"><Header screen={screen} onNavigate={navigate} language={i18n.language} onLanguage={language => void i18n.changeLanguage(language)} accountLabel={auth.session?.user.email?.[0]?.toUpperCase() || 'A'} onAccount={() => setAccountOpen(true)}/><DemoBanner/>
    {screen === 'home' && <Home onNavigate={navigate} demo={demo}/>} {screen === 'find' && <FindCrew demo={demo} update={update} notify={setToast} onAccount={() => setAccountOpen(true)} onCrew={() => navigate('crew')}/>} {screen === 'climbs' && <MyClimbs demo={demo} update={update} notify={setToast} onLearn={() => navigate('learn')} onShare={id => { setShareClimbId(id); navigate('share') }}/>} {screen === 'share' && <ShareHub demo={demo} update={update} notify={setToast} initialSelected={shareClimbId}/>} {screen === 'crew' && (backendConfigured ? <MyCrewPersistent demo={demo} update={update} notify={setToast} onFind={() => navigate('find')} onAccount={() => setAccountOpen(true)} onCapture={() => navigate('climbs')}/> : <MyCrewV2 demo={demo} update={update} notify={setToast} onFind={() => navigate('find')} onCapture={() => navigate('climbs')}/>)} {toast && <div className="toast" role="status" aria-live="polite">✓ {toast}</div>}
    {accountOpen && <ResearchAccountModal onClose={() => setAccountOpen(false)}/>}
  </div>
}

function DemoBanner() { const { t } = useTranslation(); if (backendConfigured) return null; return <div className="demo-banner"><strong>{t('demo.title')}</strong><span>{t('demo.detail')}</span></div> }

function Header({ screen, onNavigate, language, onLanguage, accountLabel, onAccount }: { screen: Screen; onNavigate: (screen: Screen) => void; language: string; onLanguage: (language: string) => void; accountLabel: string; onAccount: () => void }) {
  const { t } = useTranslation(); const items: [Screen, string][] = [['home', t('nav.home')], ['learn', t('nav.routeLab')], ['climbs', t('nav.climbs')], ['share', t('nav.challenges')], ['crew', t('nav.connect')]]
  const active = (id: Screen) => id === 'crew' ? screen === 'find' || screen === 'crew' : screen === id
  return <><header className="site-header social-header"><button className="logo" onClick={() => onNavigate('home')} aria-label={t('nav.home')}><span>β</span>BETA</button><nav aria-label="Primary navigation">{items.map(([id, label]) => <button key={id} className={active(id) ? 'active' : ''} onClick={() => onNavigate(id)}>{label}</button>)}</nav><div className="header-actions"><button className="language-button" onClick={() => onLanguage(language.startsWith('zh') ? 'en' : 'zh-CN')} aria-label={t('language.label')}>{language.startsWith('zh') ? 'EN' : '中文'}</button><button className="avatar-button" onClick={onAccount} aria-label="Research account">{accountLabel}</button></div></header><nav className="mobile-nav" aria-label="Mobile navigation">{items.map(([id, label]) => <button key={id} className={active(id) ? 'active' : ''} onClick={() => onNavigate(id)}><span aria-hidden="true">{id === 'home' ? '⌂' : id === 'learn' ? '◇' : id === 'climbs' ? '△' : id === 'share' ? '↗' : '◎'}</span>{label}</button>)}</nav></>
}

function ConnectTabs({ active, onFind, onCrew }: { active: 'find' | 'crew'; onFind: () => void; onCrew: () => void }) {
  const { t } = useTranslation()
  return <nav className="connect-tabs" aria-label={t('connect.label')}><button className={active === 'crew' ? 'active' : ''} onClick={onCrew}>{t('connect.crew')}</button><button className={active === 'find' ? 'active' : ''} onClick={onFind}>{t('connect.find')}</button></nav>
}

function Home({ onNavigate, demo }: { onNavigate: (screen: Screen) => void; demo: DemoState }) {
  const { t } = useTranslation()
  const pilotCrew = demo.crews.find(crew => crew.id === demo.crewPilots[0]?.crewId)
  return <main className="social-home"><section className="social-hero"><div className="hero-content"><span className="kicker">{t('home.kicker')}</span><h1>{t('home.titleStart')} <em>{t('home.titleEnd')}</em></h1><p className="hero-promise">{t('home.subtitle')}</p><div className="hero-actions"><button className="primary-button coral" onClick={() => onNavigate('crew')}>{t('home.crew')} <Icon name="arrow"/></button><button className="secondary-button" onClick={() => onNavigate('climbs')}>{t('home.share')}</button></div><button className="find-link" onClick={() => onNavigate('find')}>{t('home.need')} <strong>{t('home.find')}</strong></button><div className="trust-row"><span>{t('home.solo')}</span><span>{t('home.privacy')}</span><span>{t('home.adults')}</span></div></div><div className="hero-photo-card"><img src={`${import.meta.env.BASE_URL}routes/feet-first-v1-blue.webp`} alt="Climber exploring a blue indoor route"/><div className="floating-session"><span className="pulse"/><div><small>{backendConfigured ? 'Private crews · sign-in required' : `${pilotCrew?.members.length || 6} crew members · two sessions planned`}</small><strong>Help each other climb. Come back together.</strong></div></div></div></section>
    <ProductTour onNavigate={onNavigate}/>
    <section className="story-strip"><div><span className="kicker light">{t('home.loop.kicker')}</span><h2>{t('home.loop.titleA')}<br/>{t('home.loop.titleB')}</h2></div><ol>{(['read', 'climb', 'capture', 'challenge', 'compare', 'connect', 'again'] as const).map((key, index) => <li key={key}><span>{index + 1}</span>{t(`home.loop.${key}`)}</li>)}</ol></section></main>
}

function ProductTour({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { t } = useTranslation()
  const steps = [
    { key: 'pick', image: 'feet-first-v1-blue.webp' },
    { key: 'explore', image: 'multiple-betas-v4-sage.webp' },
    { key: 'try', image: 'real-study-v2.jpg' },
    { key: 'share', image: 'weight-shift-v3-coral.webp' },
    { key: 'support', image: 'library-v4-sage.webp' },
    { key: 'return', image: 'real-study-v6.jpg' },
  ]
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setStep(value => (value + 1) % steps.length), 6000); return () => window.clearInterval(timer) }, [playing, steps.length])
  const current = steps[step]
  const copy = (field: 'label' | 'title' | 'text') => t(`home.tour.steps.${current.key}.${field}`)
  return <section className="product-tour" aria-label={t('home.tour.aria')}><div className="tour-copy"><span className="kicker">{t('home.tour.kicker', { current: step + 1, total: steps.length })}</span><h2>{t('home.tour.title')}</h2><div className="tour-tabs" role="tablist">{steps.map((item, index) => <button role="tab" aria-selected={step === index} className={step === index ? 'active' : ''} key={item.key} onClick={() => { setStep(index); setPlaying(false) }}>{t(`home.tour.steps.${item.key}.label`)}</button>)}</div><h3>{copy('title')}</h3><p>{copy('text')}</p><button className="primary-button coral" onClick={() => onNavigate('crew')}>{t('home.tour.action')} <Icon name="arrow"/></button></div><div className="tour-player"><div className="tour-screen" key={current.key}><img src={`${import.meta.env.BASE_URL}routes/${current.image}`} alt=""/><div><span>{t('home.tour.example')} · {copy('label').toUpperCase()}</span><strong>{copy('title')}</strong><small>{copy('text')}</small></div></div><button className="tour-play" onClick={() => setPlaying(value => !value)} aria-label={t(playing ? 'home.tour.pause' : 'home.tour.play')}>{playing ? 'Ⅱ' : '▶'}</button><div className="tour-progress" aria-hidden="true"><i className={playing ? 'playing' : ''} key={`${step}-${playing}`}/></div></div></section>
}

function FindCrew({ demo, update, notify, onAccount, onCrew }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; onAccount: () => void; onCrew: () => void }) {
  const { t } = useTranslation()
  const auth = useResearchAuth()
  const [showForm, setShowForm] = useState(false)
  const [gym, setGym] = useState('Movement Sunnyvale')
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [formError, setFormError] = useState('')
  const [board, setBoard] = useState<PartnerRequest[]>([])
  const [activity, setActivity] = useState<PartnerActivity>({ requests: [], invitations: [], sessions: [] })
  const [loading, setLoading] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const realMode = Boolean(backendConfigured && auth.session && auth.profile?.consentedAt)
  const selectedGym = movementGymByName(gym)
  const visibleDemo = backendConfigured ? [] : demo.requests.filter(request => isRequestActive(request) && request.gym === gym && !demo.safety.blockedIds.includes(request.personId))
  const sessionsForCalendar: CalendarSession[] = realMode ? activity.sessions : demo.sessions
  const nextSession = nextConfirmedSession(sessionsForCalendar)

  const refresh = async () => {
    if (!realMode) return
    setLoading(true); setRemoteError('')
    try { const [nextBoard, nextActivity] = await Promise.all([partnerBackend.board(selectedGym.id), partnerBackend.activity()]); setBoard(nextBoard); setActivity(nextActivity) }
    catch (cause) { setRemoteError(cause instanceof Error ? cause.message : 'Partner matching could not load.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [realMode, selectedGym.id])

  const closeForm = () => { setShowForm(false); setAdultConfirmed(false); setFormError('') }
  const createRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!adultConfirmed) { setFormError(t('find.validation')); return }
    const data = new FormData(event.currentTarget)
    const starts = new Date(); starts.setDate(starts.getDate() + Number(data.get('day') || 1)); starts.setHours(Number(data.get('hour') || 18), 0, 0, 0)
    const ends = new Date(starts); ends.setHours(ends.getHours() + 2)
    const discipline = String(data.get('discipline'))
    if (!selectedGym.disciplines.includes(discipline as typeof selectedGym.disciplines[number])) { setFormError(`${discipline} is not offered at ${selectedGym.name}.`); return }
    if (realMode && auth.session) {
      try { setLoading(true); await partnerBackend.create({ ownerId: auth.session.user.id, gymId: selectedGym.id, startsAt: starts.toISOString(), endsAt: ends.toISOString(), disciplines: [discipline], lookingFor: String(data.get('lookingFor')), message: String(data.get('message') || '') }); closeForm(); await refresh(); notify(t('find.liveNotice')) }
      catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not publish availability.') }
      finally { setLoading(false) }
      return
    }
    if (backendConfigured) {
      setFormError('Sign in and complete adult consent before publishing availability.')
      return
    }
    const request: AvailabilityRequest = { id: uid(), personId: 'you', personName: 'You', avatar: 'A', gym, startsAt: starts.toISOString(), endsAt: ends.toISOString(), disciplines: [discipline], lookingFor: String(data.get('lookingFor')), experience: String(data.get('experience') || ''), message: String(data.get('message') || ''), status: 'active', selfReported: true, fictional: true }
    update({ ...demo, requests: [request, ...demo.requests] }, 'availability_created'); closeForm(); notify(t('find.demoNotice'))
  }
  const runRemote = async (work: () => Promise<void>, success: string) => { try { setLoading(true); await work(); await refresh(); notify(success) } catch (cause) { setRemoteError(cause instanceof Error ? cause.message : 'That action could not be completed.') } finally { setLoading(false) } }
  const inviteDemo = (request: AvailabilityRequest) => { if (hasPendingInvitation(demo.invitations, request.id)) return notify(t('status.duplicate')); const invitation: Invitation = { id: uid(), requestId: request.id, fromId: 'you', toId: request.personId, status: 'pending', createdAt: new Date().toISOString() }; update({ ...demo, requests: demo.requests.map(item => item.id === request.id && item.status === 'active' ? transitionRequest(item, 'pending') : item), invitations: [...demo.invitations, invitation] }, 'partner_invite_sent'); notify(`Demo invitation saved for ${request.personName}`) }
  const acceptDemo = (invitation: Invitation, request: AvailabilityRequest) => { const session = { id: uid(), requestId: request.id, partnerIds: ['you', request.personId], gym: request.gym, startsAt: request.startsAt, status: 'confirmed' as const }; update({ ...demo, requests: demo.requests.map(item => item.id === request.id && item.status === 'pending' ? transitionRequest(item, 'confirmed') : item), invitations: demo.invitations.map(item => item.id === invitation.id ? transitionInvitation(item, 'accepted') : item), sessions: [...demo.sessions, session] }, 'session_confirmed'); notify(t('find.confirmed')) }
  const report = async (request: PartnerRequest) => { const reason = window.prompt('Briefly describe the safety concern. Do not include sensitive personal information.'); if (!reason?.trim()) return; await runRemote(() => partnerBackend.report(request.ownerId, reason.trim()), 'Report submitted') }

  return <main className="page social-page"><ConnectTabs active="find" onFind={() => undefined} onCrew={onCrew}/><PageTitle kicker={t('find.kicker')} title={t('find.title')} text={t('find.subtitle')} action={<button className="primary-button coral" disabled={backendConfigured && !realMode} onClick={() => setShowForm(true)}>＋ {t('find.create')}</button>}/>
    {nextSession && <section className="confirmed-strip" aria-label={t('session.confirmed')}><span>✓</span><div><strong>{t('session.next')}</strong><small>{formatTime(nextSession.startsAt)} · {nextSession.gymName || nextSession.gym}</small></div><a className="secondary-button pale" href={calendarHref(nextSession)} download="beta-climbing-session.ics">{t('session.calendar')}</a></section>}
    <div className="safety-callout"><span>18+</span><div><strong>{t('find.safetyTitle')}</strong><p>{t('find.safety')}</p></div></div>
    {backendConfigured && !realMode && <section className="connection-callout"><div><span className="kicker">{t('find.realBoard')}</span><h2>{t('find.realBoardTitle')}</h2><p>{t('find.realBoardHelp')}</p></div><button className="primary-button coral" onClick={onAccount}>Open account</button></section>}
    {showForm && <AccessibleModal title={t('find.formTitle')} onClose={closeForm}><form onSubmit={event => void createRequest(event)} noValidate><span className="kicker">{t('find.fast')}</span><label>{t('find.gym')}<select value={gym} onChange={event => setGym(event.target.value)}>{MOVEMENT_GYMS.map(item => <option key={item.id}>{item.name}</option>)}</select></label><small>{selectedGym.disciplines.join(' · ')}</small><div className="form-row"><label>{t('find.day')}<select name="day"><option value="1">Tomorrow</option><option value="2">In two days</option><option value="3">This weekend</option></select></label><label>{t('find.time')}<select name="hour"><option value="18">6:00 PM</option><option value="10">10:00 AM</option><option value="14">2:00 PM</option></select></label></div><div className="form-row"><label>{t('find.climbing')}<select name="discipline">{selectedGym.disciplines.map(item => <option key={item}>{item}</option>)}</select></label><label>{t('find.looking')}<select name="lookingFor"><option>Belay partner</option><option>Climbing buddy</option><option>Small group</option></select></label></div><label>{t('find.message')} <small>{t('common.optional')}</small><textarea name="message" placeholder="Happy to trade belays and take turns projecting." maxLength={180}/></label><label className="check-label"><input type="checkbox" checked={adultConfirmed} onChange={event => { setAdultConfirmed(event.target.checked); setFormError('') }}/>{t('find.consent')}</label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="confirm-actions"><button className="secondary-button" type="button" onClick={closeForm}>{t('common.cancel')}</button><button className="primary-button coral" type="submit" disabled={loading}>{loading ? 'Publishing…' : t(realMode ? 'find.publish' : 'find.publishDemo')}</button></div></form></AccessibleModal>}
    <div className="filter-bar"><label>Movement gym<select value={gym} onChange={event => setGym(event.target.value)}>{MOVEMENT_GYMS.map(item => <option key={item.id}>{item.name}</option>)}</select></label><span>{realMode ? board.length : visibleDemo.length} active now</span></div>
    {remoteError && <p className="form-error board-error" role="alert">{remoteError} <button className="text-button" onClick={() => void refresh()}>Try again</button></p>}
    {realMode && activity.invitations.some(item => item.status === 'pending') && <section className="section-block partner-inbox"><div className="section-heading"><div><span className="kicker">Your invitations</span><h2>Ready when both climbers say yes.</h2></div></div><div className="request-grid">{activity.invitations.filter(item => item.status === 'pending').map(invite => <article className="request-card" key={invite.id}><div className="request-top"><span className="person-avatar">{invite.counterpartName[0]}</span><div><strong>{invite.counterpartName}</strong><small>{invite.direction === 'received' ? 'Wants to join your request' : 'Your invitation is waiting'}</small></div><span className="status pending">pending</span></div><div className="request-details"><span>⌖ {invite.gymName}</span><span>◷ {formatTime(invite.startsAt)}</span><span>△ {invite.disciplines.join(' + ')}</span></div><div className="card-actions">{invite.direction === 'received' ? <><button className="primary-button" onClick={() => void runRemote(() => partnerBackend.respond(invite.id, 'accepted'), 'Session confirmed')}>Accept</button><button className="secondary-button" onClick={() => void runRemote(() => partnerBackend.respond(invite.id, 'declined'), 'Invitation declined')}>Decline</button></> : <button className="secondary-button" onClick={() => void runRemote(() => partnerBackend.cancelInvitation(invite.id), 'Invitation cancelled')}>Cancel invitation</button>}</div></article>)}</div></section>}
    <div className="request-grid">{realMode ? <>{activity.requests.filter(item => item.status !== 'cancelled' && item.status !== 'expired').map(request => <article className="request-card" key={request.id}><div className="request-top"><span className="person-avatar">{request.displayName[0]}</span><div><strong>Your request</strong><small>Visible to consenting adult testers</small></div><span className={`status ${request.status}`}>{request.status}</span></div><h3>{request.message || 'Looking for someone to climb with.'}</h3><div className="request-details"><span>⌖ {request.gymName}</span><span>◷ {formatTime(request.startsAt)}</span><span>△ {request.disciplines.join(' + ')} · {request.lookingFor}</span></div>{request.status === 'active' && <button className="secondary-button" onClick={() => void runRemote(() => partnerBackend.cancelRequest(request.id), 'Request cancelled')}>Cancel request</button>}</article>)}{board.map(request => <article className="request-card" key={request.id}><div className="request-top"><span className="person-avatar">{request.displayName[0]}</span><div><strong>{request.displayName}</strong><small>Real BETA pilot participant</small></div><span className="status active">active</span></div><h3>{request.message || 'Looking for someone to climb with.'}</h3><div className="request-details"><span>⌖ {request.gymName}</span><span>◷ {formatTime(request.startsAt)}</span><span>△ {request.disciplines.join(' + ')} · {request.lookingFor}</span>{request.experienceLevel && <span>◎ {request.experienceLevel} · self-reported</span>}</div><p className="self-report">Belay competence is self-reported. Complete normal partner checks and all required gym tests.</p><div className="card-actions"><button className="primary-button" onClick={() => void runRemote(() => partnerBackend.invite(request.id), `Invitation sent to ${request.displayName}`)}>Invite to climb <Icon name="arrow"/></button><button className="text-button" onClick={() => void runRemote(() => partnerBackend.block(request.ownerId), `${request.displayName} blocked`)}>Block</button><button className="text-button" onClick={() => void report(request)}>Report</button></div></article>)}</> : visibleDemo.map(request => { const invitation = demo.invitations.find(item => item.requestId === request.id); const status = requestDisplayStatus(request, demo.invitations); return <article className="request-card" key={request.id}><div className="request-top"><span className="person-avatar">{request.avatar}</span><div><strong>{request.personName}</strong><small>Fictional demo climber</small></div><span className={`status ${status}`}>{status}</span></div><h3>{request.message}</h3><div className="request-details"><span>⌖ {request.gym}</span><span>◷ {formatTime(request.startsAt)}</span><span>△ {request.disciplines.join(' + ')} · {request.lookingFor}</span></div><div className="card-actions">{invitation?.status === 'pending' ? <button className="primary-button" onClick={() => acceptDemo(invitation, request)}>Simulate acceptance</button> : <button className="primary-button" onClick={() => inviteDemo(request)}>Invite in demo <Icon name="arrow"/></button>}</div></article> })}</div>
    {!loading && ((realMode && board.length === 0 && activity.requests.length === 0) || (!backendConfigured && visibleDemo.length === 0)) && <Empty title="No active requests here yet" text="Be the first to share a time window at this gym." action="Create availability" onAction={() => setShowForm(true)}/>} {loading && <p className="loading-state" role="status">Refreshing the partner board…</p>}
  </main>
}

function MyClimbs({ demo, update, notify, onLearn, onShare }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; onLearn: () => void; onShare: (id: string) => void }) {
  const { t } = useTranslation(); const fileRef = useRef<HTMLInputElement>(null); const [caption, setCaption] = useState(''); const [draft, setDraft] = useState<MediaDraft | null>(null); const [savedClimbId, setSavedClimbId] = useState('')
  const discard = () => { if (draft) platform.media.releaseDraft(draft); setDraft(null); if (fileRef.current) fileRef.current.value = '' }
  const choose = (file?: File) => { if (!file) return; if (draft) platform.media.releaseDraft(draft); setDraft(platform.media.createDraft(file)) }
  const confirm = () => { if (!draft) return; const createdAt = new Date(); const fallbackTitle = `Climb · ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(createdAt)}`; const climb: ClimbMoment = { id: uid(), title: caption.trim() || fallbackTitle, caption: caption.trim() || 'One for the crew.', mediaUrl: draft.previewUrl, mediaKind: draft.kind, private: true, createdAt: createdAt.toISOString() }; update({ ...demo, climbs: [climb, ...demo.climbs] }, 'climb_uploaded'); setSavedClimbId(climb.id); setDraft(null); setCaption(''); if (fileRef.current) fileRef.current.value = ''; notify(t('climbs.saved')) }
  return <main className="page social-page"><PageTitle kicker={t('climbs.kicker')} title={t('climbs.title')} text={t('climbs.subtitle')}/>{savedClimbId && <section className="next-step-card"><span>✓</span><div><strong>Your climb is saved privately.</strong><p>Next, preview the finished card and choose whether to create a share link.</p></div><button className="primary-button coral" onClick={() => onShare(savedClimbId)}>Preview share card <Icon name="arrow"/></button><button className="icon-button" aria-label="Dismiss" onClick={() => setSavedClimbId('')}>×</button></section>}<section className="path-grid"><article className="upload-panel"><span className="kicker">{t('climbs.quick')}</span><h2>{draft ? t('climbs.draft') : t('climbs.save')}</h2><p>{t('climbs.description')}</p><label className="field-label" htmlFor="climb-caption">{t('climbs.caption')}</label><input id="climb-caption" value={caption} onChange={event => setCaption(event.target.value)} placeholder={t('climbs.captionPlaceholder')}/><input ref={fileRef} hidden type="file" accept="image/*,video/*" onChange={event => choose(event.target.files?.[0])}/>{draft ? <><div className="media-preview">{draft.kind === 'video' ? <video src={draft.previewUrl} controls/> : <img src={draft.previewUrl} alt="Climbing moment preview"/>}</div><div className="confirm-actions"><button className="secondary-button" onClick={discard}>{t('climbs.discard')}</button><button className="primary-button coral" onClick={confirm}>{t('climbs.confirm')}</button></div></> : <button className="primary-button coral" onClick={() => fileRef.current?.click()}>{t('climbs.choose')}</button>}<small>{t('climbs.privateHelp')}</small></article><article className="deep-panel"><div><span className="kicker light">{t('climbs.deep')}</span><h2>{t('climbs.lesson')}</h2><p>Predict the movement, climb, record what happened, and compare without judgment.</p><button className="primary-button pale" onClick={onLearn}>{t('climbs.routeLab')} <Icon name="arrow"/></button></div><img src={`${import.meta.env.BASE_URL}routes/library-v3-coral.webp`} alt="Coral indoor climbing route"/></article></section><section className="section-block"><div className="section-heading"><div><span className="kicker">{t('climbs.kicker')}</span><h2>{t('climbs.memories')}</h2></div></div><div className="moment-grid">{demo.climbs.map(climb => <article className="moment-card" key={climb.id}>{climb.mediaKind === 'video' ? <video src={climb.mediaUrl} controls/> : <img src={climb.mediaUrl} alt="Saved climbing moment"/>}<div><span className="privacy-pill">⌁ {climb.shareToken ? t('climbs.sharedStatus') : t('climbs.privateStatus')}</span><h3>{climb.title}</h3><p>{climb.caption}</p><small>{climb.grade && `${climb.grade} · `}{climb.gym || 'Your climbing day'}</small><button className="text-button" onClick={() => onShare(climb.id)}>{climb.shareToken ? t('climbs.manageShare') : t('climbs.previewShare')}</button></div></article>)}</div></section><SharedWall climbs={demo.climbs} onOpen={onShare}/></main>
}

function ShareHub({ demo, update, notify, initialSelected }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; initialSelected?: string }) {
  const { t } = useTranslation(); const auth = useResearchAuth(); const creatorName = auth.profile?.displayName || 'BETA climber'; const [tab, setTab] = useState<'climb'|'compare'|'challenge'|'wall'>(initialSelected ? 'climb' : 'challenge'); const [selected, setSelected] = useState(initialSelected || demo.climbs[0]?.id || ''); const [building, setBuilding] = useState(false); const [challengeTitle, setChallengeTitle] = useState('Crew beta challenge'); const [challengePrompt, setChallengePrompt] = useState('How would YOU climb this?'); const [reviewed, setReviewed] = useState(false)
  useEffect(() => { if (initialSelected) { setSelected(initialSelected); setTab('climb') } }, [initialSelected])
  const share = async (kind: 'climb'|'challenge', id: string) => { const item = (kind === 'climb' ? demo.climbs : demo.challenges).find(entry => entry.id === id); if (!item) return; if (!item.shareToken) return notify(t('share.linkFirst')); const url = `${location.origin}${location.pathname}?shared=${item.shareToken}`; const result = await platform.share.share({ title: item.title, text: kind === 'challenge' ? 'How would YOU climb this?' : 'A climb from BETA', url }); if (result === 'copied') notify(t('share.linkCopied')) }
  const copyLink = async (kind: 'climb'|'challenge', id: string) => { const item = (kind === 'climb' ? demo.climbs : demo.challenges).find(entry => entry.id === id); if (!item?.shareToken) return; await platform.share.copyLink(`${location.origin}${location.pathname}?shared=${item.shareToken}`); notify(t('share.linkCopied')) }
  const enableLink = (kind: 'climb'|'challenge', id: string) => { const token = createToken(); if (kind === 'climb') update({ ...demo, climbs: demo.climbs.map(item => item.id === id ? { ...item, shareToken: token } : item) }, 'share_card_created'); else update({ ...demo, challenges: demo.challenges.map(item => item.id === id ? { ...item, shareToken: token } : item) }, 'challenge_shared'); notify(t('share.demoLinkCreated')) }
  const createChallenge = () => { if (!reviewed || !challengeTitle.trim() || !challengePrompt.trim()) return; const source = demo.climbs.find(item => item.id === selected); const challenge: BetaChallenge = { id: uid(), title: challengeTitle.trim(), prompt: challengePrompt.trim(), mediaUrl: source?.mediaUrl || `${import.meta.env.BASE_URL}routes/library-v4-sage.webp`, private: true, revealResponses: false, responses: [], createdAt: new Date().toISOString() }; update({ ...demo, challenges: [challenge, ...demo.challenges] }); setBuilding(false); setReviewed(false); setTab('challenge'); notify(t('share.challengeSaved')) }
  const climb = demo.climbs.find(item => item.id === selected) || demo.climbs[0]
  return <main className="page social-page"><PageTitle kicker={t('share.kicker')} title={t('share.title')} text={t('share.subtitle')} action={<button className="primary-button coral" onClick={() => setBuilding(true)}>＋ {t('share.newChallenge')}</button>}/>{building && <AccessibleModal title={t('share.builderTitle')} onClose={() => { setBuilding(false); setReviewed(false) }}><label>{t('share.challengeTitle')}<input value={challengeTitle} onChange={event => setChallengeTitle(event.target.value)} maxLength={70}/></label><label>{t('share.prompt')}<textarea value={challengePrompt} onChange={event => setChallengePrompt(event.target.value)} maxLength={140}/></label><label>{t('share.routeMedia')}<select value={selected} onChange={event => setSelected(event.target.value)}>{demo.climbs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="media-preview challenge-draft"><img src={demo.climbs.find(item => item.id === selected)?.mediaUrl || `${import.meta.env.BASE_URL}routes/library-v4-sage.webp`} alt="Challenge preview"/></div><label className="check-label"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>{t('share.reveal')}</label><div className="confirm-actions"><button className="secondary-button" onClick={() => { setBuilding(false); setReviewed(false) }}>{t('share.discardChallenge')}</button><button className="primary-button coral" disabled={!reviewed || !challengeTitle.trim() || !challengePrompt.trim()} onClick={createChallenge}>{t('share.confirmChallenge')}</button></div></AccessibleModal>}<div className="segmented"><button className={tab === 'climb' ? 'active' : ''} onClick={() => setTab('climb')}>{t('share.myClimb')}</button><button className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')}>{t('share.different')}</button><button className={tab === 'challenge' ? 'active' : ''} onClick={() => setTab('challenge')}>{t('share.challenge')}</button><button className={tab === 'wall' ? 'active' : ''} onClick={() => setTab('wall')}>{t('shareWall.tab')}</button></div>
    {tab === 'climb' && climb && <section className="share-layout"><div className="share-card">{climb.mediaKind === 'video' ? <video src={climb.mediaUrl} controls playsInline/> : <img src={climb.mediaUrl} alt="Climbing card background"/>}<div className="share-overlay"><span>BETA · MY CLIMB</span><div className="card-creator"><b>{creatorName[0]?.toUpperCase()}</b><small>{t('shareWall.creator', { name: creatorName })}</small></div><h2>{climb.title}</h2><p>{climb.caption}</p><small>{[climb.grade, climb.gym].filter(Boolean).join(' · ')}</small></div></div><div className="share-controls"><span className="kicker">{t('share.kicker')}</span><h2>{t('share.terms')}</h2><p>{t('shareWall.chooseAudience')}</p><div className={`sharing-choice ${climb.shareToken ? 'is-shared' : ''}`}><div><strong>{climb.shareToken ? t('shareWall.shared') : t('shareWall.private')}</strong><span>{climb.shareToken ? t('shareWall.sharedDescription') : t('shareWall.privateDescription')}</span></div><button role="switch" aria-checked={Boolean(climb.shareToken)} aria-label={t('shareWall.shared')} onClick={() => climb.shareToken ? (update({ ...demo, climbs: demo.climbs.map(item => item.id === climb.id ? { ...item, shareToken: undefined } : item) }), notify(t('shareWall.removed'))) : enableLink('climb', climb.id)}><i/></button></div><p className="wall-disclosure">{t('shareWall.disclosure')}</p>{climb.shareToken && <div className="share-action-grid"><button className="secondary-button" onClick={() => void copyLink('climb', climb.id)}>{t('shareWall.copy')}</button><button className="primary-button coral" onClick={() => void share('climb', climb.id)}>{t('shareWall.shareApps')}</button></div>}<button className="secondary-button full download-card-button" onClick={() => void downloadCard(climb, notify, creatorName)}><span>↓</span><b>{t('shareWall.download')}</b><small>{t('shareWall.downloadDetail')}</small></button></div></section>}
    {tab === 'climb' && !climb && <div className="wall-empty"><span>△</span><p>{t('share.noClimb')}</p></div>}
    {tab === 'compare' && <DifferentBeta demo={demo}/>} {tab === 'challenge' && <Challenges demo={demo} update={update} notify={notify} enableLink={id => enableLink('challenge', id)} share={id => share('challenge', id)}/>} {tab === 'wall' && <SharedWall climbs={demo.climbs} onOpen={id => { setSelected(id); setTab('climb') }}/>}</main>
}

function SharedWall({ climbs, onOpen }: { climbs: ClimbMoment[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const shared = climbs.filter(item => item.shareToken && [item.title, item.caption, item.gym, item.grade].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="section-block share-wall"><div className="section-heading"><div><span className="kicker">{t('shareWall.kicker')}</span><h2>{t('shareWall.title')}</h2><p>{t('shareWall.description')}</p></div><label className="wall-search">{t('shareWall.search')}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('shareWall.placeholder')}/></label></div>{shared.length ? <div className="wall-grid">{shared.map(climb => <button className="wall-card" key={climb.id} onClick={() => onOpen(climb.id)}>{climb.mediaKind === 'video' ? <video src={climb.mediaUrl} muted playsInline/> : <img src={climb.mediaUrl} alt=""/>}<span><small>{climb.grade || t('shareWall.moment')}</small><strong>{climb.title}</strong><i>{climb.gym || t('shareWall.destination')}</i></span></button>)}</div> : <div className="wall-empty"><span>⌁</span><div><strong>{query ? t('shareWall.noMatch') : t('shareWall.empty')}</strong><p>{t('shareWall.emptyHelp')}</p></div></div>}</section>
}

function DifferentBeta({ demo }: { demo: DemoState }) { const { t } = useTranslation(); const challenge = demo.challenges[0]; const reactions = ['clever', 'smooth', 'creative', 'recovery'] as const; return <section className="different-beta"><div className="comparison-header"><div><span className="kicker">{t('share.differentKicker')}</span><h2>{t('share.differentTitle')}</h2><p>{t('share.differentDescription')}</p></div></div>{challenge?.responses.length ? <div className="beta-columns">{challenge.responses.map((response, index) => <article key={response.id}><div className="beta-image"><img src={challenge.mediaUrl} alt="Shared challenge route"/><span>{index + 1}</span></div><small>{t('share.idea', { name: response.personName })}</small><h3>{response.move}</h3><p>{response.caption}</p><div className="reaction-row">{reactions.map(reaction => <button key={reaction}>{t(`share.${reaction}`)}</button>)}</div></article>)}</div> : <div className="wall-empty"><span>≈</span><p>{t('share.noComparisons')}</p></div>}</section> }

function Challenges({ demo, update, notify, enableLink, share }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; enableLink: (id: string) => void; share: (id: string) => void }) {
  const { t } = useTranslation(); const challenge = demo.challenges[0]; const [response, setResponse] = useState(''); if (!challenge) return <div className="wall-empty"><span>?</span><p>{t('share.noChallenge')}</p></div>
  const join = () => { if (!response.trim()) return; const item = { id: uid(), personName: 'You', caption: 'My prediction, saved behind the spoiler.', move: response, revealed: false }; update({ ...demo, challenges: demo.challenges.map(entry => entry.id === challenge.id ? { ...entry, responses: [...entry.responses, item] } : entry) }, 'challenge_joined'); setResponse(''); notify(t('share.responseSaved')) }
  return <section className="challenge-layout"><div className="challenge-media"><img src={challenge.mediaUrl} alt="Route in beta challenge"/><div><span>{t('share.spoiler')}</span><h2>{challenge.prompt}</h2></div></div><div className="challenge-panel"><span className="privacy-pill">⌁ {t('share.privateDefault')}</span><h2>{challenge.title}</h2><p>{t('share.predictFirst')}</p><label>{t('share.response')}<textarea value={response} onChange={event => setResponse(event.target.value)} placeholder={t('share.responsePlaceholder')}/></label><button className="primary-button full" onClick={join}>{t('share.lock')}</button><div className="response-stack"><strong>{t('share.hiddenResponses', { count: challenge.responses.length })}</strong><p>{challenge.revealResponses ? t('share.revealedHelp') : t('share.hiddenHelp')}</p><button className="secondary-button full" onClick={() => update({ ...demo, challenges: demo.challenges.map(item => item.id === challenge.id ? { ...item, revealResponses: !item.revealResponses } : item) })}>{challenge.revealResponses ? t('share.hideResponses') : t('share.revealResponses')}</button>{challenge.revealResponses && challenge.responses.map(item => <div className="revealed-response" key={item.id}><b>{item.personName}</b><span>{item.move}</span></div>)}</div>{!challenge.shareToken ? <button className="text-button full" onClick={() => enableLink(challenge.id)}>{t('share.createPrivateLink')}</button> : <><button className="primary-button coral full" onClick={() => share(challenge.id)}>{t('share.shareChallenge')}</button><button className="text-button full" onClick={() => { update({ ...demo, challenges: demo.challenges.map(item => item.id === challenge.id ? { ...item, shareToken: undefined } : item) }); notify(t('share.challengeRevoked')) }}>{t('share.revokeChallenge')}</button></>}</div></section>
}

type CrewCardModel = {
  id: string
  name: string
  kind: Crew['kind']
  guardianManaged: boolean
  role: 'owner' | 'member'
  remote: boolean
  members: { id: string; displayName: string; role: 'owner' | 'member' }[]
}

function CrewInvitationView({ token, onAccount }: { token: string; onAccount: () => void }) {
  const { t } = useTranslation()
  const auth = useResearchAuth()
  const [preview, setPreview] = useState<CrewInvitationPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'accepted' | 'declined' | ''>('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!backendConfigured) { setError(t('crewFlow.unavailable')); setLoading(false); return () => { active = false } }
    void crewBackend.resolveInvitation(token)
      .then(value => { if (!active) return; if (value) setPreview(value); else setError(t('crewFlow.unavailable')) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : t('crewFlow.unavailable')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, t])

  const respond = async (response: 'accepted' | 'declined') => {
    if (!auth.session || !auth.profile?.consentedAt) { onAccount(); return }
    setBusy(true); setError('')
    try { await crewBackend.respondToInvitation(token, response); setResult(response) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('crewFlow.unavailable')) }
    finally { setBusy(false) }
  }
  const openCrew = () => location.assign(`${location.pathname}?screen=crew`)
  const backHome = () => location.assign(location.pathname)

  return <main className="crew-invitation-view"><button className="logo" onClick={backHome}><span>β</span>BETA</button><section className="invitation-panel"><span className="kicker">{t('crewFlow.invitationKicker')}</span><h1>{t('crewFlow.invitationTitle')}</h1>
    {loading && <p role="status">{t('crewFlow.loading')}</p>}
    {!loading && result === 'accepted' && <div className="invitation-result"><span>✓</span><h2>{t('crewFlow.accepted', { crew: preview?.crewName })}</h2><button className="primary-button coral" onClick={openCrew}>{t('crewFlow.openCrew')}</button></div>}
    {!loading && result === 'declined' && <div className="invitation-result"><h2>{t('crewFlow.declined')}</h2><button className="secondary-button" onClick={backHome}>{t('crewFlow.backHome')}</button></div>}
    {!loading && !result && preview && <><p className="invitation-lead">{t('crewFlow.invitedBy', { name: preview.inviterName, crew: preview.crewName })}</p><p className="local-draft-note">{t('crewFlow.invitationExpiry', { date: formatTime(preview.expiresAt) })}</p>
      {!auth.session ? <><p>{t('crewFlow.signInToJoin')}</p><button className="primary-button coral full" onClick={onAccount}>{t('crewFlow.openAccount')}</button></> : !auth.profile?.consentedAt ? <><p>{t('crewFlow.consentToJoin')}</p><button className="primary-button coral full" onClick={onAccount}>{t('crewFlow.openAccount')}</button></> : <div className="confirm-actions"><button className="secondary-button" disabled={busy} onClick={() => void respond('declined')}>{t('crewFlow.declineInvitation')}</button><button className="primary-button coral" disabled={busy} onClick={() => void respond('accepted')}>{busy ? t('crewFlow.accepting') : t('crewFlow.acceptInvitation')}</button></div>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section></main>
}

function MyCrewPersistent({ demo, update, notify, onFind, onAccount, onCapture }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; onFind: () => void; onAccount: () => void; onCapture: () => void }) {
  const { t } = useTranslation()
  const auth = useResearchAuth()
  const realMode = Boolean(backendConfigured && auth.session && auth.profile?.consentedAt)
  const [remoteCrews, setRemoteCrews] = useState<CrewRecord[]>([])
  const [remoteInvites, setRemoteInvites] = useState<CrewInvitationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [builder, setBuilder] = useState(false)
  const [crewName, setCrewName] = useState('')
  const [kind, setKind] = useState<Crew['kind']>('Friends')
  const [inviteCrew, setInviteCrew] = useState<CrewCardModel | null>(null)
  const [invitee, setInvitee] = useState('')
  const [preparedInvite, setPreparedInvite] = useState<{ id: string; crewId: string; url: string } | null>(null)
  const invitePreparation = useRef(0)

  const refresh = async () => {
    if (!realMode) { setRemoteCrews([]); setRemoteInvites([]); return }
    setLoading(true); setError('')
    try {
      const [crews, invitations] = await Promise.all([crewBackend.list(), crewBackend.invitations()])
      setRemoteCrews(crews); setRemoteInvites(invitations)
    } catch (cause) { setError(errorMessage(cause, t('crewFlow.loadError'))) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [realMode])

  const localCards: CrewCardModel[] = backendConfigured ? [] : demo.crews.map(crew => ({
    id: crew.id, name: crew.name, kind: crew.kind, guardianManaged: Boolean(crew.guardianManaged), role: 'owner', remote: false,
    members: crew.members.map((displayName, index) => ({ id: `${crew.id}-${index}`, displayName, role: index === 0 ? 'owner' : 'member' })),
  }))
  const remoteCards: CrewCardModel[] = remoteCrews.map(crew => ({
    id: crew.id, name: crew.name, kind: crew.kind, guardianManaged: crew.guardianManaged, role: crew.role, remote: true,
    members: crew.members.map(member => ({ id: member.id, displayName: member.displayName, role: member.role })),
  }))
  const crews = realMode ? remoteCards : localCards

  const createCrew = async () => {
    const name = crewName.trim()
    if (!name || crews.some(item => item.name.toLowerCase() === name.toLowerCase())) return notify(t('status.duplicate'))
    if (backendConfigured && !realMode) { onAccount(); return }
    setBusy(true); setError('')
    try {
      if (realMode) { await crewBackend.create({ name, kind, guardianManaged: kind === 'Family' }); await refresh() }
      else {
        const crew: Crew = { id: uid(), name, kind, members: ['You'], private: true, guardianManaged: kind === 'Family' }
        update({ ...demo, crews: [crew, ...demo.crews] }, 'crew_created')
      }
      setBuilder(false); setCrewName(''); notify(realMode ? t('crew.created') : t('crew.demoCreated'))
    } catch (cause) { setError(errorMessage(cause, t('crewFlow.loadError'))) }
    finally { setBusy(false) }
  }

  const openInvite = async (crew: CrewCardModel) => {
    const preparation = ++invitePreparation.current
    setInviteCrew(crew); setInvitee(''); setPreparedInvite(null); setError('')
    if (!crew.remote) return
    setBusy(true)
    try {
      const invitation = await crewBackend.createInvitation(crew.id)
      if (invitePreparation.current !== preparation) {
        await crewBackend.revokeInvitation(invitation.id).catch(() => undefined)
        return
      }
      setPreparedInvite({
        id: invitation.id,
        crewId: crew.id,
        url: `${location.origin}${location.pathname}?crewInvite=${encodeURIComponent(invitation.token)}`,
      })
    } catch (cause) {
      if (invitePreparation.current === preparation) setError(errorMessage(cause, t('crewFlow.loadError')))
    } finally {
      if (invitePreparation.current === preparation) setBusy(false)
    }
  }

  const closeInvite = async () => {
    ++invitePreparation.current
    const invitation = preparedInvite
    setInviteCrew(null); setInvitee(''); setPreparedInvite(null)
    if (!invitation) return
    setBusy(true)
    try { await crewBackend.revokeInvitation(invitation.id); await refresh() }
    catch (cause) { setError(errorMessage(cause, t('crewFlow.loadError'))) }
    finally { setBusy(false) }
  }

  const sendInvite = async () => {
    if (!inviteCrew) return
    const personalized = invitee.trim()
    const text = personalized ? t('crewFlow.inviteText', { name: personalized, crew: inviteCrew.name }) : t('crewFlow.inviteTextGeneric', { crew: inviteCrew.name })
    setBusy(true); setError('')
    try {
      if (inviteCrew.remote) {
        if (!preparedInvite || preparedInvite.crewId !== inviteCrew.id) return
        const result = await platform.share.share({ title: t('crew.inviteTitle'), text, url: preparedInvite.url })
        if (result === 'cancelled') { await crewBackend.revokeInvitation(preparedInvite.id); setPreparedInvite(null); await refresh(); return }
        setPreparedInvite(null)
        await refresh(); notify(result === 'copied' ? t('crewFlow.inviteCopied') : t('crew.invitationShared'))
      } else {
        const result = await platform.share.share({ title: t('crew.inviteTitle'), text })
        if (result === 'cancelled') return
        update({ ...demo, crewInvitations: [...demo.crewInvitations, { id: uid(), crewId: inviteCrew.id, inviteeName: personalized || t('crew.friends'), channel: 'share', status: 'pending', createdAt: new Date().toISOString() }] })
        notify(result === 'copied' ? t('crewFlow.inviteCopied') : t('crew.invitationShared'))
      }
      setInviteCrew(null); setInvitee('')
    } catch (cause) {
      setError(errorMessage(cause, t('crewFlow.loadError')))
    } finally { setBusy(false) }
  }

  const revoke = async (invitationId: string) => {
    setBusy(true); setError('')
    try { await crewBackend.revokeInvitation(invitationId); await refresh(); notify(t('crewFlow.inviteRevoked')) }
    catch (cause) { setError(errorMessage(cause, t('crewFlow.loadError'))) }
    finally { setBusy(false) }
  }
  const removeMember = async (crew: CrewCardModel, memberId: string, displayName: string) => {
    if (!window.confirm(t('crewFlow.removeMember', { name: displayName }))) return
    setBusy(true); setError('')
    try { await crewBackend.removeMember(crew.id, memberId); await refresh() }
    catch (cause) { setError(errorMessage(cause, t('crewFlow.loadError'))) }
    finally { setBusy(false) }
  }
  const leaveOrDelete = async (crew: CrewCardModel) => {
    const label = crew.role === 'owner' ? t('crewFlow.deleteCrew') : t('crewFlow.leaveCrew')
    if (!window.confirm(label)) return
    setBusy(true); setError('')
    try { if (crew.role === 'owner') await crewBackend.delete(crew.id); else await crewBackend.leave(crew.id); await refresh(); notify(t('crewFlow.crewRemoved')) }
    catch (cause) { setError(errorMessage(cause, t('crewFlow.loadError'))) }
    finally { setBusy(false) }
  }
  const kindLabel = (crew: CrewCardModel) => t(`crew.${crew.kind === 'Gym group' ? 'gymGroup' : crew.kind.toLowerCase()}`)

  return <main className="page social-page">
    <ConnectTabs active="crew" onFind={onFind} onCrew={() => undefined}/>
    <PageTitle kicker={t('crew.kicker')} title={t('crew.title')} text={t('crew.subtitle')} action={<button className="primary-button" disabled={auth.loading || busy} onClick={() => backendConfigured && !realMode ? onAccount() : setBuilder(true)}>＋ {t('crew.new')}</button>}/>
    {backendConfigured && !realMode && <section className="connection-callout"><div><span className="kicker">{t('common.live')}</span><h2>{t('crewFlow.connectedTitle')}</h2><p>{t('crewFlow.connectedHelp')}</p></div><button className="primary-button coral" onClick={onAccount}>{t('crewFlow.openAccount')}</button></section>}
    {builder && <AccessibleModal title={t('crew.new')} onClose={() => setBuilder(false)}><label>{t('crew.crewName')}<input value={crewName} onChange={event => setCrewName(event.target.value)} maxLength={60} placeholder="Friday Senders"/></label><label>{t('crew.groupType')}<select value={kind} onChange={event => setKind(event.target.value as Crew['kind'])}><option value="Friends">{t('crew.friends')}</option><option value="Couple">{t('crew.couple')}</option><option value="Family">{t('crew.family')}</option><option value="Gym group">{t('crew.gymGroup')}</option></select></label><div className="confirm-actions"><button className="secondary-button" onClick={() => setBuilder(false)}>{t('common.discard')}</button><button className="primary-button" disabled={busy || !crewName.trim()} onClick={() => void createCrew()}>{t('common.confirm')}</button></div></AccessibleModal>}
    {inviteCrew && <AccessibleModal title={t('crew.inviteTitle')} onClose={() => void closeInvite()}><p>{t('crewFlow.inviteHelp')}</p><label>{t('crewFlow.invitee')}<input value={invitee} onChange={event => setInvitee(event.target.value)} placeholder={t('crewFlow.invitePlaceholder')}/></label>{inviteCrew.remote && <p className="local-draft-note">{t('crewFlow.inviteExpires')}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="confirm-actions"><button className="secondary-button" disabled={busy} onClick={() => void closeInvite()}>{t('common.cancel')}</button><button className="primary-button coral" disabled={busy || (inviteCrew.remote && !preparedInvite)} onClick={() => void sendInvite()}>{t('crewFlow.shareInvite')}</button></div></AccessibleModal>}
    {error && <p className="form-error board-error" role="alert">{error}</p>}
    {loading && <p className="loading-state" role="status">{t('crewFlow.loading')}</p>}
    {realMode && crews.length > 0 && <CrewPilotPanel
      demo={demo}
      update={update}
      notify={notify}
      onCapture={onCapture}
      crewOverride={{ id: crews[0].id, name: crews[0].name, members: crews[0].members.map(member => member.displayName) }}
    />}
    {realMode && !error && <section className="return-card"><div><span className="kicker light">{t('crew.return')}</span><h2>{t('crewFlow.connectedTitle')}</h2><p>{t('crewFlow.sessionNext')}</p></div></section>}
    {!backendConfigured && <section className="return-card"><div><span className="kicker light">{t('crew.return')}</span><h2>{t('crew.ready')}</h2><p>{t('crew.subtitle')}</p></div><button className="primary-button pale" onClick={onFind}>{t('home.find')} <Icon name="arrow"/></button></section>}
    <section className="section-block"><div className="section-heading"><div><span className="kicker">{t('crew.groupsLabel')}</span><h2>{t('crew.groups')}</h2></div></div>
      {!loading && realMode && crews.length === 0 && <p className="section-empty-copy">{t('crewFlow.noCrews')}</p>}
      <div className="crew-grid">{crews.map(crew => { const invitations = remoteInvites.filter(item => item.crewId === crew.id); return <article key={crew.id}><div className="crew-icon">{crew.kind === 'Family' ? '⌂' : '◎'}</div><span className="privacy-pill">{t('crew.membersOnly')}</span><h3>{crew.name}</h3><p>{kindLabel(crew)} · {t('crew.members', { count: crew.members.length })}</p><div className="member-row">{crew.members.map(member => <span key={member.id} title={member.displayName}>{member.displayName[0]}</span>)}<button onClick={() => void openInvite(crew)} aria-label={`${t('crew.invite')} ${crew.name}`}>＋</button></div>
        {crew.guardianManaged && <small>{t('crew.guardian')}</small>}
        {invitations.map(invitation => <div className="crew-active-invite" key={invitation.id}><span>{t('crewFlow.activeInvite', { date: formatTime(invitation.expiresAt) })}</span><button className="text-button" disabled={busy} onClick={() => void revoke(invitation.id)}>{t('crewFlow.revokeInvite')}</button></div>)}
        {crew.remote ? <details className="crew-member-manager"><summary>{t('crewFlow.manageMembers')}</summary>{crew.members.map(member => <div key={member.id}><span>{member.displayName} · {member.role}</span>{crew.role === 'owner' && member.role !== 'owner' && <button className="text-button danger-text" disabled={busy} onClick={() => void removeMember(crew, member.id, member.displayName)}>{t('crewFlow.removeMember', { name: member.displayName })}</button>}</div>)}<button className="text-button danger-text" disabled={busy} onClick={() => void leaveOrDelete(crew)}>{crew.role === 'owner' ? t('crewFlow.deleteCrew') : t('crewFlow.leaveCrew')}</button></details> : <p className="local-draft-note">{t('crewFlow.recapPrivacy')}</p>}
        <div className="crew-actions"><button className="secondary-button" disabled={crew.remote} title={crew.remote ? t('crewFlow.sessionNext') : undefined}>{t('crew.plan')}</button><button className="text-button" disabled={crew.remote} title={crew.remote ? t('crewFlow.sessionNext') : undefined}>{t('crew.recap')}</button></div>
      </article> })}</div>
    </section>
    <section className="privacy-panel"><div><span className="kicker">{t('crew.privacyKicker')}</span><h2>{t('crew.privacyTitle')}</h2></div><p>{realMode ? t('crewFlow.privacyStored') : t('crew.safetyStatus', { count: demo.safety.blockedIds.length })}</p></section>
  </main>
}

function CrewPilotPanel({ demo, update, notify, onCapture, crewOverride }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; onCapture: () => void; crewOverride?: { id: string; name: string; members: string[] } }) {
  const pilot = crewOverride ? demo.crewPilots.find(item => item.crewId === crewOverride.id) : demo.crewPilots[0]
  const crew = crewOverride || (pilot ? demo.crews.find(item => item.id === pilot.crewId) : undefined)
  const [setupOpen, setSetupOpen] = useState(false)
  const [contributionOpen, setContributionOpen] = useState(false)
  const [responseToId, setResponseToId] = useState('')
  const [gym, setGym] = useState(pilot?.gym || 'Movement Sunnyvale')
  const [firstDate, setFirstDate] = useState(pilot ? pilot.sessionDates[0].slice(0, 16) : '')
  const [secondDate, setSecondDate] = useState(pilot?.sessionDates[1]?.slice(0, 16) || '')
  const [challenge, setChallenge] = useState(pilot?.challenge || '')
  const [memberName, setMemberName] = useState('You')
  const [kind, setKind] = useState<CrewPilotContributionKind>('moment')
  const [note, setNote] = useState('')
  const [climbId, setClimbId] = useState('')
  const [wantsHelp, setWantsHelp] = useState(false)
  const [responseMember, setResponseMember] = useState('Alex')
  const [responseKind, setResponseKind] = useState<'beta' | 'encouragement'>('beta')
  const [responseNote, setResponseNote] = useState('')
  useEffect(() => {
    if (!pilot) return
    setGym(pilot.gym); setFirstDate(pilot.sessionDates[0].slice(0, 16)); setSecondDate(pilot.sessionDates[1]?.slice(0, 16) || ''); setChallenge(pilot.challenge)
  }, [pilot?.id])
  if (!crew) return null
  if (!pilot) return <section className="crew-pilot crew-pilot-start"><div><span className="kicker">Simpler initial experiment</span><h2>Explore one climb with one crew.</h2><p>Observe what members choose to contribute, whether help is useful, and what happens next. A familiar audience may feel more comfortable, but this pilot cannot establish that it caused sharing or comfort.</p></div><button className="primary-button coral" onClick={() => {
    const first = new Date(Date.now() + 2 * 86400000); first.setHours(18, 0, 0, 0)
    update({ ...demo, crewPilots: [...demo.crewPilots, { id: uid(), crewId: crew.id, gym: 'Movement Sunnyvale', sessionDates: [first.toISOString()], challenge: 'Pick one problem together. Explore different approaches. Capture one breakthrough or memorable moment.', contributions: [], nextInviteSent: false, nextSessionOutcome: 'not_discussed' }] }, 'crew_pilot_started')
  }}>Start crew pilot</button></section>

  const participants = new Set(pilot.contributions.map(item => item.memberName)).size
  const responseCount = pilot.contributions.reduce((total, item) => total + (item.responses || []).length, 0)
  const triedCount = pilot.contributions.filter(item => item.responseOutcome).length
  const observations = [
    { value: pilot.challenge ? '1' : '0', label: 'climb chosen' },
    { value: String(pilot.contributions.length), label: 'optional contributions' },
    { value: String(responseCount), label: 'crew responses' },
    { value: String(triedCount), label: 'responses tried' }
  ]
  const saveSetup = () => {
    if (!firstDate || !challenge.trim()) return
    const updated = { ...pilot, gym, sessionDates: [new Date(firstDate).toISOString(), secondDate ? new Date(secondDate).toISOString() : undefined] as [string, string?], challenge: challenge.trim() }
    update({ ...demo, crewPilots: demo.crewPilots.map(item => item.id === pilot.id ? updated : item) }, 'crew_pilot_planned')
    setSetupOpen(false); notify('Crew pilot plan saved')
  }
  const addContribution = () => {
    if (!note.trim()) return
    const contribution = { id: uid(), memberName, kind, note: note.trim(), climbId: climbId || undefined, wantsHelp, responses: [], createdAt: new Date().toISOString() }
    update({ ...demo, crewPilots: demo.crewPilots.map(item => item.id === pilot.id ? { ...item, contributions: [...item.contributions, contribution] } : item) }, 'crew_pilot_contribution_added')
    setContributionOpen(false); setNote(''); setClimbId(''); setWantsHelp(false); notify('Added to the crew recap')
  }
  const addResponse = () => {
    if (!responseToId || !responseNote.trim()) return
    const response = { id: uid(), memberName: responseMember, kind: responseKind, note: responseNote.trim(), createdAt: new Date().toISOString() }
    update({ ...demo, crewPilots: demo.crewPilots.map(item => item.id === pilot.id ? { ...item, contributions: item.contributions.map(contribution => contribution.id === responseToId ? { ...contribution, responses: [...(contribution.responses || []), response] } : contribution) } : item) }, 'crew_pilot_response_added')
    setResponseToId(''); setResponseNote(''); notify('Response added to the crew exchange')
  }
  const recordOutcome = (contributionId: string, responseOutcome: 'helped' | 'not_for_me' | 'another_way') => {
    update({ ...demo, crewPilots: demo.crewPilots.map(item => item.id === pilot.id ? { ...item, contributions: item.contributions.map(contribution => contribution.id === contributionId ? { ...contribution, responseOutcome } : contribution) } : item) }, 'crew_pilot_beta_tried')
    notify('What happened was added to the observation')
  }
  const recordNextSession = (nextSessionOutcome: NonNullable<typeof pilot.nextSessionOutcome>) => {
    update({ ...demo, crewPilots: demo.crewPilots.map(item => item.id === pilot.id ? { ...item, nextSessionOutcome } : item) }, 'crew_pilot_next_session_observed')
  }
  const inviteAgain = async () => {
    const when = pilot.sessionDates[1] ? ` on ${formatTime(pilot.sessionDates[1])}` : ''
    const text = `${crew.name}: ${pilot.challenge} We explored different approaches together and would love you at the next session${when}.`
    const result = await platform.share.share({ title: `${crew.name} · climb together again`, text })
    if (result === 'cancelled') return
    update({ ...demo, crewPilots: demo.crewPilots.map(item => item.id === pilot.id ? { ...item, nextInviteSent: true } : item) }, 'crew_pilot_next_invite_sent')
    notify(result === 'copied' ? 'Next-session invitation copied' : 'Next-session invitation shared')
  }
  const kindLabel = (value: CrewPilotContributionKind) => value === 'beta' ? 'Beta idea' : value === 'encouragement' ? 'Encouragement' : 'Crew moment'

  return <section className="crew-pilot" aria-labelledby="crew-pilot-title">
    <div className="crew-pilot-head"><div><span className="kicker">Simpler initial experiment · one existing crew</span><h2 id="crew-pilot-title">Can sharing different approaches help us climb together?</h2><p>{crew.name} explores one climb. Members may keep their attempt private or contribute a question, unfinished attempt, breakthrough, beta idea, or encouragement.</p></div><button className="secondary-button" onClick={() => setSetupOpen(true)}>Edit pilot plan</button></div>
    <dl className="pilot-observations">{observations.map(item => <div key={item.label}><dt>{item.value}</dt><dd>{item.label}</dd></div>)}</dl>
    <div className="pilot-layout"><article className="pilot-session-card"><span className="kicker">Shared climb</span><h3>{crew.name}</h3><p className="pilot-challenge">“{pilot.challenge}”</p><div className="pilot-dates"><div><small>Initial session</small><strong>{formatTime(pilot.sessionDates[0])}</strong></div><div><small>What happened next</small><strong>{pilot.sessionDates[1] ? formatTime(pilot.sessionDates[1]) : 'Not planned yet'}</strong></div></div><p className="pilot-gym">⌖ {pilot.gym} · {crew.members.length} crew members</p></article>
      <article className="pilot-action-card"><span className="kicker">Optional contribution</span><h3>Share a moment or ask for help.</h3><p>An unfinished attempt, question, or breakthrough is welcome. A photo or video is optional, and keeping it private is always valid.</p><div className="pilot-actions"><button className="primary-button coral" onClick={() => setContributionOpen(true)}>Contribute to crew</button><button className="text-button" onClick={onCapture}>Save privately first →</button></div><small>{participants}/{crew.members.length} members chose to contribute · crew only on this device</small></article></div>
    <div className="pilot-recap"><div className="pilot-recap-title"><div><span className="kicker">Crew exchange</span><h3>{pilot.contributions.length ? 'Attempts, questions, and responses' : 'No contribution is required to participate.'}</h3></div></div>
      {pilot.contributions.length ? <div className="pilot-contributions">{pilot.contributions.map(item => { const climb = demo.climbs.find(value => value.id === item.climbId); const responses = item.responses || []; return <article key={item.id}>{climb?.mediaUrl && (climb.mediaKind === 'video' ? <video src={climb.mediaUrl} controls/> : <img src={climb.mediaUrl} alt="Crew contribution"/>)}<div><span>{kindLabel(item.kind)}{item.wantsHelp ? ' · asks for help' : ''}</span><strong>{item.memberName}</strong><p>{item.note}</p><div className="pilot-responses">{responses.map(response => <blockquote key={response.id}><b>{response.memberName} · {response.kind === 'beta' ? 'beta idea' : 'encouragement'}</b>{response.note}</blockquote>)}</div><div className="pilot-card-actions"><button className="text-button" onClick={() => { setResponseMember(crew.members.find(member => member !== item.memberName) || 'You'); setResponseToId(item.id) }}>Respond</button>{responses.length > 0 && !item.responseOutcome && <><small>Did {item.memberName} try a response?</small><button onClick={() => recordOutcome(item.id, 'helped')}>Helped</button><button onClick={() => recordOutcome(item.id, 'not_for_me')}>Not for me</button><button onClick={() => recordOutcome(item.id, 'another_way')}>Found another way</button></>}{item.responseOutcome && <small className="pilot-outcome">Tried · {item.responseOutcome === 'helped' ? 'helped' : item.responseOutcome === 'not_for_me' ? 'not for me' : 'found another way'}</small>}</div></div></article> })}</div> : <p className="pilot-empty">Members can still explore curated beta and climb together without posting. This pilot tests participant beta contribution only inside crews; public contribution remains untested.</p>}
      <section className="pilot-next-session"><div><span className="kicker">Outcome to observe</span><h3>What happened after this session?</h3><p>Planning or completing another session is recorded as an outcome. It is not required to finish this experience and does not prove BETA caused the crew to return.</p></div><label>Next-session outcome<select value={pilot.nextSessionOutcome || 'not_discussed'} onChange={event => recordNextSession(event.target.value as NonNullable<typeof pilot.nextSessionOutcome>)}><option value="not_discussed">Not discussed</option><option value="interested">Crew expressed interest</option><option value="planned">Another session was planned</option><option value="completed">Another session happened</option><option value="not_planned">No session was planned</option></select></label><button className="secondary-button" onClick={() => void inviteAgain()}>{pilot.nextInviteSent ? 'Invitation shared ✓' : 'Invite to another session'}</button></section>
      <details className="pilot-research-note"><summary>What this pilot can and cannot show</summary><p>It can reveal contribution behavior, reported comfort, responses, perceived usefulness, and what happens next. It cannot establish that familiarity caused sharing or comfort; that requires a separate audience comparison.</p></details></div>
    {setupOpen && <AccessibleModal title="Set up the crew pilot" onClose={() => setSetupOpen(false)}><label>Gym<select value={gym} onChange={event => setGym(event.target.value)}>{MOVEMENT_GYMS.map(item => <option key={item.id}>{item.name}</option>)}</select></label><label>Initial session<input type="datetime-local" value={firstDate} onChange={event => setFirstDate(event.target.value)}/></label><label>Next session, if the crew plans one (optional)<input type="datetime-local" value={secondDate} onChange={event => setSecondDate(event.target.value)}/></label><label>Crew challenge<textarea value={challenge} onChange={event => setChallenge(event.target.value)} maxLength={240}/></label><p className="local-draft-note">The second session is an observed outcome, not a completion requirement.</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setSetupOpen(false)}>Cancel</button><button className="primary-button coral" disabled={!firstDate || !challenge.trim()} onClick={saveSetup}>Save pilot plan</button></div></AccessibleModal>}
    {contributionOpen && <AccessibleModal title="Add to the shared crew recap" onClose={() => setContributionOpen(false)}><label>Crew member<select value={memberName} onChange={event => setMemberName(event.target.value)}>{crew.members.map(member => <option key={member}>{member}</option>)}</select></label><label>What are they sharing?<select value={kind} onChange={event => setKind(event.target.value as CrewPilotContributionKind)}><option value="moment">Memorable moment</option><option value="beta">Different beta</option><option value="encouragement">Encouragement</option></select></label><label>What happened?<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="The high right foot made the move feel possible..." maxLength={280}/></label><label>Attach a saved climb (optional)<select value={climbId} onChange={event => setClimbId(event.target.value)}><option value="">No photo or video</option>{demo.climbs.map(climb => <option key={climb.id} value={climb.id}>{climb.title}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={wantsHelp} onChange={event => setWantsHelp(event.target.checked)}/> Invite the crew to suggest beta</label><div className="confirm-actions"><button className="secondary-button" onClick={() => setContributionOpen(false)}>Cancel</button><button className="primary-button coral" disabled={!note.trim()} onClick={addContribution}>Add to recap</button></div></AccessibleModal>}
    {responseToId && <AccessibleModal title="Respond within the crew" onClose={() => setResponseToId('')}><label>Responding as<select value={responseMember} onChange={event => setResponseMember(event.target.value)}>{crew.members.map(member => <option key={member}>{member}</option>)}</select></label><label>Response type<select value={responseKind} onChange={event => setResponseKind(event.target.value as 'beta' | 'encouragement')}><option value="beta">Beta idea</option><option value="encouragement">Encouragement</option></select></label><label>Response<textarea value={responseNote} onChange={event => setResponseNote(event.target.value)} placeholder="Try turning your left hip toward the wall..." maxLength={280}/></label><p className="local-draft-note">This response inherits the crew-only audience of the original post.</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setResponseToId('')}>Cancel</button><button className="primary-button coral" disabled={!responseNote.trim()} onClick={addResponse}>Add response</button></div></AccessibleModal>}
  </section>
}

function MyCrewV2({ demo, update, notify, onFind, onCapture }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; onFind: () => void; onCapture: () => void }) {
  const { t } = useTranslation()
  const [builder, setBuilder] = useState(false)
  const [crewName, setCrewName] = useState('')
  const [kind, setKind] = useState<Crew['kind']>('Friends')
  const [inviteCrew, setInviteCrew] = useState<Crew | null>(null)
  const [invitee, setInvitee] = useState('')
  const [planCrew, setPlanCrew] = useState<Crew | null>(null)
  const [recapCrew, setRecapCrew] = useState<Crew | null>(null)
  const [gym, setGym] = useState('Movement Sunnyvale')
  const tomorrow = new Date(Date.now() + 86400000); tomorrow.setHours(18, 0, 0, 0)
  const [startsAt, setStartsAt] = useState(tomorrow.toISOString().slice(0, 16))
  const sessions = demo.sessions.filter(item => item.status === 'confirmed')
  const favoritePartners = backendConfigured ? [] : demo.requests.filter(item => demo.favoriteIds.includes(item.personId))
  const recapPlans = recapCrew ? [
    ...demo.sessions.filter(item => item.crewId === recapCrew.id).map(item => ({ id: item.id, startsAt: item.startsAt, gym: item.gym, status: 'confirmed' as const })),
    ...demo.sessionProposals.filter(item => item.crewId === recapCrew.id && item.status === 'proposed').map(item => ({ id: item.id, startsAt: item.startsAt, gym: item.gym, status: 'proposed' as const }))
  ].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()) : []
  const createCrew = () => {
    const name = crewName.trim()
    if (!name || demo.crews.some(item => item.name.toLowerCase() === name.toLowerCase())) return notify(t('status.duplicate'))
    const crew: Crew = { id: uid(), name, kind, members: ['You'], private: true, guardianManaged: kind === 'Family' }
    update({ ...demo, crews: [crew, ...demo.crews] }, 'crew_created'); setBuilder(false); setCrewName(''); notify(backendConfigured ? t('crew.created') : t('crew.demoCreated'))
  }
  const sendInvite = async () => {
    if (!inviteCrew) return
    const name = invitee.trim() || t('crew.friends')
    if (invitee.trim() && demo.crewInvitations.some(item => item.crewId === inviteCrew.id && item.inviteeName.toLowerCase() === invitee.trim().toLowerCase() && item.status === 'pending')) return notify(t('status.duplicate'))
    const result = await platform.share.share({ title: t('crew.inviteTitle'), text: t('crewFlow.inviteText', { name, crew: inviteCrew.name }) })
    if (result === 'cancelled') return
    update({ ...demo, crewInvitations: [...demo.crewInvitations, { id: uid(), crewId: inviteCrew.id, inviteeName: name, channel: 'share', status: 'pending', createdAt: new Date().toISOString() }] })
    setInviteCrew(null); setInvitee(''); notify(result === 'copied' ? t('crewFlow.inviteCopied') : t('crew.invitationShared'))
  }
  const planSession = () => {
    if (!planCrew) return
    if (demo.sessionProposals.some(item => item.crewId === planCrew.id && item.status === 'proposed')) return notify(t('status.duplicate'))
    const proposal: SessionProposal = { id: uid(), crewId: planCrew.id, gym, startsAt: new Date(startsAt).toISOString(), status: 'proposed', responses: planCrew.members.map(personName => ({ personName, status: personName === 'You' ? 'accepted' : 'pending' })), createdAt: new Date().toISOString() }
    update({ ...demo, sessionProposals: [...demo.sessionProposals, proposal] }, 'repeat_session_requested'); setPlanCrew(null); notify(backendConfigured ? t('crew.proposalSent') : t('crew.demoProposal'))
  }
  const repeat = (personId: string) => { if (demo.favoriteRequests.includes(personId)) return notify(t('status.duplicate')); update({ ...demo, favoriteRequests: [...demo.favoriteRequests, personId] }, 'repeat_session_requested'); notify(backendConfigured ? t('crew.repeatSent') : t('crew.demoRepeat')) }
  return <main className="page social-page">
    <ConnectTabs active="crew" onFind={onFind} onCrew={() => undefined}/>
    <PageTitle kicker={t('crew.kicker')} title={t('crew.title')} text={t('crew.subtitle')} action={<button className="primary-button" onClick={() => setBuilder(true)}>＋ {t('crew.new')}</button>}/>
    {builder && <AccessibleModal title={t('crew.new')} onClose={() => setBuilder(false)}><label>{t('crew.crewName')}<input value={crewName} onChange={event => setCrewName(event.target.value)} placeholder="Friday Senders"/></label><label>{t('crew.groupType')}<select value={kind} onChange={event => setKind(event.target.value as Crew['kind'])}><option value="Friends">{t('crew.friends')}</option><option value="Couple">{t('crew.couple')}</option><option value="Family">{t('crew.family')}</option><option value="Gym group">{t('crew.gymGroup')}</option></select></label><div className="confirm-actions"><button className="secondary-button" onClick={() => setBuilder(false)}>{t('common.discard')}</button><button className="primary-button" disabled={!crewName.trim()} onClick={createCrew}>{t('common.confirm')}</button></div></AccessibleModal>}
    {inviteCrew && <AccessibleModal title={t('crew.inviteTitle')} onClose={() => setInviteCrew(null)}><p>{t('crewFlow.inviteHelp')}</p><label>{t('crewFlow.invitee')}<input value={invitee} onChange={event => setInvitee(event.target.value)} placeholder={t('crewFlow.invitePlaceholder')}/></label><div className="confirm-actions"><button className="secondary-button" onClick={() => setInviteCrew(null)}>{t('common.cancel')}</button><button className="primary-button coral" onClick={() => void sendInvite()}>{t('crewFlow.shareInvite')}</button></div></AccessibleModal>}
    {planCrew && <AccessibleModal title={t('crew.sessionTitle')} onClose={() => setPlanCrew(null)}><label>{t('find.gym')}<select value={gym} onChange={event => setGym(event.target.value)}>{MOVEMENT_GYMS.map(item => <option key={item.id}>{item.name}</option>)}</select></label><label>{t('crew.dateTime')}<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)}/></label><p>{t('crew.rsvpNotice', { count: planCrew.members.length })}</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setPlanCrew(null)}>{t('common.cancel')}</button><button className="primary-button coral" onClick={planSession}>{t('crew.propose')}</button></div></AccessibleModal>}
    {recapCrew && <AccessibleModal title={t('crewFlow.recapTitle', { crew: recapCrew.name })} onClose={() => setRecapCrew(null)}><section className="crew-recap"><div><span className="kicker">{t('crewFlow.crewMembers')}</span><div className="recap-members">{recapCrew.members.map(member => <span key={member}>{member}</span>)}</div></div><div><span className="kicker">{t('crewFlow.sessionPlans')}</span>{recapPlans.length ? <div className="recap-plans">{recapPlans.map(plan => <article key={`${plan.status}-${plan.id}`}><strong>{plan.gym}</strong><span>{formatTime(plan.startsAt)}</span><small>{t(plan.status === 'confirmed' ? 'crewFlow.confirmedPlan' : 'crewFlow.proposedPlan')}</small></article>)}</div> : <p>{t('crewFlow.noPlans')}</p>}</div><p className="local-draft-note">{t('crewFlow.recapPrivacy')}</p></section><button className="primary-button full" onClick={() => setRecapCrew(null)}>{t('common.close')}</button></AccessibleModal>}
    <CrewPilotPanel demo={demo} update={update} notify={notify} onCapture={onCapture}/>
    <section className="return-card"><div><span className="kicker light">{t('crew.return')}</span><h2>{sessions.length ? t('crew.calendar') : t('crew.ready')}</h2><p>{sessions.length ? `${formatTime(sessions[0].startsAt)} · ${sessions[0].gym}` : t('crew.subtitle')}</p></div><button className="primary-button pale" onClick={onFind}>{sessions.length ? t('crew.viewSession') : t('home.find')} <Icon name="arrow"/></button></section>
    <section className="section-block"><div className="section-heading"><div><span className="kicker">{t('crew.favoritesLabel')}</span><h2>{t('crew.favorites')}</h2></div></div>{favoritePartners.length ? <div className="buddy-list">{favoritePartners.map(person => <article key={person.personId}><span className="person-avatar">{person.avatar}</span><div><strong>{person.personName}</strong><small>{person.gym}</small></div><button className="secondary-button" disabled={demo.favoriteRequests.includes(person.personId)} onClick={() => repeat(person.personId)}>{demo.favoriteRequests.includes(person.personId) ? t('crew.pending') : t('crew.plan')}</button></article>)}</div> : <p className="section-empty-copy">{t('crew.noFavorites')}</p>}</section>
    {demo.sessionProposals.length > 0 && <section className="section-block"><div className="section-heading"><div><span className="kicker">{t('crew.rsvp')}</span><h2>{t('crew.proposals')}</h2></div></div><div className="buddy-list">{demo.sessionProposals.filter(item => item.status === 'proposed').map(proposal => <article key={proposal.id}><span className="person-avatar">◷</span><div><strong>{demo.crews.find(item => item.id === proposal.crewId)?.name}</strong><small>{formatTime(proposal.startsAt)} · {proposal.gym}</small></div><button className="secondary-button" onClick={() => { const session = { id: uid(), crewId: proposal.crewId, partnerIds: demo.crews.find(item => item.id === proposal.crewId)?.members || ['you'], gym: proposal.gym, startsAt: proposal.startsAt, status: 'confirmed' as const }; update({ ...demo, sessionProposals: demo.sessionProposals.map(item => item.id === proposal.id ? { ...item, status: 'confirmed' } : item), sessions: [...demo.sessions, session] }, 'session_confirmed'); notify(t('crew.sessionConfirmed')) }}>{t('crew.confirmSession')}</button></article>)}</div></section>}
    <section className="section-block"><div className="section-heading"><div><span className="kicker">{t('crew.groupsLabel')}</span><h2>{t('crew.groups')}</h2></div></div><div className="crew-grid">{demo.crews.map(crew => <article key={crew.id}><div className="crew-icon">{crew.kind === 'Family' ? '⌂' : '◎'}</div><span className="privacy-pill">{t('crew.membersOnly')}</span><h3>{crew.name}</h3><p>{t(`crew.${crew.kind === 'Gym group' ? 'gymGroup' : crew.kind.toLowerCase()}`)} · {t('crew.members', { count: crew.members.length })}</p><div className="member-row">{crew.members.map(member => <span key={member} title={member}>{member[0]}</span>)}<button onClick={() => setInviteCrew(crew)} aria-label={`${t('crew.invite')} ${crew.name}`}>＋</button></div>{crew.guardianManaged && <small>{t('crew.guardian')}</small>}<div className="crew-actions"><button className="secondary-button" onClick={() => setPlanCrew(crew)}>{t('crew.plan')}</button><button className="text-button" onClick={() => setRecapCrew(crew)}>{t('crew.recap')}</button></div></article>)}</div></section>
    <section className="privacy-panel"><div><span className="kicker">{t('crew.privacyKicker')}</span><h2>{t('crew.privacyTitle')}</h2></div><div><label>{t('crew.visibility')}<select value={demo.safety.profileVisibility} onChange={event => update({ ...demo, safety: { ...demo.safety, profileVisibility: event.target.value as DemoState['safety']['profileVisibility'] } })}><option value="Gym only">{t('crew.gymOnly')}</option><option value="Invited people only">{t('crew.invitedOnly')}</option></select></label><p>{t('crew.safetyStatus', { count: demo.safety.blockedIds.length })}</p></div></section>
  </main>
}

function MyCrew({ demo, update, notify, onFind }: { demo: DemoState; update: (state: DemoState, event?: string) => void; notify: (value: string) => void; onFind: () => void }) {
  const sessions = demo.sessions.filter(item => item.status === 'confirmed'); const createCrew = () => { const crew = { id: uid(), name: 'My climbing crew', kind: 'Friends' as const, members: ['You'], private: true as const }; update({ ...demo, crews: [crew, ...demo.crews] }, 'crew_created'); notify('Private crew created') }; const repeat = (personId: string) => { update({ ...demo, favoriteRequests: [...demo.favoriteRequests, personId] }, 'repeat_session_requested'); notify('Repeat-session request created in demo mode') }
  return <main className="page social-page"><PageTitle kicker="My Crew" title="The people who make you want to come back." text="Plan with people you already know, invite them by link, and save shared memories with consent." action={<button className="primary-button" onClick={createCrew}>＋ New private crew</button>}/><section className="return-card"><div><span className="kicker light">Come back together</span><h2>{sessions.length ? 'You have a climbing day on the calendar.' : 'Ready for the next climbing day?'}</h2><p>{sessions.length ? `${formatTime(sessions[0].startsAt)} · ${sessions[0].gym}` : 'Invite your crew first. Partner discovery is here only when you need it.'}</p></div><button className="primary-button pale" onClick={onFind}>{sessions.length ? 'View session' : 'Find a partner'} <Icon name="arrow"/></button></section><section className="section-block"><div className="section-heading"><div><span className="kicker">Favorite partners</span><h2>Climb together again</h2></div></div><div className="buddy-list">{demo.requests.filter(item => demo.favoriteIds.includes(item.personId)).map(person => <article key={person.personId}><span className="person-avatar">{person.avatar}</span><div><strong>{person.personName}</strong><small>{person.gym} · Favorite saved locally</small></div><button className="secondary-button" onClick={() => repeat(person.personId)}>Plan another session</button></article>)}</div></section><section className="section-block"><div className="section-heading"><div><span className="kicker">Small, private groups</span><h2>Your crews</h2></div></div><div className="crew-grid">{demo.crews.map(crew => <article key={crew.id}><div className="crew-icon">{crew.kind === 'Family' ? '⌂' : '◎'}</div><span className="privacy-pill">Private</span><h3>{crew.name}</h3><p>{crew.kind} · {crew.members.length} members</p><div className="member-row">{crew.members.map(member => <span key={member} title={member}>{member[0]}</span>)}<button onClick={() => notify('Private invite link copied in demo mode')}>＋</button></div>{crew.guardianManaged && <small>Guardian-managed. No adult stranger matching or public location profile.</small>}<button className="text-button" onClick={() => notify('Crew recap opened in demo mode')}>View private recap →</button></article>)}</div></section><section className="privacy-panel"><div><span className="kicker">Privacy & safety</span><h2>You control who gets close.</h2></div><div><label>Profile visibility<select value={demo.safety.profileVisibility} onChange={event => update({ ...demo, safety: { ...demo.safety, profileVisibility: event.target.value as DemoState['safety']['profileVisibility'] } })}><option>Gym only</option><option>Invited people only</option></select></label><p>{demo.safety.blockedIds.length} blocked demo {demo.safety.blockedIds.length === 1 ? 'profile' : 'profiles'}. Reports and blocks are local UI simulations until a secure backend exists.</p></div></section></main>
}

function SharedView({ demo, token }: { demo: DemoState; token: string }) {
  const climb = demo.climbs.find(item => item.shareToken === token); const challenge = demo.challenges.find(item => item.shareToken === token)
  return <main className="shared-view"><button className="logo" onClick={() => location.assign(location.pathname)}><span>β</span>BETA</button>{climb ? <><span className="privacy-pill">Shared by link</span><div className="share-card">{climb.mediaKind === 'video' ? <video src={climb.mediaUrl} controls playsInline/> : <img src={climb.mediaUrl} alt="Shared climbing moment"/>}<div className="share-overlay"><span>BETA · MY CLIMB</span><h2>{climb.title}</h2><p>{climb.caption}</p></div></div><p>Shared media remains controlled by its creator. Do not redistribute it without consent.</p></> : challenge ? <><span className="privacy-pill">Shared challenge</span><div className="challenge-media shared"><img src={challenge.mediaUrl} alt="Shared climbing challenge"/><div><span>BETA CHALLENGE</span><h2>{challenge.prompt}</h2></div></div><p>Guest viewing works on the web. Persistent guest responses require a configured secure backend.</p></> : <Empty title="This link is unavailable" text="It may have expired or been revoked." action="Go to BETA" onAction={() => location.assign(location.pathname)}/>}</main>
}

function PageTitle({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: React.ReactNode }) { return <div className="page-title"><div><span className="kicker">{kicker}</span><h1>{title}</h1><p>{text}</p></div>{action}</div> }
function Empty({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) { return <div className="empty-state"><span>△</span><h2>{title}</h2><p>{text}</p><button className="primary-button" onClick={onAction}>{action}</button></div> }
async function downloadCard(climb: ClimbMoment, notify: (value: string) => void, creatorName = 'BETA climber') {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350
  const ctx = canvas.getContext('2d'); if (!ctx) return
  ctx.fillStyle = '#17211d'; ctx.fillRect(0, 0, 1080, 1350)
  try {
    if (!climb.mediaUrl) throw new Error('No media')
    const media = climb.mediaKind === 'video' ? await loadCardVideo(climb.mediaUrl) : await loadCardImage(climb.mediaUrl)
    drawCover(ctx, media, 0, 0, 1080, 1350)
  } catch { notify('The media could not be rendered; creating a text card instead.') }
  const shade = ctx.createLinearGradient(0, 260, 0, 1350); shade.addColorStop(0, 'rgba(15,25,21,.04)'); shade.addColorStop(.58, 'rgba(15,25,21,.34)'); shade.addColorStop(1, 'rgba(15,25,21,.96)'); ctx.fillStyle = shade; ctx.fillRect(0, 0, 1080, 1350)
  ctx.fillStyle = '#ff745f'; ctx.beginPath(); ctx.roundRect(64, 64, 132, 108, 24); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '800 47px system-ui, sans-serif'; ctx.fillText('β BETA', 222, 137)
  ctx.fillStyle = '#ffb342'; ctx.beginPath(); ctx.arc(106, 820, 42, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#17211d'; ctx.font = '800 36px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(creatorName.trim()[0]?.toUpperCase() || 'B', 106, 833); ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'; ctx.font = '700 32px system-ui, sans-serif'; ctx.fillText(creatorName, 170, 817)
  ctx.fillStyle = '#d9dfd9'; ctx.font = '24px system-ui, sans-serif'; ctx.fillText('shared a climb on BETA', 170, 850)
  ctx.fillStyle = '#fff'; ctx.font = '800 82px system-ui, sans-serif'; wrapText(ctx, climb.title, 64, 970, 930, 94)
  ctx.fillStyle = '#f3f4ef'; ctx.font = '38px system-ui, sans-serif'; wrapText(ctx, climb.caption, 64, 1155, 920, 48)
  ctx.fillStyle = '#ffca6b'; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText([climb.grade, climb.gym].filter(Boolean).join(' · ') || 'CLIMB TOGETHER · SHARE THE BETA', 64, 1280)
  const link = document.createElement('a'); link.download = 'beta-climb-card.png'; link.href = canvas.toDataURL('image/png'); link.click(); notify('Photo share card downloaded')
}
function loadCardImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = reject; image.src = src }) }
function loadCardVideo(src: string) { return new Promise<HTMLVideoElement>((resolve, reject) => { const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto'; video.onloadeddata = () => resolve(video); video.onerror = reject; video.src = src; video.load() }) }
function drawCover(ctx: CanvasRenderingContext2D, media: HTMLImageElement | HTMLVideoElement, x: number, y: number, width: number, height: number) { const sourceWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth; const sourceHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight; const scale = Math.max(width / sourceWidth, height / sourceHeight); const cropWidth = width / scale; const cropHeight = height / scale; const sourceX = (sourceWidth - cropWidth) / 2; const sourceY = (sourceHeight - cropHeight) / 2; ctx.drawImage(media, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height) }
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lineHeight: number) { const words = text.split(' '); let line = ''; words.forEach(word => { const test = `${line}${word} `; if (ctx.measureText(test).width > max && line) { ctx.fillText(line, x, y); line = `${word} `; y += lineHeight } else line = test }); ctx.fillText(line, x, y) }
