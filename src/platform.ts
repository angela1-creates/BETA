export interface MediaDraft {
  file: File
  previewUrl: string
  kind: 'image' | 'video'
}

export interface MediaService {
  createDraft(file: File): MediaDraft
  releaseDraft(draft: MediaDraft): void
}

export interface ShareService {
  share(input: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'cancelled'>
}

export interface PreferenceService {
  get(key: string): string | null
  set(key: string, value: string): void
}

export const webMediaService: MediaService = {
  createDraft(file) {
    return { file, previewUrl: URL.createObjectURL(file), kind: file.type.startsWith('video/') ? 'video' : 'image' }
  },
  releaseDraft(draft) { URL.revokeObjectURL(draft.previewUrl) }
}

export const webShareService: ShareService = {
  async share(input) {
    try {
      if (navigator.share) { await navigator.share(input); return 'shared' }
      await navigator.clipboard.writeText(input.url)
      return 'copied'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      throw error
    }
  }
}

export const webPreferences: PreferenceService = {
  get: key => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value)
}

// Capacitor builds can replace these adapters without changing product components.
export const platform = { media: webMediaService, share: webShareService, preferences: webPreferences }
