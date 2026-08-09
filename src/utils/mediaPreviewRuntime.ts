import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import { isLinux } from './platform'

let cachedExternalMediaPreview: boolean | null = null
let pendingExternalMediaPreview: Promise<boolean> | null = null

function initialExternalMediaPreview(): boolean {
  return isTauri() && isLinux()
}

async function loadExternalMediaPreview(): Promise<boolean> {
  if (!isTauri()) return false
  if (cachedExternalMediaPreview !== null) return cachedExternalMediaPreview
  if (pendingExternalMediaPreview) return pendingExternalMediaPreview

  pendingExternalMediaPreview = invoke<boolean>('should_use_external_media_preview')
    .catch((error: unknown) => {
      console.warn('[media] Failed to resolve media preview runtime:', error)
      return false
    })
    .then((value) => {
      cachedExternalMediaPreview = value
      pendingExternalMediaPreview = null
      return value
    })

  return pendingExternalMediaPreview
}

export function useExternalMediaPreview(): boolean {
  const [externalMediaPreview, setExternalMediaPreview] = useState(
    cachedExternalMediaPreview ?? initialExternalMediaPreview(),
  )

  useEffect(() => {
    let cancelled = false

    void loadExternalMediaPreview().then((value) => {
      if (!cancelled) setExternalMediaPreview(value)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return externalMediaPreview
}
