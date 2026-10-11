import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { useTranslation } from 'react-i18next'

export function HintPanel({ hints, revealed, onReveal }: { hints: string[]; revealed: number; onReveal: (level: number) => void }) {
  const { t } = useTranslation()
  const levels = [t('routeLab.hints.attention'), t('routeLab.hints.principle'), t('routeLab.hints.family'), t('routeLab.hints.explicit')]
  const next = Math.min(revealed + 1, 4)
  const holdTimer = useRef<number | null>(null)
  const [holding, setHolding] = useState(false)
  const beginReveal = () => {
    if (next !== 4) return
    setHolding(true)
    holdTimer.current = window.setTimeout(() => { onReveal(4); setHolding(false) }, 900)
  }
  const cancelReveal = () => { if (holdTimer.current) window.clearTimeout(holdTimer.current); holdTimer.current = null; setHolding(false) }
  return <section className="hint-card">
    <div className="hint-title"><span className="hint-icon"><Icon name="spark" /></span><div><span className="eyebrow">{t('routeLab.hints.kicker')}</span><h2>{t('routeLab.hints.title')}</h2></div></div>
    <p className="muted">{t('routeLab.hints.description')}</p>
    <div className="hint-ladder">
      {levels.map((label, i) => {
        const level = i + 1, open = level <= revealed
        return <div className={`hint-level ${open ? 'open' : ''}`} key={label}>
          <div className="hint-level-head"><span>{level}</span><strong>{label}</strong>{open && <span className="revealed">{t('routeLab.hints.revealed')}</span>}</div>
          {open && <p>{hints[i]}</p>}
        </div>
      })}
    </div>
    {revealed < 4 && <button className={`reveal-button ${next === 4 ? 'strongest' : ''} ${holding ? 'holding' : ''}`} onClick={() => next !== 4 && onReveal(next)} onPointerDown={beginReveal} onPointerUp={cancelReveal} onPointerLeave={cancelReveal} onPointerCancel={cancelReveal} onKeyDown={e => next === 4 && (e.key === ' ' || e.key === 'Enter') && !e.repeat && beginReveal()} onKeyUp={e => next === 4 && (e.key === ' ' || e.key === 'Enter') && cancelReveal()}>
      {revealed === 0 ? t('routeLab.hints.light') : next === 4 ? (holding ? t('routeLab.hints.holding') : t('routeLab.hints.hold')) : t('routeLab.hints.stronger')} <span>{t('routeLab.hints.level', { level: next })}</span>
    </button>}
    {revealed === 4 && <p className="hint-end">{t('routeLab.hints.end')}</p>}
  </section>
}
