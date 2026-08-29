import { useCallback, useLayoutEffect, useRef } from 'react'
import { toPrimeImages, type ComposerAttachment } from '../lib/composerAttachments'
import { sendToRunningTurn } from '../lib/primeTurnMessaging'
import { trackPrimeTurnMessage } from '../lib/productAnalytics'
import type { PrimeImageContent } from '../lib/composerAttachments'
import type { NoteReference } from '../utils/ai-context'

type SendReferences = NoteReference[]
type HandleSend = (text: string, references: SendReferences, images?: PrimeImageContent[]) => void

interface UseAiPanelSendPolicyArgs {
  handleSend: HandleSend
  isActive: boolean
  isPrimeTarget: boolean
  onSendPrompt?: (text: string) => void
  attachments: ComposerAttachment[]
  clearAttachments: () => void
  refreshQueue: () => void
  setInput: (value: string) => void
}

interface UseAiPanelSendPolicyResult {
  /**
   * Enter in the composer. Idle sends a new turn. Mid-turn queues a
   * follow-up on the daemon rather than being dropped — Enter must not
   * disturb work in flight, which is why redirecting it is Steer instead.
   */
  handleComposerSend: (text: string, references: SendReferences) => void
  /**
   * Redirect the running turn. Only wired for Prime — this is a daemon verb,
   * and the composer locks itself when no handler is supplied, which is what
   * every non-Prime target should keep doing.
   */
  handleSteer: (text: string, references: SendReferences) => void
}

/**
 * Mid-turn send policy: decides whether a composer submit starts a new turn,
 * queues a follow-up, or redirects (steers) the turn already running.
 *
 * This is the seam C46 named directly: send admission is decision logic with
 * no JSX, previously tangled into the panel component alongside everything
 * else it renders. `sendToRunningTurn` reports three outcomes — accepted, no
 * longer running, or transport failure — and only the middle one falls back
 * to starting a fresh turn; a transport failure must keep the user's draft
 * rather than silently resending it.
 *
 * `latestTurnState` exists because the callbacks above are created once per
 * render but resolve asynchronously (`sendToRunningTurn(...).then(...)`) —
 * by the time the daemon replies, `isActive` may be stale. Reading through a
 * ref instead of the closed-over value is what makes the idle fallback see
 * the panel's actual state instead of the state at keystroke time.
 */
export function useAiPanelSendPolicy({
  handleSend,
  isActive,
  isPrimeTarget,
  onSendPrompt,
  attachments,
  clearAttachments,
  refreshQueue,
  setInput,
}: UseAiPanelSendPolicyArgs): UseAiPanelSendPolicyResult {
  const latestTurnState = useRef({ handleSend, isActive, onSendPrompt })
  useLayoutEffect(() => {
    latestTurnState.current = { handleSend, isActive, onSendPrompt }
  }, [handleSend, isActive, onSendPrompt])

  const sendAsNewTurn = useCallback((text: string, references: SendReferences) => {
    const latest = latestTurnState.current
    latest.onSendPrompt?.(text)
    latest.handleSend(text, references, toPrimeImages(attachments) ?? undefined)
    clearAttachments()
    refreshQueue()
  }, [attachments, clearAttachments, refreshQueue])

  const sendAsNewTurnIfIdle = useCallback((text: string, references: SendReferences) => {
    if (latestTurnState.current.isActive) return
    sendAsNewTurn(text, references)
  }, [sendAsNewTurn])

  const handleComposerSend = useCallback((text: string, references: SendReferences) => {
    if (!text.trim() && attachments.length === 0) return
    if (isActive) {
      if (!isPrimeTarget) return
      void sendToRunningTurn('followUp', text).then((result) => {
        // `not-running` means the turn ended between the keystroke and the call.
        // Send it as a new turn rather than losing it.
        if (result === 'accepted') {
          trackPrimeTurnMessage('followUp')
          setInput('')
          refreshQueue()
        } else if (result === 'not-running') {
          sendAsNewTurnIfIdle(text, references)
        }
      })
      return
    }
    sendAsNewTurn(text, references)
  }, [attachments.length, isActive, isPrimeTarget, refreshQueue, sendAsNewTurn, sendAsNewTurnIfIdle, setInput])

  const handleSteer = useCallback((text: string, references: SendReferences) => {
    if (!text.trim() && attachments.length === 0) return
    void sendToRunningTurn('steer', text).then((result) => {
      if (result === 'accepted') {
        trackPrimeTurnMessage('steer')
        setInput('')
        refreshQueue()
      } else if (result === 'not-running') {
        sendAsNewTurnIfIdle(text, references)
      }
    })
  }, [attachments.length, refreshQueue, sendAsNewTurnIfIdle, setInput])

  return { handleComposerSend, handleSteer }
}
