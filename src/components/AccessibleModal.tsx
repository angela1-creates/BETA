import { useEffect, useRef, type ReactNode } from 'react'

export function AccessibleModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = panel.current
    root?.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea,button:not([aria-label="Close"])')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll<HTMLElement>('button,input,select,textarea')].filter(item => !item.hasAttribute('disabled'))
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="sheet" ref={panel} role="dialog" aria-modal="true" aria-label={title}><div className="sheet-head"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div>{children}</div></div>
}
