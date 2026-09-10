import type { Reflection } from '../types'

const prompts: { key: keyof Reflection; label: string; placeholder: string }[] = [
  { key: 'surprised', label: 'What surprised you?', placeholder: 'The move felt different because…' },
  { key: 'misread', label: 'Which move did you misread?', placeholder: 'I expected…' },
  { key: 'noticed', label: 'What did you notice after the attempt?', placeholder: 'From the ground, I missed…' },
  { key: 'hintImpact', label: 'Did a hint change what you noticed?', placeholder: 'The hint helped me see…' }
]

export function ReflectionForm({ value, onChange }: { value: Reflection; onChange: (r: Reflection) => void }) {
  return <section className="reflection-card">
    <span className="eyebrow">After the climb</span><h2>Notice what changed.</h2>
    <div className="reflection-grid">{prompts.map(p => <label key={p.key}><span>{p.label}</span><textarea value={value[p.key]} onChange={e => onChange({ ...value, [p.key]: e.target.value })} placeholder={p.placeholder} /></label>)}</div>
    <div className="autosave">Saved automatically on this device</div>
  </section>
}
