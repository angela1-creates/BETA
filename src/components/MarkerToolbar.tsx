import type { Tool } from '../types'
import { Icon } from './Icon'
import { useTranslation } from 'react-i18next'

const tools: { id: Tool; label: string; detail: string }[] = [
  { id: 'LH', label: 'LH', detail: 'Left hand' }, { id: 'RH', label: 'RH', detail: 'Right hand' },
  { id: 'LF', label: 'LF', detail: 'Left foot' }, { id: 'RF', label: 'RF', detail: 'Right foot' },
  { id: 'MOVE', label: '↗', detail: 'Movement arrow' }
]

export function MarkerToolbar({ selected, onSelect }: { selected: Tool; onSelect: (tool: Tool) => void }) {
  const { t } = useTranslation()
  const detail = (id: Tool) => t(`routeLab.tools.${id === 'LH' ? 'leftHand' : id === 'RH' ? 'rightHand' : id === 'LF' ? 'leftFoot' : id === 'RF' ? 'rightFoot' : 'arrow'}`)
  return <div className="toolbar" aria-label={t('routeLab.tools.label')}>
    {tools.map(tool => <button key={tool.id} className={`tool ${selected === tool.id ? 'selected' : ''}`} onClick={() => onSelect(tool.id)} aria-pressed={selected === tool.id} title={detail(tool.id)}>
      <span>{tool.id === 'MOVE' ? <Icon name="arrow" /> : tool.label}</span>
      <small>{tool.id === 'MOVE' ? t('routeLab.tools.arrowShort') : detail(tool.id)}</small>
    </button>)}
  </div>
}
