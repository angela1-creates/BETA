import type { MoveStep, Route } from '../types'
import { summarizeComparison } from '../compare'

const point = (s: MoveStep) => `${s.x},${s.y}`

export function ComparisonView({ route, predicted, actual }: { route: Route; predicted: MoveStep[]; actual: MoveStep[] }) {
  const markerSteps = (steps: MoveStep[]) => steps.filter(s => s.type !== 'MOVE')
  const pred = markerSteps(predicted), act = markerSteps(actual)
  const { matches, changed, footEarlier, alternateSolution } = summarizeComparison(predicted, actual)
  return <div className="comparison">
    <section className="comparison-visual">
      <img src={route.image} alt={route.title} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {pred.length > 1 && <polyline points={pred.map(point).join(' ')} className="pred-line" />}
        {act.length > 1 && <polyline points={act.map(point).join(' ')} className="actual-line" />}
      </svg>
      {[...pred.map(s => ({ ...s, source: 'P' })), ...act.map(s => ({ ...s, source: 'A' }))].map((s, i) => <span key={`${s.source}-${s.id}`} className={`compare-dot ${s.source === 'P' ? 'pred-dot' : 'actual-dot'}`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>{s.order}</span>)}
      <div className="comparison-legend"><span><i className="pred-key" />Predicted</span><span><i className="actual-key" />Actual</span></div>
    </section>
    <section className="comparison-insights">
      <span className="eyebrow">What changed</span>
      <h2>You found your way through.</h2>
      <p>Comparison is a way to notice—not a score.</p>
      <div className="insight-stats"><div><strong>{matches}</strong><span>moves aligned</span></div><div><strong>{changed}</strong><span>moves adapted</span></div></div>
      <div className="observations">
        {changed > 0 ? <p><span>↗</span>You changed your beta in {changed === 1 ? 'one place' : `${changed} places`}.</p> : <p><span>✓</span>Your sequences followed the same rhythm.</p>}
        {footEarlier && <p><span>◒</span>You used your feet earlier than predicted.</p>}
        {alternateSolution && <p><span>≈</span>You found an alternate solution.</p>}
        {!actual.length && <p><span>○</span>Record your actual beta to see movement differences here.</p>}
      </div>
    </section>
  </div>
}
