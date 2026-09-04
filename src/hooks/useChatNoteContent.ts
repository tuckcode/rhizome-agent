import { useEffect, useState } from 'react'
import { loadChatNoteContent } from '../utils/loadChatNoteContent'

interface ChatNoteContent {
  body: string | null
  error: boolean
  loading: boolean
}

/**
 * The body of the note Chat currently has open.
 *
 * Lifted out of `ChatNotePane` so the agent can see the same note the user is
 * reading. The pane owned this fetch, which meant the note existed only inside
 * a presentational component — and Chat never passed anything to `AiPanel`, so
 * asking "what does this note say?" with the note open on screen got an agent
 * that had no idea which note you meant.
 *
 * One fetch, two readers: the pane renders it, the agent gets it as context.
 */
export function useChatNoteContent(
  path?: string | null,
  vaultPath?: string | null,
): ChatNoteContent {
  const [loaded, setLoaded] = useState<{ path: string; body: string } | null>(null)
  const [failedPath, setFailedPath] = useState<string | null>(null)

  useEffect(() => {
    if (!path || !vaultPath) return
    const requested = path
    let cancelled = false
    void loadChatNoteContent(requested, vaultPath)
      .then((content) => {
        if (cancelled) return
        setLoaded({ path: requested, body: content })
        setFailedPath(null)
      })
      .catch(() => {
        if (cancelled) return
        setFailedPath(requested)
      })
    return () => {
      cancelled = true
    }
  }, [path, vaultPath])

  // Keyed on the path, so a body never outlives the note it came from. The
  // previous note's text under a new title would be wrong on screen and wrong
  // in the agent's context, which is the worse of the two.
  const body = path && loaded?.path === path ? loaded.body : null
  const error = Boolean(path && failedPath === path)
  const loading = Boolean(path && vaultPath && loaded?.path !== path && !error)

  return { body, error, loading }
}
