import { useEffect, useRef, useState } from 'react'
import type { Attempt } from '../types'
import { useTranslation } from 'react-i18next'

export function AttemptMedia({ attempt, canSync, onUpload, onDelete }: {
  attempt: Attempt
  canSync: boolean
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const choose = (next?: File) => {
    if (!next) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(next); setPreview(URL.createObjectURL(next)); setProgress(0); setError('')
  }
  const upload = async () => {
    if (!file || !canSync) return
    setBusy(true); setError('')
    try { await onUpload(file, setProgress); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('routeLab.media.uploadError')) }
    finally { setBusy(false) }
  }
  const mediaUrl = preview || attempt.mediaUrl
  const kind = file ? (file.type.startsWith('video/') ? 'video' : 'image') : attempt.mediaKind
  return <section className="attempt-media-card"><div><span className="eyebrow">{t('routeLab.media.kicker')}</span><h2>{t('routeLab.media.title')}</h2><p>{t('routeLab.media.description')}</p></div><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={event => choose(event.target.files?.[0])}/>{mediaUrl && <div className="attempt-media-preview">{kind === 'video' ? <video src={mediaUrl} controls playsInline/> : <img src={mediaUrl} alt={t('routeLab.media.alt')}/>}</div>}{!file && !attempt.mediaPath && <button className="secondary-button" onClick={() => fileRef.current?.click()}>{t('routeLab.media.choose')}</button>}{file && <div className="media-draft-actions"><span>{file.name}</span><button className="secondary-button" onClick={() => fileRef.current?.click()}>{t('routeLab.media.replace')}</button><button className="primary-button" disabled={!canSync || busy} onClick={() => void upload()}>{busy ? t('routeLab.media.uploading', { progress }) : canSync ? t('routeLab.media.uploadPrivate') : t('routeLab.media.signIn')}</button></div>}{busy && <progress max="100" value={progress} aria-label={t('routeLab.media.progress', { progress })}/>} {!file && attempt.mediaPath && <button className="text-button danger-text" disabled={busy} onClick={() => void onDelete().catch(cause => setError(cause instanceof Error ? cause.message : t('routeLab.media.deleteError')))}>{t('routeLab.media.delete')}</button>}{file && !canSync && <p className="local-draft-note">{t('routeLab.media.local')}</p>}{error && <p className="form-error" role="alert">{error} {t('routeLab.media.retry')}</p>}</section>
}
