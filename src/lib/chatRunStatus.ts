import type { ChatRunSnapshot } from './chatRunLiveStatus'

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

export interface ChatRunStatus {
  state: ChatRunState
  label: string
  /** A short addition after the label, such as the elapsed time. */
  detail?: string
}

export interface ChatRunStatusInput {
  snapshot: ChatRunSnapshot
  /** Milliseconds since the last event of the run. */
  quietMs: number
  /** Why the worker did not start. */
  failureReason?: string | null
}

/** A run with no event for this long, and no tool that runs, is quiet. */
export const QUIET_AFTER_MS = 30_000
/** A tool shows its elapsed time after this long. */
export const TOOL_ELAPSED_AFTER_MS = 5_000

export function chatRunStatus({ snapshot, quietMs, failureReason }: ChatRunStatusInput): ChatRunStatus {
  if (failureReason) return { state: 'failed', label: failureReason }
  if (!snapshot.isActive) {
    return snapshot.capped
      ? { state: 'capped', label: 'Paused at the step limit' }
      : { state: 'idle', label: '' }
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
    const label = pending.length === 1 ? `Running ${pending[0].name}` : `Running ${pending.length} tools`
    return quietMs >= TOOL_ELAPSED_AFTER_MS
      ? { state: 'tool', label, detail: `${Math.floor(quietMs / 1000)}s` }
      : { state: 'tool', label }
  }
  if (quietMs >= QUIET_AFTER_MS) {
    return { state: 'quiet', label: `No response for ${quietDuration(quietMs)}` }
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
  actions?: Array<{ tool: string; toolId?: string; status: string; approval?: unknown; output?: string }>
}

/**
 * A key that changes each time the last turn gets an event: more text,
 * more reasoning, a new tool, or a tool that changes state. The status
 * hook starts its quiet clock again when the key changes.
 */
export function chatRunActivityKey(messages: ActivityMessage[]): string {
  const last = messages[messages.length - 1]
  if (!last) return ''
  const actions = (last.actions ?? [])
    .map((action) => `${action.toolId ?? action.tool}:${action.status}:${action.approval ? 'a' : ''}:${action.output?.length ?? 0}`)
    .join(',')
  return `${messages.length}|${last.response?.length ?? 0}|${last.reasoning?.length ?? 0}|${actions}`
}
