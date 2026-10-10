import { useRef, useState } from 'react'
import { Icon } from './Icon'

const levels = ['Attention', 'Principle', 'Movement family', 'Explicit beta']

export function HintPanel({ hints, revealed, onReveal }: { hints: string[]; revealed: number; onReveal: (level: number) => void }) {
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
    <div className="hint-title"><span className="hint-icon"><Icon name="spark" /></span><div><span className="eyebrow">Hint mode</span><h2>Keep the solving yours.</h2></div></div>
    <p className="muted">Each level offers a little more. Stop as soon as something new becomes visible.</p>
    <div className="hint-ladder">
      {levels.map((label, i) => {
        const level = i + 1, open = level <= revealed
        return <div className={`hint-level ${open ? 'open' : ''}`} key={label}>
          <div className="hint-level-head"><span>{level}</span><strong>{label}</strong>{open && <span className="revealed">Revealed</span>}</div>
          {open && <p>{hints[i]}</p>}
        </div>
      })}
    </div>
    {revealed < 4 && <button className={`reveal-button ${next === 4 ? 'strongest' : ''} ${holding ? 'holding' : ''}`} onClick={() => next !== 4 && onReveal(next)} onPointerDown={beginReveal} onPointerUp={cancelReveal} onPointerLeave={cancelReveal} onPointerCancel={cancelReveal} onKeyDown={e => next === 4 && (e.key === ' ' || e.key === 'Enter') && !e.repeat && beginReveal()} onKeyUp={e => next === 4 && (e.key === ' ' || e.key === 'Enter') && cancelReveal()}>
      {revealed === 0 ? 'Reveal a light hint' : next === 4 ? (holding ? 'Keep holding…' : 'Hold to reveal explicit beta') : 'Want a stronger hint?'} <span>Level {next}</span>
    </button>}
    {revealed === 4 && <p className="hint-end">That’s the full suggestion. Your own solution may still be different.</p>}
  </section>
}
