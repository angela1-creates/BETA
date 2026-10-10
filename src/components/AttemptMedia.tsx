import { useEffect, useRef, useState } from 'react'
import type { Attempt } from '../types'

export function AttemptMedia({ attempt, canSync, onUpload, onDelete }: {
  attempt: Attempt
  canSync: boolean
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<void>
  onDelete: () => Promise<void>
}) {
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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed. Your local preview is still here.') }
    finally { setBusy(false) }
  }
  const mediaUrl = preview || attempt.mediaUrl
  const kind = file ? (file.type.startsWith('video/') ? 'video' : 'image') : attempt.mediaKind
  return <section className="attempt-media-card"><div><span className="eyebrow">Climbing evidence</span><h2>Attach what happened.</h2><p>A private photo or short video can help you compare your prediction with the climb. It is optional.</p></div><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={event => choose(event.target.files?.[0])}/>{mediaUrl && <div className="attempt-media-preview">{kind === 'video' ? <video src={mediaUrl} controls playsInline/> : <img src={mediaUrl} alt="Private climbing attempt"/>}</div>}{!file && !attempt.mediaPath && <button className="secondary-button" onClick={() => fileRef.current?.click()}>Choose photo or video</button>}{file && <div className="media-draft-actions"><span>{file.name}</span><button className="secondary-button" onClick={() => fileRef.current?.click()}>Replace</button><button className="primary-button" disabled={!canSync || busy} onClick={() => void upload()}>{busy ? `Uploading ${progress}%` : canSync ? 'Upload privately' : 'Sign in and consent to upload'}</button></div>}{busy && <progress max="100" value={progress} aria-label={`Upload ${progress}%`}/>} {!file && attempt.mediaPath && <button className="text-button danger-text" disabled={busy} onClick={() => void onDelete().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not delete media.'))}>Delete this media</button>}{file && !canSync && <p className="local-draft-note">This preview stays only in this tab until you sign in and consent.</p>}{error && <p className="form-error" role="alert">{error} You can retry without choosing the file again.</p>}</section>
}
