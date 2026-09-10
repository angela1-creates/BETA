import type { MoveStep } from '../types'

export function SequencePanel({ steps, selectedId, onSelect, onUpdate, onDelete, onMove }: {
  steps: MoveStep[]; selectedId?: string; onSelect: (id: string) => void
  onUpdate: (id: string, note: string) => void; onDelete: (id: string) => void; onMove: (id: string, delta: number) => void
}) {
  return <section className="sequence-card">
    <div className="section-heading"><div><span className="eyebrow">Your sequence</span><h2>Read it move by move</h2></div><span className="step-count">{steps.length} steps</span></div>
    {!steps.length && <div className="empty-sequence"><span>01</span><p>Select a marker, then tap the route to begin your read.</p></div>}
    <ol className="sequence-list">
      {steps.map((step, index) => <li key={step.id} className={selectedId === step.id ? 'active' : ''} onClick={() => onSelect(step.id)}>
        <span className={`sequence-type type-${step.type}`}>{step.type === 'MOVE' ? '↗' : step.type}</span>
        <div className="sequence-copy">
          <strong>{step.note || (step.type === 'MOVE' ? 'Movement' : `${step.type} placement`)}</strong>
          <input aria-label={`Note for step ${index + 1}`} value={step.note} onChange={e => onUpdate(step.id, e.target.value)} onClick={e => e.stopPropagation()} placeholder="Add a short note…" />
        </div>
        <div className="reorder">
          <button disabled={index === 0} onClick={e => { e.stopPropagation(); onMove(step.id, -1) }} aria-label="Move step up">↑</button>
          <button disabled={index === steps.length - 1} onClick={e => { e.stopPropagation(); onMove(step.id, 1) }} aria-label="Move step down">↓</button>
          <button className="delete" onClick={e => { e.stopPropagation(); onDelete(step.id) }} aria-label="Delete step">×</button>
        </div>
      </li>)}
    </ol>
  </section>
}
