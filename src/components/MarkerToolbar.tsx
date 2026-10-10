import type { Tool } from '../types'
import { Icon } from './Icon'

const tools: { id: Tool; label: string; detail: string }[] = [
  { id: 'LH', label: 'LH', detail: 'Left hand' }, { id: 'RH', label: 'RH', detail: 'Right hand' },
  { id: 'LF', label: 'LF', detail: 'Left foot' }, { id: 'RF', label: 'RF', detail: 'Right foot' },
  { id: 'MOVE', label: '↗', detail: 'Movement arrow' }
]

export function MarkerToolbar({ selected, onSelect }: { selected: Tool; onSelect: (tool: Tool) => void }) {
  return <div className="toolbar" aria-label="Annotation tools">
    {tools.map(tool => <button key={tool.id} className={`tool ${selected === tool.id ? 'selected' : ''}`} onClick={() => onSelect(tool.id)} aria-pressed={selected === tool.id} title={tool.detail}>
      <span>{tool.id === 'MOVE' ? <Icon name="arrow" /> : tool.label}</span>
      <small>{tool.id === 'MOVE' ? 'Arrow' : tool.detail.replace('Left ', 'L ').replace('Right ', 'R ')}</small>
    </button>)}
  </div>
}
