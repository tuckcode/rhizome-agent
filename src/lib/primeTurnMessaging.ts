import { callHost } from './callHost'

/**
 * Talking to a turn that is already running.
 *
 * Prime's daemon takes two kinds of mid-turn message and they mean different
 * things: `steer` redirects the work in flight without discarding it, and
 * `follow_up` queues a message to run once the turn finishes. Both reach us
 * through `prime_session_host::queue_message`, which answers `false` when
 * nothing is streaming — that is not an error, it means the turn ended
 * between the keystroke and the call, and the caller should send normally
 * instead.
 *
 * Kept out of `AiPanel` so the two verbs can be tested without standing up
 * the panel and its whole dependency graph.
 */

export type PrimeTurnMessageKind = 'steer' | 'followUp'

const COMMANDS: Record<PrimeTurnMessageKind, string> = {
  steer: 'steer_prime_session',
  followUp: 'follow_up_prime_session',
}

/**
 * Returns whether Prime took the message. `false` means there was no running
 * turn to attach it to; the caller decides what to do about that, because
 * "send it as a new turn" is right for a follow-up and wrong for nothing
 * else.
 */
export async function sendToRunningTurn(
  kind: PrimeTurnMessageKind,
  message: string,
): Promise<boolean> {
  const trimmed = message.trim()
  if (!trimmed) return false
  try {
    return await callHost<boolean>(COMMANDS[kind], { message: trimmed })
  } catch (error) {
    console.warn(`[prime] ${kind} failed:`, error)
    return false
  }
}
