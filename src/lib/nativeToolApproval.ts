export type NativeApprovalChoice = 'allow_once' | 'allow_session' | 'deny'

export function isBashTool(tool: string): boolean {
  return tool === 'bash'
}

export interface NativeApprovalOption {
  id: string
  label: string
}

export interface NativeApprovalPrompt {
  promptId: string
  tool: string
  args: string
  /**
   * Tool-call id. Mapped from EngineEvent::ApprovalRequested.call_id
   * (shell runner PR). Optional on main until that event field ships.
   */
  callId?: string
  options: NativeApprovalOption[]
  path?: string
  preview?: string
  notes?: string[]
  capped?: boolean
  created?: boolean
  overwrite?: boolean
  reply: (choice: NativeApprovalChoice) => void
}

export interface ApprovalMatchAction {
  tool: string
  toolId: string
  status: string
  approval?: unknown
}

export function approvalCallId(
  prompt: { callId?: string; call_id?: string },
): string | undefined {
  return prompt.callId ?? prompt.call_id
}

/**
 * Match an approval prompt to a pending tool action.
 * Prefer EngineEvent::ApprovalRequested.call_id (mapped to callId).
 * On main the event has no call_id yet, so fall back to the last pending
 * action of the same tool that has no approval.
 */
export function matchPendingApprovalAction<T extends ApprovalMatchAction>(
  actions: T[],
  prompt: Pick<NativeApprovalPrompt, 'tool'> & { callId?: string; call_id?: string },
): T | undefined {
  const callId = approvalCallId(prompt)
  if (callId) {
    return [...actions].reverse().find((action) => (
      action.status === 'pending'
      && action.toolId === callId
      && !action.approval
    ))
  }
  return [...actions].reverse().find((action) => (
    action.status === 'pending'
    && action.tool === prompt.tool
    && !action.approval
  ))
}

export function pathFromToolArgs(args?: string): string | undefined {
  if (!args?.trim()) return undefined
  try {
    const parsed = JSON.parse(args) as { path?: unknown }
    return typeof parsed.path === 'string' && parsed.path.trim()
      ? parsed.path.trim()
      : undefined
  } catch {
    return undefined
  }
}

export function commandFromToolArgs(args?: string): string | undefined {
  const trimmed = args?.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed) as { command?: unknown; cmd?: unknown }
    if (typeof parsed.command === 'string' && parsed.command.trim()) return parsed.command
    if (typeof parsed.cmd === 'string' && parsed.cmd.trim()) return parsed.cmd
    return undefined
  } catch {
    return trimmed
  }
}

export function timeoutSecsFromToolArgs(args?: string): number | undefined {
  if (!args?.trim()) return undefined
  try {
    const parsed = JSON.parse(args) as { timeout_secs?: unknown; timeoutSecs?: unknown }
    const value = parsed.timeout_secs ?? parsed.timeoutSecs
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function approvalTitle(tool: string, created: boolean): string {
  if (isBashTool(tool)) return 'Run command'
  if (tool === 'write_file') return created ? 'Create file' : 'Write file'
  if (tool === 'edit_file') return 'Edit file'
  return tool
}

export function previewLooksCreated(preview?: string): boolean {
  return Boolean(preview?.includes('--- /dev/null'))
}
