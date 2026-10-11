import type { Reflection } from '../types'
import { useTranslation } from 'react-i18next'

const prompts: { key: keyof Reflection; label: string; placeholder: string }[] = [
  { key: 'surprised', label: 'What surprised you?', placeholder: 'The move felt different because…' },
  { key: 'misread', label: 'Which move did you misread?', placeholder: 'I expected…' },
  { key: 'noticed', label: 'What did you notice after the attempt?', placeholder: 'From the ground, I missed…' },
  { key: 'hintImpact', label: 'Did a hint change what you noticed?', placeholder: 'The hint helped me see…' }
]

export function ReflectionForm({ value, onChange }: { value: Reflection; onChange: (r: Reflection) => void }) {
  const { t } = useTranslation()
  const translatedPrompts = prompts.map(prompt => ({ ...prompt, label: t(`routeLab.reflection.${prompt.key}`), placeholder: t(`routeLab.reflection.${prompt.key === 'hintImpact' ? 'hintPlaceholder' : `${prompt.key}Placeholder`}`) }))
  return <section className="reflection-card">
    <span className="eyebrow">{t('routeLab.reflection.kicker')}</span><h2>{t('routeLab.reflection.title')}</h2>
    <div className="reflection-grid">{translatedPrompts.map(p => <label key={p.key}><span>{p.label}</span><textarea value={value[p.key]} onChange={e => onChange({ ...value, [p.key]: e.target.value })} placeholder={p.placeholder} /></label>)}</div>
    <div className="autosave">{t('routeLab.reflection.autosave')}</div>
  </section>
}
