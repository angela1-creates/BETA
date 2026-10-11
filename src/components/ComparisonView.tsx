import type { MoveStep, Route } from '../types'
import { summarizeComparison } from '../compare'
import { useTranslation } from 'react-i18next'

const point = (s: MoveStep) => `${s.x},${s.y}`

export function ComparisonView({ route, predicted, actual }: { route: Route; predicted: MoveStep[]; actual: MoveStep[] }) {
  const { t } = useTranslation()
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
      <div className="comparison-legend"><span><i className="pred-key" />{t('routeLab.compare.predicted')}</span><span><i className="actual-key" />{t('routeLab.compare.actual')}</span></div>
    </section>
    <section className="comparison-insights">
      <span className="eyebrow">{t('routeLab.compare.changed')}</span>
      <h2>{t('routeLab.compare.foundWay')}</h2>
      <p>{t('routeLab.compare.noScore')}</p>
      <div className="insight-stats"><div><strong>{matches}</strong><span>{t('routeLab.compare.aligned')}</span></div><div><strong>{changed}</strong><span>{t('routeLab.compare.adapted')}</span></div></div>
      <div className="observations">
        {changed > 0 ? <p><span>↗</span>{changed === 1 ? t('routeLab.compare.changedOne') : t('routeLab.compare.changedMany', { count: changed })}</p> : <p><span>✓</span>{t('routeLab.compare.sameRhythm')}</p>}
        {footEarlier && <p><span>◒</span>{t('routeLab.compare.feetEarlier')}</p>}
        {alternateSolution && <p><span>≈</span>{t('routeLab.compare.alternate')}</p>}
        {!actual.length && <p><span>○</span>{t('routeLab.compare.recordActual')}</p>}
      </div>
    </section>
  </div>
}
