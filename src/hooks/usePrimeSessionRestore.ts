import { useEffect, useRef } from 'react'
import { callHost } from '../lib/callHost'
import { decidePrimeSessionRestore, idleDiskRestoreEligible } from '../lib/primeSessionRestore'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'
import { primeTranscriptToConversation, type PrimeTranscriptItem } from '../lib/primeTranscriptToConversation'
import { trackEvent } from '../lib/telemetry'
import type { AiAgentMessage } from '../lib/aiAgentConversation'
import { isTauri } from '../mock-tauri'
import type { PrimeHostStatus } from './usePrimeHostStatus'

interface RestoreOptions {
  enabled: boolean
  host: Pick<PrimeHostStatus, 'running' | 'reattached' | 'sessionPath'>
  onTranscript: (messages: AiAgentMessage[]) => void
  onOpen: (session: PrimeSessionSummary) => void
  /** Tests inject this. Chat never passes it — native vs mock stays inside. */
  native?: boolean
}

let idleResumeConsumedThisRuntime = false

/** Vitest: each case starts as a fresh launch. */
export function resetPrimeSessionRestoreForTests(): void {
  idleResumeConsumedThisRuntime = false
}

/**
 * Show the conversation Chat should land on.
 *
 * A host that is running is not a Session. Rejoined work is one path. An idle
 * last log on disk is another. New Chat this runtime stays empty. Callers pass
 * host status and two writers; they do not combine `reattached`, `running`,
 * `sessionPath`, or `isTauri`.
 */
export function usePrimeSessionRestore({
  enabled,
  host,
  onTranscript,
  onOpen,
  native = isTauri(),
}: RestoreOptions): void {
  const liveAttached = useRef<string | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onOpenRef = useRef(onOpen)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onOpenRef.current = onOpen
  })

  const hostRunning = host.running
  const hostReattached = host.reattached ?? false
  const hostSessionPath = host.sessionPath

  useEffect(() => {
    if (!enabled) return

    const liveDecision = decidePrimeSessionRestore({
      enabled,
      native,
      hostRunning,
      hostReattached,
      hostSessionPath,
      summaries: [],
      idleResumeConsumed: idleResumeConsumedThisRuntime,
    })

    if (liveDecision.type === 'live-attach') {
      const sessionPath = liveDecision.sessionPath
      if (liveAttached.current === sessionPath) return
      liveAttached.current = sessionPath
      idleResumeConsumedThisRuntime = true

      let cancelled = false
      void callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', { path: sessionPath })
        .then((transcript) => {
          if (cancelled) return
          const messages = primeTranscriptToConversation(transcript)
          if (messages.length === 0) return
          onTranscriptRef.current(messages)
          trackEvent('prime_session_reattached', { messages: messages.length })
        })
        .catch(() => {
          liveAttached.current = null
        })

      return () => {
        cancelled = true
      }
    }

    if (!idleDiskRestoreEligible({
      enabled,
      native,
      hostRunning,
      hostReattached,
      hostSessionPath,
      idleResumeConsumed: idleResumeConsumedThisRuntime,
    })) return
    idleResumeConsumedThisRuntime = true

    let cancelled = false
    void callHost<PrimeSessionSummary | null>('latest_prime_session_for_restore')
      .then((session) => {
        if (cancelled || !session) return
        const action = decidePrimeSessionRestore({
          enabled,
          native,
          hostRunning,
          hostReattached,
          hostSessionPath,
          summaries: [session],
          idleResumeConsumed: false,
        })
        if (action.type !== 'idle-disk') return
        onOpenRef.current(action.session)
      })
      .catch(() => {
        idleResumeConsumedThisRuntime = false
      })

    return () => {
      cancelled = true
    }
  }, [enabled, native, hostRunning, hostReattached, hostSessionPath])
}
