import type { ChatRunSnapshot } from './chatRunLiveStatus'
import { approvalTitle } from './nativeToolApproval'
import { workerStartFailureReason } from './primeWorkerStartError'

/**
 * The one description of what a chat run does now.
 *
 * The status line above the composer shows it. It replaces the frame
 * pulse and the spinner under the input, which each said only "busy".
 * A label claims only what the events show (docs/design/ui-rules.md,
 * "State-true copy"): a run with no event for 30 seconds gets "No
 * response", and it does not get "Stuck".
 */
export type ChatRunState =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'tool'
  | 'approval'
  | 'quiet'
  | 'capped'
  | 'failed'

/** The one action a state offers on the status line. */
export type ChatRunActionKind = 'stop' | 'continue' | 'sign_in'

export interface ChatRunAction {
  kind: ChatRunActionKind
  label: string
}

export interface ChatRunStatus {
  state: ChatRunState
  label: string
  /** A short addition after the label, such as the elapsed time. */
  detail?: string
  action?: ChatRunAction
}

/** Why the run did not start, in words that lead with the cause. */
export interface ChatRunFailure {
  label: string
  /** The cause is a ChatGPT sign-in that expired or is missing. */
  signIn: boolean
}

export interface ChatRunStatusInput {
  snapshot: ChatRunSnapshot
  /** Milliseconds since the last event of the run. */
  quietMs: number
  /** Milliseconds since the oldest tool that still runs started. */
  toolElapsedMs?: number
  /** Why the run did not start. */
  failure?: ChatRunFailure | null
}

/** A run with no event for this long, and no tool that runs, is quiet. */
export const QUIET_AFTER_MS = 30_000
/** A tool shows its elapsed time after this long. */
export const TOOL_ELAPSED_AFTER_MS = 5_000

export const CHATGPT_SIGN_IN_EXPIRED = 'Your ChatGPT sign-in expired. Sign in again.'

/**
 * The host's words for a ChatGPT sign-in that is gone
 * (provider_oauth SIGN_IN_AGAIN and NOT_USABLE). A turned-off sign-in is
 * a setting, not an expiry, so it keeps its own words.
 */
const SIGN_IN_GONE = [/(^|:\s*)sign in again\.?$/iu, /(^|:\s*)sign in with chatgpt is not usable\.?$/iu, /\bnot signed in\b/iu]

/** Describe a failed start so the cause comes first. Null when there is none. */
export function chatRunFailure(reason: string | null | undefined): ChatRunFailure | null {
  const cause = reason?.trim().replace(/^Error:\s*/u, '').trim()
  if (!cause) return null
  if (SIGN_IN_GONE.some((pattern) => pattern.test(cause))) {
    return { label: CHATGPT_SIGN_IN_EXPIRED, signIn: true }
  }
  return { label: cause, signIn: false }
}

/** The error at the end of a failed reply: `Error: …`, after any partial text. */
function trailingError(response: string): string | null {
  const match = response.match(/(?:^|\n\n)Error:\s*([\s\S]+)$/u)
  return match?.[1]?.trim() || null
}

/**
 * The failure the status line shows for a reply that ended in an error.
 * A Prime worker that did not start shows its cause. A ChatGPT sign-in
 * that is gone shows on every engine, with a way to sign in. Other chat
 * errors stay in the reply, where they already read in full.
 */
export function chatRunFailureFromReply(response: string | null | undefined, workerEngine: boolean): ChatRunFailure | null {
  if (!response) return null
  const worker = workerStartFailureReason(response)
  const failure = chatRunFailure(worker ?? trailingError(response))
  if (!failure) return null
  if (failure.signIn) return failure
  return workerEngine && worker ? failure : null
}

/** The friendly tool name the approval card uses, with a verb for the rest. */
export function runningToolLabel(tool: string): string {
  const friendly = approvalTitle(tool, false)
  return friendly === tool ? `Running ${tool}` : friendly
}

export function chatRunStatus({ snapshot, quietMs, toolElapsedMs = 0, failure }: ChatRunStatusInput): ChatRunStatus {
  if (failure) {
    return failure.signIn
      ? { state: 'failed', label: failure.label, action: { kind: 'sign_in', label: 'Sign in' } }
      : { state: 'failed', label: failure.label }
  }
  if (!snapshot.isActive) {
    if (!snapshot.capped) return { state: 'idle', label: '' }
    const more = snapshot.capped.max_steps
    return {
      state: 'capped',
      label: 'Paused at the step limit',
      action: { kind: 'continue', label: `Continue for ${more} more ${more === 1 ? 'step' : 'steps'}` },
    }
  }

  const pending = snapshot.tools.filter((tool) => tool.status === 'pending')
  const approvals = pending.filter((tool) => tool.needsApproval)
  if (approvals.length > 0) {
    return {
      state: 'approval',
      label: approvals.length === 1
        ? 'Waiting for your approval'
        : `Waiting for ${approvals.length} approvals`,
    }
  }
  if (pending.length > 0) {
    const label = pending.length === 1 ? runningToolLabel(pending[0].name) : `Running ${pending.length} tools`
    return toolElapsedMs >= TOOL_ELAPSED_AFTER_MS
      ? { state: 'tool', label, detail: `${Math.floor(toolElapsedMs / 1000)}s` }
      : { state: 'tool', label }
  }
  if (quietMs >= QUIET_AFTER_MS) {
    return { state: 'quiet', label: `No response for ${quietDuration(quietMs)}`, action: { kind: 'stop', label: 'Stop' } }
  }
  return snapshot.hasResponse
    ? { state: 'writing', label: 'Writing' }
    : { state: 'thinking', label: 'Thinking' }
}

function quietDuration(quietMs: number): string {
  const seconds = Math.floor(quietMs / 1000)
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.floor(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

interface ActivityMessage {
  response?: string
  reasoning?: string
  localMarker?: string
  actions?: Array<{ tool: string; toolId?: string; status: string; approval?: unknown; output?: string }>
}

/** The latest real turn. Local markers ("Model changed") are not turns. */
export function latestRunTurn<T extends { localMarker?: string }>(messages: T[]): T | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (!messages[index].localMarker) return messages[index]
  }
  return undefined
}

/**
 * A key that changes each time the latest turn gets an event: more text,
 * more reasoning, a new tool, or a tool that changes state. The status
 * hook starts its quiet clock again when the key changes.
 *
 * It reads the latest turn, not the last message, so a local marker
 * added during a run does not hide the turn's events from the clock.
 */
export function chatRunActivityKey(messages: ActivityMessage[]): string {
  const last = latestRunTurn(messages)
  if (!last) return ''
  const turns = messages.filter((message) => !message.localMarker).length
  const actions = (last.actions ?? [])
    .map((action) => `${action.toolId ?? action.tool}:${action.status}:${action.approval ? 'a' : ''}:${action.output?.length ?? 0}`)
    .join(',')
  return `${turns}|${last.response?.length ?? 0}|${last.reasoning?.length ?? 0}|${actions}`
}
