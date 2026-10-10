import { useRef, useState } from 'react'
import type { MoveStep, Route, Tool } from '../types'

const colors: Record<Tool, string> = { LH: '#2f65a0', RH: '#db5f49', LF: '#467b69', RF: '#c18b22', MOVE: '#202a27' }

export function RouteCanvas({ route, steps, tool, mode, selectedId, onSelect, onAdd }: {
  route: Route; steps: MoveStep[]; tool: Tool; mode: 'predicted' | 'actual'; selectedId?: string
  onSelect: (id: string) => void; onAdd: (step: Omit<MoveStep, 'id' | 'order' | 'note'>) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null)
  const click = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-marker]')) return
    const box = ref.current!.getBoundingClientRect()
    const point = { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 }
    if (tool !== 'MOVE') onAdd({ type: tool, ...point })
    else if (!arrowStart) setArrowStart(point)
    else { onAdd({ type: 'MOVE', x: arrowStart.x, y: arrowStart.y, endX: point.x, endY: point.y }); setArrowStart(null) }
  }

  return <div className={`route-canvas ${mode}`} ref={ref} onPointerDown={click} role="application" aria-label={`Annotate ${route.title}`}>
    <img src={route.image} alt={`Indoor climbing wall for ${route.title}`} draggable="false" />
    <svg className="arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><marker id={`head-${mode}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={mode === 'predicted' ? '#315c4d' : '#e76f51'} /></marker></defs>
      {steps.filter(s => s.type === 'MOVE').map(s => <line key={s.id} x1={s.x} y1={s.y} x2={s.endX} y2={s.endY} markerEnd={`url(#head-${mode})`} />)}
      {arrowStart && <circle cx={arrowStart.x} cy={arrowStart.y} r="1.4" className="arrow-start" />}
    </svg>
    {steps.filter(s => s.type !== 'MOVE').map(s => <button data-marker key={s.id} onPointerDown={e => { e.stopPropagation(); onSelect(s.id) }} className={`marker marker-${s.type} ${selectedId === s.id ? 'active' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, background: colors[s.type] }} aria-label={`${s.order}. ${s.type}`}>
      <span>{s.type}</span><em>{s.order}</em>
    </button>)}
    <div className="canvas-prompt">{tool === 'MOVE' ? (arrowStart ? 'Tap the arrow end' : 'Tap the arrow start') : `Tap a hold for ${tool}`}</div>
  </div>
}
