import { useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import {
  createSessionTranscriptIndex,
  type SessionTranscriptHit,
  type SessionTranscriptIndex,
  type SessionTranscriptReader,
  type SessionTranscriptSource,
} from '../lib/sessionTranscriptSearch'
import type { PrimeTranscriptItem } from '../lib/primeTranscriptToConversation'
import { trackEvent } from '../lib/telemetry'

// Note search debounces at 300ms. This waits longer so the two host reads
// do not start in the same turn.
const SEARCH_DEBOUNCE_MS = 600

function primeSessionTranscriptReader(): SessionTranscriptReader {
  return {
    async listSessions() {
      const listed = await callHost<unknown>('list_prime_session_summaries')
      if (!Array.isArray(listed)) throw new Error('session list unavailable')
      return listed.flatMap((row): SessionTranscriptSource[] => {
        if (!row || typeof row !== 'object') return []
        const session = row as Partial<SessionTranscriptSource>
        if (typeof session.path !== 'string' || session.path.length === 0) return []
        return [{
          id: typeof session.id === 'string' ? session.id : session.path,
          path: session.path,
          title: typeof session.title === 'string' ? session.title : null,
          mtimeMs: typeof session.mtimeMs === 'number' ? session.mtimeMs : null,
        }]
      })
    },
    readTranscript(path) {
      return callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', { path })
    },
  }
}

/**
 * Search session transcripts for the app search box.
 *
 * The index lives for the life of this hook, so a later keystroke does not
 * re-read a transcript whose list stamp has not changed.
 */
export function useSessionTranscriptSearch(query: string, enabled: boolean): SessionTranscriptHit[] {
  const indexRef = useRef<SessionTranscriptIndex | null>(null)
  const [result, setResult] = useState<{ query: string; hits: SessionTranscriptHit[] }>({
    query: '',
    hits: [],
  })
  const trimmed = query.trim()

  useEffect(() => {
    if (!enabled || !trimmed) return undefined

    let cancelled = false
    const timer = setTimeout(() => {
      const index = indexRef.current ?? createSessionTranscriptIndex(primeSessionTranscriptReader())
      indexRef.current = index
      void index.search(trimmed).then((next) => {
        if (cancelled) return
        setResult({ query: trimmed, hits: next })
        trackEvent('session_transcript_search', { hit_count: next.length })
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, trimmed])

  if (!enabled || result.query !== trimmed) return []
  return result.hits
}
