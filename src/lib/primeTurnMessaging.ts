import { callHost } from './callHost'

/**
 * Talking to a turn that is already running.
 *
 * Prime's daemon takes two kinds of mid-turn message and they mean different
 * things: `steer` redirects the work in flight without discarding it, and
 * `follow_up` queues a message to run once the turn finishes. Both reach us
 * through `prime_session_host::queue_message`, which distinguishes acceptance,
 * an ended turn, and a transport failure so a host outage cannot masquerade as
 * permission to start a new turn.
 *
 * Kept out of `AiPanel` so the two verbs can be tested without standing up
 * the panel and its whole dependency graph.
 */

export type PrimeTurnMessageKind = 'steer' | 'followUp'
export type PrimeTurnMessageResult = 'accepted' | 'not-running' | 'failed'

const COMMANDS: Record<PrimeTurnMessageKind, string> = {
  steer: 'steer_prime_session',
  followUp: 'follow_up_prime_session',
}

/**
 * Reports whether Prime took the message, the turn was no longer running, or
 * the transport failed. The caller owns fallback policy because only the
 * latest UI state can say whether starting a new turn is safe.
 */
export async function sendToRunningTurn(
  kind: PrimeTurnMessageKind,
  message: string,
): Promise<PrimeTurnMessageResult> {
  const trimmed = message.trim()
  if (!trimmed) return 'not-running'
  try {
    const accepted = await callHost<boolean>(COMMANDS[kind], { message: trimmed })
    return accepted ? 'accepted' : 'not-running'
  } catch (error) {
    console.warn(`[prime] ${kind} failed:`, error)
    return 'failed'
  }
}
