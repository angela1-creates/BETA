import { useEffect, useMemo, useRef, useState } from 'react'
import { routes, emptyAttempt } from './data'
import { loadAttempts, saveAttempts } from './storage'
import type { Attempt, MoveStep, Route, Screen, Tool } from './types'
import { Icon } from './components/Icon'
import { MarkerToolbar } from './components/MarkerToolbar'
import { RouteCanvas } from './components/RouteCanvas'
import { SequencePanel } from './components/SequencePanel'
import { HintPanel } from './components/HintPanel'
import { ComparisonView } from './components/ComparisonView'
import { ReflectionForm } from './components/ReflectionForm'
import { ResearchSummary } from './components/ResearchSummary'

const uid = () => Math.random().toString(36).slice(2, 10)

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [route, setRoute] = useState<Route>(routes[0])
  const [attempts, setAttempts] = useState<Record<string, Attempt>>(loadAttempts)
  const [mode, setMode] = useState<'predicted' | 'actual'>('predicted')
  const [tool, setTool] = useState<Tool>('LH')
  const [selectedId, setSelectedId] = useState<string>()
  const [history, setHistory] = useState<MoveStep[][]>([])
  const [future, setFuture] = useState<MoveStep[][]>([])

  const attempt = attempts[route.id] || emptyAttempt()
  const key = mode === 'predicted' ? 'predictedBeta' : 'actualBeta'
  const steps = attempt[key]

  useEffect(() => { saveAttempts(attempts) }, [attempts])

  const updateAttempt = (change: Partial<Attempt>) => setAttempts(prev => ({ ...prev, [route.id]: { ...(prev[route.id] || emptyAttempt()), ...change } }))
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

  return <div className="app-shell">
    <Header screen={screen} onNavigate={setScreen} />
    {screen === 'home' && <Home onStart={() => setScreen('library')} onDemo={() => openRoute(routes[0])} />}
    {screen === 'library' && <Library onOpen={openRoute} attempts={attempts} />}
    {screen === 'workspace' && <main className="workspace-page">
      <div className="workspace-top">
        <button className="text-button" onClick={() => setScreen('library')}>← All routes</button>
        <div className="route-heading"><div><span className="eyebrow">{route.grade} · {route.colorName} holds · Route study</span><h1>{route.title}</h1><p>{route.notes}</p></div>
          <div className="mode-switch"><button className={mode === 'predicted' ? 'active' : ''} onClick={() => { setMode('predicted'); setHistory([]); setFuture([]) }}>Before · Prediction</button><button className={mode === 'actual' ? 'active' : ''} onClick={() => { setMode('actual'); setHistory([]); setFuture([]) }}>After · Actual</button></div>
        </div>
      </div>
      <div className="workspace-grid">
        <div className="canvas-column">
          <div className="canvas-bar"><MarkerToolbar selected={tool} onSelect={setTool} /><div className="history-actions"><button onClick={undo} disabled={!history.length} aria-label="Undo"><Icon name="undo" /></button><button onClick={redo} disabled={!future.length} aria-label="Redo"><Icon name="redo" /></button><button onClick={() => steps.length && commitSteps([])} disabled={!steps.length} aria-label="Clear all"><Icon name="trash" /></button></div></div>
          <RouteCanvas route={route} steps={steps} tool={tool} mode={mode} selectedId={selectedId} onSelect={setSelectedId} onAdd={addStep} />
          <div className="canvas-caption"><span><i className="hand-key" />Hands</span><span><i className="foot-key" />Feet</span><span><i className="path-key" />Movement</span></div>
        </div>
        <div className="side-column">
          <SequencePanel steps={steps} selectedId={selectedId} onSelect={setSelectedId} onUpdate={editStep} onDelete={deleteStep} onMove={reorder} />
          <div className="confidence-card"><label><span>Confidence {mode === 'predicted' ? 'before' : 'after'} climbing</span><strong>{mode === 'predicted' ? attempt.confidenceBefore : attempt.confidenceAfter}/5</strong><input type="range" min="1" max="5" value={mode === 'predicted' ? attempt.confidenceBefore : attempt.confidenceAfter} onChange={e => updateAttempt(mode === 'predicted' ? { confidenceBefore: Number(e.target.value) } : { confidenceAfter: Number(e.target.value) })} /></label></div>
          <HintPanel hints={route.hints} revealed={attempt.hintLevelUsed} onReveal={level => updateAttempt({ hintLevelUsed: level })} />
        </div>
      </div>
      <div className="workspace-next"><div><span className="eyebrow">{mode === 'predicted' ? 'Ready to climb?' : 'After your attempt'}</span><h2>{mode === 'predicted' ? 'Save the read. Keep the problem.' : 'See what the wall taught you.'}</h2></div><button className="primary-button" onClick={() => mode === 'predicted' ? setMode('actual') : setScreen('compare')}>{mode === 'predicted' ? 'Save prediction & record actual' : 'Compare both reads'} <Icon name="arrow" /></button></div>
    </main>}
    {screen === 'compare' && <main className="page compare-page"><button className="text-button" onClick={() => setScreen('workspace')}>← Back to route</button><div className="page-intro"><span className="eyebrow">Prediction vs actual</span><h1>Look at the difference.</h1><p>The gap between what you expected and what you did is where learning becomes visible.</p></div><ComparisonView route={route} predicted={attempt.predictedBeta} actual={attempt.actualBeta} /><ReflectionForm value={attempt.reflection} onChange={reflection => updateAttempt({ reflection })} /></main>}
    {screen === 'research' && <ResearchSummary attempts={attempts} />}
    {screen === 'about' && <About />}
    {screen !== 'workspace' && <Footer />}
  </div>
}

function Header({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  return <header className="site-header"><button className="logo" onClick={() => onNavigate('home')} aria-label="BETA home"><span>B</span>BETA</button><nav><button className={screen === 'library' ? 'active' : ''} onClick={() => onNavigate('library')}>Routes</button><button className={screen === 'research' ? 'active' : ''} onClick={() => onNavigate('research')}>Research</button><button className={screen === 'about' ? 'active' : ''} onClick={() => onNavigate('about')}>About</button></nav></header>
}

function Home({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return <main className="home"><section className="hero"><div className="hero-copy"><span className="eyebrow">A route-reading experiment</span><h1>Learn to see<br />the <em>climb.</em></h1><p>BETA helps you study movement before you leave the ground—then notice what changed when you climbed.</p><div className="hero-actions"><button className="primary-button" onClick={onStart}>Read a route <Icon name="arrow" /></button><button className="secondary-button" onClick={onDemo}>Try a demo</button></div><p className="quiet-note"><span>✦</span> Hint, don’t solve.</p></div><div className="hero-visual"><div className="hero-photo"><img src={`${import.meta.env.BASE_URL}routes/feet-first-v1-blue.webp`} alt="A blue bouldering route on a quiet indoor wall" /><span className="hero-marker m1">LH</span><span className="hero-marker m2">RF</span><svg viewBox="0 0 100 100"><path d="M42 75 Q60 58 51 41" /></svg><div className="visual-note"><span>02 · Notice</span><strong>Where does your weight need to be?</strong></div></div></div></section>
    <section className="philosophy"><span className="eyebrow light">The idea</span><blockquote>“The best hint changes what you notice—<br />without taking away the discovery.”</blockquote><div className="principles"><article><span>01</span><h3>Read</h3><p>Make your own movement prediction before touching the wall.</p></article><article><span>02</span><h3>Climb</h3><p>Record the sequence your body actually found.</p></article><article><span>03</span><h3>Reflect</h3><p>Compare the two reads without judgment or scores.</p></article></div></section>
  </main>
}

function Library({ onOpen, attempts }: { onOpen: (r: Route) => void; attempts: Record<string, Attempt> }) {
  const completed = useMemo(() => Object.values(attempts).filter(a => a.predictedBeta.length).length, [attempts])
  const uploadRef = useRef<HTMLInputElement>(null)
  const upload = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onOpen({
      id: `local-${Date.now()}`, title: file.name.replace(/\.[^.]+$/, '') || 'My route', image: String(reader.result),
      grade: 'Open', colorName: 'Custom', accent: '#315c4d', notes: 'A route from your own wall.', insight: 'Start with what catches your attention.',
      hints: ['Scan the route again, especially the spaces between holds.', 'Look for the position that makes the next move feel quieter.', 'Could a weight shift or flag create balance?', 'Set the most useful foot first, bring your hips toward the wall, then move your hand.']
    })
    reader.readAsDataURL(file)
  }
  return <main className="page library-page"><div className="page-intro library-intro"><div><span className="eyebrow">Route library · 23 studies</span><h1>What do you notice?</h1><p>Choose a line, study the holds, then sketch the movement you imagine.</p></div>{completed > 0 && <span className="local-progress">{completed} saved locally</span>}</div>
    <input ref={uploadRef} className="visually-hidden" type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} />
    <button className="upload-route" onClick={() => uploadRef.current?.click()}><span>＋</span><div><strong>Read your own route</strong><small>Choose a photo from this device</small></div><b>Upload photo</b></button>
    <div className="route-grid">{routes.map((r, i) => <button className={`route-card ${i < 3 ? 'featured' : ''}`} key={r.id} onClick={() => onOpen(r)}><div className="route-image"><img src={r.image} alt={`${r.colorName} ${r.grade} climbing route`} /><span className="grade"><i style={{ background: r.accent }} />{r.grade} · {r.colorName}</span>{attempts[r.id]?.predictedBeta.length ? <span className="saved"><Icon name="check" size={14} /> Saved</span> : null}</div><div className="route-card-copy"><span>{String(i + 1).padStart(2, '0')}</span><div><h2>{r.title}</h2><p>{r.insight}</p></div><b>↗</b></div></button>)}</div>
  </main>
}

function About() {
  return <main className="page about-page"><div className="about-hero"><span className="eyebrow">About the experiment</span><h1>How much guidance helps—<br /><em>without solving?</em></h1><p>BETA is a design research prototype about perception, movement, and preserving a climber’s independence.</p></div><div className="about-grid"><article><span>Question</span><h2>How do experienced and less-experienced climbers perceive the same route differently?</h2></article><article><span>Design principle</span><h2>Hint, don’t solve.</h2><p>Guidance arrives in deliberate stages, from attention to explicit beta.</p></article><article><span>Hypothesis</span><h2>Progressive visual guidance may improve route-reading skill better than immediately showing the full beta.</h2></article></div><section className="test-section"><span className="eyebrow">What we would test</span><div>{['Route-reading accuracy', 'Hints requested', 'Route completion', 'Transfer to a new route', 'Confidence', 'Perceived independence'].map((x, i) => <p key={x}><span>{String(i + 1).padStart(2, '0')}</span>{x}</p>)}</div></section></main>
}

function Footer() { return <footer><span className="logo"><span>B</span>BETA</span><p>Made to keep the problem in your hands.</p><small>Local prototype · No account · No cloud</small></footer> }

export default App
