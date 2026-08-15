import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { primeTranscriptToConversation, type PrimeTranscriptItem } from '../lib/primeTranscriptToConversation'
import { trackEvent } from '../lib/telemetry'
import type { AiAgentMessage } from '../lib/aiAgentConversation'

interface RehydrateOptions {
  /** Only Prime sessions have a transcript to rejoin. */
  enabled: boolean
  /** True when the host rejoined a session that was already running. */
  reattached: boolean
  /** The attached session's log file, from the host. */
  sessionPath: string | null | undefined
  /** Replace the panel's conversation with the rejoined transcript. */
  onTranscript: (messages: AiAgentMessage[]) => void
}

/**
 * Show the transcript of a session Rhizome rejoined when it opened.
 *
 * Closing the window detaches rather than ending the session (ADR-0163), so
 * reopening lands back in work that may still be running. Without this the
 * panel would render an empty conversation over a live session — the
 * transcript would be lying about its own history, which is exactly what the
 * markers in #18 exist to prevent elsewhere.
 *
 * Reads the session's own log file rather than matching an id against a disk
 * scan, so what is shown is always the session actually attached.
 *
 * Runs once per session path. The host status is polled every few seconds, and
 * without the guard every poll would replace the conversation and fight the
 * live stream for it.
 */
export function usePrimeSessionRehydrate({
  enabled,
  reattached,
  sessionPath,
  onTranscript,
}: RehydrateOptions): void {
  const rehydrated = useRef<string | null>(null)
  // Held in a ref so a caller passing an inline closure does not re-run the
  // effect on every render — the session path is what should drive it.
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  })

  useEffect(() => {
    if (!enabled || !reattached || !sessionPath) return
    if (rehydrated.current === sessionPath) return
    rehydrated.current = sessionPath

    let cancelled = false
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)

    void call<PrimeTranscriptItem[]>('read_prime_session_transcript', { path: sessionPath })
      .then((transcript) => {
        if (cancelled) return
        const messages = primeTranscriptToConversation(transcript)
        // An empty transcript is not worth clearing a conversation for: the
        // log may not have been flushed yet, and blanking the panel would look
        // like the work was lost.
        if (messages.length === 0) return
        onTranscriptRef.current(messages)
        trackEvent('prime_session_reattached', { messages: messages.length })
      })
      .catch(() => {
        // A transcript we cannot read is not a reason to surface an error: the
        // session is attached and live either way. Clearing the guard lets the
        // next effect run try again — switching session, or a remount. It is
        // deliberately not a retry loop, so a transient failure leaves the
        // panel empty over a live session until something else moves.
        rehydrated.current = null
      })

    return () => {
      cancelled = true
    }
  }, [enabled, reattached, sessionPath])
}
