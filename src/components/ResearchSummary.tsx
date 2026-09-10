import type { Attempt } from '../types'

export function ResearchSummary({ attempts }: { attempts: Record<string, Attempt> }) {
  const local = Object.values(attempts), localCount = local.filter(a => a.actualBeta.length).length
  const rows = [
    ['Feet First', 3, 2, 'Yes', 2, 4], ['Weight Shift', 2, 3, 'Yes', 3, 4],
    ['Multiple Betas', 4, 1, 'Yes', 2, 3], ['Quiet Toes', 1, 0, 'No', 4, 4],
    ['Corner Study', 3, 2, 'Yes', 2, 4], ['Open Door', 2, 1, 'No', 3, 4]
  ]
  const average = (index: number) => (rows.reduce((sum, r) => sum + Number(r[index]), 0) / rows.length).toFixed(1)
  return <main className="page research-page">
    <div className="page-intro"><span className="eyebrow">Prototype research view</span><h1>What are climbers noticing?</h1><p>Directional signals for the study—not performance scores.</p></div>
    <div className="metric-grid">
      <article><span>Demo attempts</span><strong>{rows.length + localCount}</strong><small>{localCount} recorded on this device</small></article>
      <article><span>Average hint level</span><strong>1.5</strong><small>Most stopped before explicit beta</small></article>
      <article><span>Beta changed</span><strong>67%</strong><small>Across the illustrative sample</small></article>
      <article><span>Confidence shift</span><strong>+{(Number(average(5)) - Number(average(4))).toFixed(1)}</strong><small>On a five-point scale</small></article>
    </div>
    <section className="research-table-card"><div className="section-heading"><div><span className="eyebrow">Illustrative sessions</span><h2>Small signals, held lightly</h2></div><span className="demo-pill">Demo data</span></div>
      <div className="table-wrap"><table><thead><tr><th>Route</th><th>Attempts</th><th>Hint</th><th>Beta changed</th><th>Before</th><th>After</th></tr></thead><tbody>{rows.map(r => <tr key={String(r[0])}>{r.map((v, i) => <td key={i}>{i === 2 ? (Number(v) === 0 ? 'None' : `Level ${v}`) : v}</td>)}</tr>)}</tbody></table></div>
    </section>
    <p className="research-note">This view is intentionally modest. It supports research conversations without turning learning into a leaderboard.</p>
  </main>
}
