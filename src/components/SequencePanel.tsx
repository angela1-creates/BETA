import type { MoveStep } from '../types'
import { useTranslation } from 'react-i18next'

export function SequencePanel({ steps, selectedId, onSelect, onUpdate, onDelete, onMove }: {
  steps: MoveStep[]; selectedId?: string; onSelect: (id: string) => void
  onUpdate: (id: string, note: string) => void; onDelete: (id: string) => void; onMove: (id: string, delta: number) => void
}) {
  const { t } = useTranslation()
  return <section className="sequence-card">
    <div className="section-heading"><div><span className="eyebrow">{t('routeLab.sequence.kicker')}</span><h2>{t('routeLab.sequence.title')}</h2></div><span className="step-count">{t('routeLab.sequence.count', { count: steps.length })}</span></div>
    {!steps.length && <div className="empty-sequence"><span>01</span><p>{t('routeLab.sequence.empty')}</p></div>}
    <ol className="sequence-list">
      {steps.map((step, index) => <li key={step.id} className={selectedId === step.id ? 'active' : ''} onClick={() => onSelect(step.id)}>
        <span className={`sequence-type type-${step.type}`}>{step.type === 'MOVE' ? '↗' : step.type}</span>
        <div className="sequence-copy">
          <strong>{step.note || (step.type === 'MOVE' ? t('routeLab.sequence.movement') : t('routeLab.sequence.placement', { tool: step.type }))}</strong>
          <input aria-label={t('routeLab.sequence.note', { number: index + 1 })} value={step.note} onChange={e => onUpdate(step.id, e.target.value)} onClick={e => e.stopPropagation()} placeholder={t('routeLab.sequence.placeholder')} />
        </div>
        <div className="reorder">
          <button disabled={index === 0} onClick={e => { e.stopPropagation(); onMove(step.id, -1) }} aria-label={t('routeLab.sequence.up')}>↑</button>
          <button disabled={index === steps.length - 1} onClick={e => { e.stopPropagation(); onMove(step.id, 1) }} aria-label={t('routeLab.sequence.down')}>↓</button>
          <button className="delete" onClick={e => { e.stopPropagation(); onDelete(step.id) }} aria-label={t('routeLab.sequence.delete')}>×</button>
        </div>
      </li>)}
    </ol>
  </section>
}
