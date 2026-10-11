import type { Attempt } from '../types'
import { useTranslation } from 'react-i18next'

export function ResearchSummary({ attempts }: { attempts: Record<string, Attempt> }) {
  const { t } = useTranslation()
  const local = Object.values(attempts), localCount = local.filter(a => a.actualBeta.length).length
  const rows = [
    ['Feet First', 3, 2, t('routeLab.research.yes'), 2, 4], ['Weight Shift', 2, 3, t('routeLab.research.yes'), 3, 4],
    ['Multiple Betas', 4, 1, t('routeLab.research.yes'), 2, 3], ['Quiet Toes', 1, 0, t('routeLab.research.no'), 4, 4],
    ['Corner Study', 3, 2, t('routeLab.research.yes'), 2, 4], ['Open Door', 2, 1, t('routeLab.research.no'), 3, 4]
  ]
  const average = (index: number) => (rows.reduce((sum, r) => sum + Number(r[index]), 0) / rows.length).toFixed(1)
  return <main className="page research-page">
    <div className="page-intro"><span className="eyebrow">{t('routeLab.research.kicker')}</span><h1>{t('routeLab.research.title')}</h1><p>{t('routeLab.research.description')}</p></div>
    <div className="metric-grid">
      <article><span>{t('routeLab.research.attempts')}</span><strong>{rows.length + localCount}</strong><small>{t('routeLab.research.recorded', { count: localCount })}</small></article>
      <article><span>{t('routeLab.research.averageHint')}</span><strong>1.5</strong><small>{t('routeLab.research.hintDetail')}</small></article>
      <article><span>{t('routeLab.research.betaChanged')}</span><strong>67%</strong><small>{t('routeLab.research.sample')}</small></article>
      <article><span>{t('routeLab.research.confidence')}</span><strong>+{(Number(average(5)) - Number(average(4))).toFixed(1)}</strong><small>{t('routeLab.research.fivePoint')}</small></article>
    </div>
    <section className="research-table-card"><div className="section-heading"><div><span className="eyebrow">{t('routeLab.research.sessions')}</span><h2>{t('routeLab.research.signals')}</h2></div><span className="demo-pill">{t('routeLab.research.demo')}</span></div>
      <div className="table-wrap"><table><thead><tr><th>{t('routeLab.research.route')}</th><th>{t('routeLab.research.attemptColumn')}</th><th>{t('routeLab.research.hint')}</th><th>{t('routeLab.research.changedColumn')}</th><th>{t('routeLab.research.before')}</th><th>{t('routeLab.research.after')}</th></tr></thead><tbody>{rows.map(r => <tr key={String(r[0])}>{r.map((v, i) => <td key={i}>{i === 2 ? (Number(v) === 0 ? t('routeLab.research.none') : t('routeLab.research.level', { level: v })) : v}</td>)}</tr>)}</tbody></table></div>
    </section>
    <p className="research-note">{t('routeLab.research.note')}</p>
  </main>
}
