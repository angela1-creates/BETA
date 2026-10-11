import { useEffect, useMemo, useRef, useState } from 'react'
import { routes as sampleRoutes, emptyAttempt } from './data'
import { clearAttemptDirty, loadAttempts, loadDirtyAttemptIds, markAttemptDirty, saveAttempts } from './storage'
import type { Attempt, MoveStep, Route, Screen, Tool } from './types'
import { Icon } from './components/Icon'
import { MarkerToolbar } from './components/MarkerToolbar'
import { RouteCanvas } from './components/RouteCanvas'
import { SequencePanel } from './components/SequencePanel'
import { HintPanel } from './components/HintPanel'
import { ComparisonView } from './components/ComparisonView'
import { ReflectionForm } from './components/ReflectionForm'
import { ResearchSummary } from './components/ResearchSummary'
import { AttemptMedia } from './components/AttemptMedia'
import { useResearchAuth } from './researchAuth'
import { researchBackend } from './services/researchBackend'
import { useTranslation } from 'react-i18next'
import { routeLabCopy } from './routeLabCopy'

const uid = () => Math.random().toString(36).slice(2, 10)

function App() {
  const auth = useResearchAuth()
  const { t, i18n } = useTranslation()
  const [screen, setScreen] = useState<Screen>('home')
  const [route, setRoute] = useState<Route>(sampleRoutes[0])
  const [attempts, setAttempts] = useState<Record<string, Attempt>>(loadAttempts)
  const [uploadedRoutes, setUploadedRoutes] = useState<Route[]>([])
  const [syncStatus, setSyncStatus] = useState<'local'|'loading'|'saving'|'saved'|'error'>('local')
  const [syncError, setSyncError] = useState('')
  const [routeUploadProgress, setRouteUploadProgress] = useState(0)
  const [mode, setMode] = useState<'predicted' | 'actual'>('predicted')
  const [tool, setTool] = useState<Tool>('LH')
  const [selectedId, setSelectedId] = useState<string>()
  const [history, setHistory] = useState<MoveStep[][]>([])
  const [future, setFuture] = useState<MoveStep[][]>([])

  const attempt = attempts[route.id] || emptyAttempt()
  const localizedRoute = useMemo<Route>(() => ({ ...route, title: routeLabCopy(route.title, i18n.language), grade: routeLabCopy(route.grade, i18n.language), colorName: routeLabCopy(route.colorName, i18n.language), notes: routeLabCopy(route.notes, i18n.language), insight: routeLabCopy(route.insight, i18n.language), hints: route.hints.map(hint => routeLabCopy(hint, i18n.language)) }), [route, i18n.language])
  const key = mode === 'predicted' ? 'predictedBeta' : 'actualBeta'
  const steps = attempt[key]

  useEffect(() => { saveAttempts(attempts) }, [attempts])
  useEffect(() => {
    if (!auth.session || !auth.profile?.consentedAt) { setSyncStatus('local'); setUploadedRoutes([]); return }
    let active = true
    setSyncStatus('loading'); setSyncError('')
    void researchBackend.loadResearchData().then(data => {
      if (!active) return
      const dirty = loadDirtyAttemptIds(loadAttempts())
      setAttempts(current => {
        const merged = { ...current }
        Object.entries(data.attempts).forEach(([routeId, remoteAttempt]) => { if (!dirty.has(routeId)) merged[routeId] = remoteAttempt })
        return merged
      })
      setUploadedRoutes(data.routes); setSyncStatus('saved')
    }).catch(cause => { if (active) { setSyncStatus('error'); setSyncError(cause instanceof Error ? cause.message : t('routeLab.workspace.loadError')) } })
    return () => { active = false }
  }, [auth.session?.user.id, auth.profile?.consentedAt])

  const updateAttempt = (change: Partial<Attempt>) => { markAttemptDirty(route.id); setSyncStatus('local'); setAttempts(prev => ({ ...prev, [route.id]: { ...(prev[route.id] || emptyAttempt()), ...change } })) }
  useEffect(() => {
    if (!auth.session || !auth.profile?.consentedAt || !loadDirtyAttemptIds(loadAttempts()).has(route.id)) return
    const timer = window.setTimeout(() => {
      setSyncStatus('saving'); setSyncError('')
      void researchBackend.saveAttempt(route, attempts[route.id] || emptyAttempt()).then(() => { clearAttemptDirty(route.id); setSyncStatus('saved') }).catch(cause => { setSyncStatus('error'); setSyncError(cause instanceof Error ? cause.message : t('routeLab.workspace.saveError')) })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [attempt, route.id, auth.session?.user.id, auth.profile?.consentedAt])
  const commitSteps = (next: MoveStep[]) => {
    setHistory(h => [...h.slice(-29), steps]); setFuture([])
    updateAttempt({ [key]: next.map((s, i) => ({ ...s, order: i + 1 })) })
  }
  const addStep = (step: Omit<MoveStep, 'id' | 'order' | 'note'>) => commitSteps([...steps, { ...step, id: uid(), order: steps.length + 1, note: '' }])
  const editStep = (id: string, note: string) => updateAttempt({ [key]: steps.map(s => s.id === id ? { ...s, note } : s) })
  const deleteStep = (id: string) => { commitSteps(steps.filter(s => s.id !== id)); setSelectedId(undefined) }
  const reorder = (id: string, delta: number) => {
    const from = steps.findIndex(s => s.id === id), to = from + delta
    if (to < 0 || to >= steps.length) return
    const next = [...steps]; [next[from], next[to]] = [next[to], next[from]]; commitSteps(next)
  }
  const undo = () => { if (!history.length) return; const previous = history[history.length - 1]; setFuture(f => [steps, ...f]); setHistory(h => h.slice(0, -1)); updateAttempt({ [key]: previous }) }
  const redo = () => { if (!future.length) return; const next = future[0]; setHistory(h => [...h, steps]); setFuture(f => f.slice(1)); updateAttempt({ [key]: next }) }
  const openRoute = (next: Route) => { setRoute(next); setScreen('workspace'); setMode('predicted'); setHistory([]); setFuture([]); window.scrollTo(0, 0) }
  const uploadRoute = async (file: File) => {
    if (auth.session && auth.profile?.consentedAt) {
      setRouteUploadProgress(1)
      try { const next = await researchBackend.createUploadedRoute(file, setRouteUploadProgress); setUploadedRoutes(current => [next, ...current]); openRoute(next) }
      finally { setRouteUploadProgress(0) }
      return
    }
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(t('routeLab.workspace.readPhotoError'))); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file) })
    openRoute({ id: `local-${Date.now()}`, title: file.name.replace(/\.[^.]+$/, '') || t('routeLab.workspace.myRoute'), image, grade: t('routeLab.workspace.openGrade'), colorName: t('routeLab.workspace.customColor'), accent: '#315c4d', notes: t('routeLab.workspace.localRouteNote'), insight: t('routeLab.workspace.localRouteInsight'), hints: [] })
  }
  const uploadAttemptMedia = async (file: File, onProgress: (percent: number) => void) => {
    const media = await researchBackend.uploadAttemptMedia(route, attempt, file, onProgress)
    updateAttempt(media)
  }
  const deleteAttemptMedia = async () => { await researchBackend.deleteAttemptMedia(route, attempt); updateAttempt({ mediaPath: undefined, mediaKind: undefined, mediaUrl: undefined }) }

  return <div className="app-shell">
    <Header screen={screen} onNavigate={setScreen} />
    {screen === 'home' && <Home onStart={() => setScreen('library')} onDemo={() => openRoute(sampleRoutes[0])} />}
    {screen === 'library' && <Library onOpen={openRoute} attempts={attempts} routes={[...uploadedRoutes, ...sampleRoutes]} onUpload={uploadRoute} uploadProgress={routeUploadProgress} cloudEnabled={Boolean(auth.session && auth.profile?.consentedAt)} />}
    {screen === 'workspace' && <main className="workspace-page">
      <div className="workspace-top">
        <button className="text-button" onClick={() => setScreen('library')}>{t('routeLab.workspace.allRoutes')}</button>
        <div className={`sync-indicator ${syncStatus}`} role="status">{syncStatus === 'loading' ? t('routeLab.workspace.loading') : syncStatus === 'saving' ? t('routeLab.workspace.saving') : syncStatus === 'saved' ? t('routeLab.workspace.saved') : syncStatus === 'error' ? t('routeLab.workspace.syncAttention') : t('routeLab.workspace.localDraft')}{syncError && <small>{syncError}</small>}</div>
        <div className="route-heading"><div><span className="eyebrow">{localizedRoute.grade} · {t('routeLab.workspace.holds', { color: localizedRoute.colorName })} · {t('routeLab.workspace.routeStudy')}</span><h1>{localizedRoute.title}</h1><p>{localizedRoute.notes}</p></div>
          <div className="mode-switch"><button className={mode === 'predicted' ? 'active' : ''} onClick={() => { setMode('predicted'); setHistory([]); setFuture([]) }}>{t('routeLab.workspace.before')}</button><button className={mode === 'actual' ? 'active' : ''} onClick={() => { setMode('actual'); setHistory([]); setFuture([]) }}>{t('routeLab.workspace.after')}</button></div>
        </div>
      </div>
      <div className="workspace-grid">
        <div className="canvas-column">
          <div className="canvas-bar"><MarkerToolbar selected={tool} onSelect={setTool} /><div className="history-actions"><button onClick={undo} disabled={!history.length} aria-label={t('routeLab.workspace.undo')}><Icon name="undo" /></button><button onClick={redo} disabled={!future.length} aria-label={t('routeLab.workspace.redo')}><Icon name="redo" /></button><button onClick={() => steps.length && commitSteps([])} disabled={!steps.length} aria-label={t('routeLab.workspace.clear')}><Icon name="trash" /></button></div></div>
          <RouteCanvas route={localizedRoute} steps={steps} tool={tool} mode={mode} selectedId={selectedId} onSelect={setSelectedId} onAdd={addStep} />
          <div className="canvas-caption"><span><i className="hand-key" />{t('routeLab.workspace.hands')}</span><span><i className="foot-key" />{t('routeLab.workspace.feet')}</span><span><i className="path-key" />{t('routeLab.workspace.movement')}</span></div>
        </div>
        <div className="side-column">
          <SequencePanel steps={steps} selectedId={selectedId} onSelect={setSelectedId} onUpdate={editStep} onDelete={deleteStep} onMove={reorder} />
          <div className="confidence-card"><label><span>{mode === 'predicted' ? t('routeLab.workspace.confidenceBefore') : t('routeLab.workspace.confidenceAfter')}</span><strong>{mode === 'predicted' ? attempt.confidenceBefore : attempt.confidenceAfter}/5</strong><input type="range" min="1" max="5" value={mode === 'predicted' ? attempt.confidenceBefore : attempt.confidenceAfter} onChange={e => updateAttempt(mode === 'predicted' ? { confidenceBefore: Number(e.target.value) } : { confidenceAfter: Number(e.target.value) })} /></label></div>
          <HintPanel hints={localizedRoute.hints} revealed={attempt.hintLevelUsed} onReveal={level => updateAttempt({ hintLevelUsed: level })} />
          <AttemptMedia attempt={attempt} canSync={Boolean(auth.session && auth.profile?.consentedAt)} onUpload={uploadAttemptMedia} onDelete={deleteAttemptMedia}/>
        </div>
      </div>
      <div className="workspace-next"><div><span className="eyebrow">{mode === 'predicted' ? t('routeLab.workspace.ready') : t('routeLab.workspace.afterAttempt')}</span><h2>{mode === 'predicted' ? t('routeLab.workspace.saveRead') : t('routeLab.workspace.wallLesson')}</h2></div><button className="primary-button" onClick={() => mode === 'predicted' ? setMode('actual') : setScreen('compare')}>{mode === 'predicted' ? t('routeLab.workspace.savePrediction') : t('routeLab.workspace.compare')} <Icon name="arrow" /></button></div>
    </main>}
    {screen === 'compare' && <main className="page compare-page"><button className="text-button" onClick={() => setScreen('workspace')}>{t('routeLab.compare.back')}</button><div className="page-intro"><span className="eyebrow">{t('routeLab.compare.kicker')}</span><h1>{t('routeLab.compare.title')}</h1><p>{t('routeLab.compare.description')}</p></div><ComparisonView route={localizedRoute} predicted={attempt.predictedBeta} actual={attempt.actualBeta} /><ReflectionForm value={attempt.reflection} onChange={reflection => updateAttempt({ reflection })} /></main>}
    {screen === 'research' && <ResearchSummary attempts={attempts} />}
    {screen === 'about' && <About />}
    {screen !== 'workspace' && <Footer />}
  </div>
}

function Header({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const { t } = useTranslation()
  return <header className="site-header"><button className="logo" onClick={() => onNavigate('home')} aria-label={t('routeLab.nav.home')}><span>B</span>BETA</button><nav><button className={screen === 'library' ? 'active' : ''} onClick={() => onNavigate('library')}>{t('routeLab.nav.routes')}</button><button className={screen === 'research' ? 'active' : ''} onClick={() => onNavigate('research')}>{t('routeLab.nav.research')}</button><button className={screen === 'about' ? 'active' : ''} onClick={() => onNavigate('about')}>{t('routeLab.nav.about')}</button></nav></header>
}

function Home({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  const { t } = useTranslation()
  return <main className="home"><section className="hero"><div className="hero-copy"><span className="eyebrow">{t('routeLab.home.kicker')}</span><h1>{t('routeLab.home.titleA')}<br /><em>{t('routeLab.home.titleB')}</em></h1><p>{t('routeLab.home.description')}</p><div className="hero-actions"><button className="primary-button" onClick={onStart}>{t('routeLab.home.choose')} <Icon name="arrow" /></button><button className="secondary-button" onClick={onDemo}>{t('routeLab.home.sample')}</button></div><p className="quiet-note"><span>✦</span> {t('routeLab.home.hint')}</p></div><div className="hero-visual"><div className="hero-photo"><img src={`${import.meta.env.BASE_URL}routes/feet-first-v1-blue.webp`} alt={t('routeLab.home.photoAlt')} /><span className="hero-marker m1">LH</span><span className="hero-marker m2">RF</span><svg viewBox="0 0 100 100"><path d="M42 75 Q60 58 51 41" /></svg><div className="visual-note"><span>{t('routeLab.home.notice')}</span><strong>{t('routeLab.home.question')}</strong></div></div></div></section>
    <section className="philosophy"><span className="eyebrow light">{t('routeLab.home.idea')}</span><blockquote>{t('routeLab.home.quote')}</blockquote><div className="principles"><article><span>01</span><h3>{t('routeLab.home.read')}</h3><p>{t('routeLab.home.readText')}</p></article><article><span>02</span><h3>{t('routeLab.home.climb')}</h3><p>{t('routeLab.home.climbText')}</p></article><article><span>03</span><h3>{t('routeLab.home.reflect')}</h3><p>{t('routeLab.home.reflectText')}</p></article></div></section>
  </main>
}

function Library({ onOpen, attempts, routes, onUpload, uploadProgress, cloudEnabled }: { onOpen: (r: Route) => void; attempts: Record<string, Attempt>; routes: Route[]; onUpload: (file: File) => Promise<void>; uploadProgress: number; cloudEnabled: boolean }) {
  const { t, i18n } = useTranslation()
  const completed = useMemo(() => Object.values(attempts).filter(a => a.predictedBeta.length).length, [attempts])
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')
  const upload = (file?: File) => { if (!file || !file.type.startsWith('image/')) return; setUploadError(''); void onUpload(file).catch(cause => setUploadError(cause instanceof Error ? cause.message : t('routeLab.library.uploadError'))) }
  return <main className="page library-page"><div className="page-intro library-intro"><div><span className="eyebrow">{t('routeLab.library.kicker')}</span><h1>{t('routeLab.library.title')}</h1><p>{t('routeLab.library.description')}</p></div>{completed > 0 && <span className="local-progress">{t('routeLab.library.savedCount', { count: completed })}</span>}</div>
    <input ref={uploadRef} className="visually-hidden" type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} />
    <button className="upload-route" disabled={uploadProgress > 0} onClick={() => uploadRef.current?.click()}><span>＋</span><div><strong>{t('routeLab.library.ownRoute')}</strong><small>{cloudEnabled ? t('routeLab.library.cloudUpload') : t('routeLab.library.localUpload')}</small></div><b>{uploadProgress > 0 ? `${uploadProgress}%` : t('routeLab.library.upload')}</b></button>{uploadError && <p className="form-error" role="alert">{uploadError}</p>}
    <div className="route-grid">{routes.map((route, i) => { const r = { ...route, title: routeLabCopy(route.title, i18n.language), grade: routeLabCopy(route.grade, i18n.language), colorName: routeLabCopy(route.colorName, i18n.language), insight: routeLabCopy(route.insight, i18n.language) }; return <button className={`route-card ${i < 3 ? 'featured' : ''}`} key={r.id} onClick={() => onOpen(route)}><div className="route-image"><img src={r.image} alt={t('routeLab.library.routeAlt', { color: r.colorName, grade: r.grade })} /><span className="grade"><i style={{ background: r.accent }} />{r.grade} · {r.colorName}</span>{attempts[r.id]?.predictedBeta.length ? <span className="saved"><Icon name="check" size={14} /> {t('routeLab.library.saved')}</span> : null}</div><div className="route-card-copy"><span>{String(i + 1).padStart(2, '0')}</span><div><h2>{r.title}</h2><p>{r.insight}</p></div><b>↗</b></div></button> })}</div>
  </main>
}

function About() {
  const { t } = useTranslation(); const tests = ['accuracy', 'hintsRequested', 'completion', 'transfer', 'confidence', 'independence']
  return <main className="page about-page"><div className="about-hero"><span className="eyebrow">{t('routeLab.about.kicker')}</span><h1>{t('routeLab.about.titleA')}<br /><em>{t('routeLab.about.titleB')}</em></h1><p>{t('routeLab.about.description')}</p></div><div className="about-grid"><article><span>{t('routeLab.about.question')}</span><h2>{t('routeLab.about.questionText')}</h2></article><article><span>{t('routeLab.about.principle')}</span><h2>{t('routeLab.about.principleText')}</h2><p>{t('routeLab.about.principleDetail')}</p></article><article><span>{t('routeLab.about.hypothesis')}</span><h2>{t('routeLab.about.hypothesisText')}</h2></article></div><section className="test-section"><span className="eyebrow">{t('routeLab.about.test')}</span><div>{tests.map((key, i) => <p key={key}><span>{String(i + 1).padStart(2, '0')}</span>{t(`routeLab.about.${key}`)}</p>)}</div></section></main>
}

function Footer() { const { t } = useTranslation(); return <footer><span className="logo"><span>B</span>BETA</span><p>{t('routeLab.footer.line')}</p><small>{t('routeLab.footer.detail')}</small></footer> }

export default App
