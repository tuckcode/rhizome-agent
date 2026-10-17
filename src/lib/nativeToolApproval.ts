import { BASH_DEFAULT_TIMEOUT_SECS, bashTimeoutSecs } from './bashToolResult'

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

/**
 * ApprovalRequested.args for bash is the literal command. Never JSON-parse it.
 */
export function bashApprovalCommand(args?: string): string | undefined {
  return args
}

/**
 * Tool-call input may be JSON `{command, timeout_secs}`. Read .command only
 * from that object. Do not use this on approval.args.
 */
export function commandFromToolCallInput(args?: string): string | undefined {
  if (args === undefined) return undefined
  try {
    const parsed: unknown = JSON.parse(args)
    if (isCommandObject(parsed)) return parsed.command
  } catch {
    // Raw command stored on an unmatched approval card.
  }
  return args
}

export function bashCommandFromArgs(args?: string): string | undefined {
  return commandFromToolCallInput(args)
}

export function commandFromToolArgs(args?: string): string | undefined {
  return commandFromToolCallInput(args)
}

function isCommandObject(value: unknown): value is { command: string } {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { command?: unknown }).command === 'string'
}

export function timeoutSecsFromToolArgs(args?: string): number | undefined {
  if (!args?.trim()) return undefined
  try {
    const parsed = JSON.parse(args) as { timeout_secs?: unknown; timeoutSecs?: unknown }
    if (!parsed || typeof parsed !== 'object') return undefined
    if (parsed.timeout_secs === undefined && parsed.timeoutSecs === undefined) return undefined
    const literal = jsonFieldLiteral(args, 'timeout_secs') ?? jsonFieldLiteral(args, 'timeoutSecs')
    if (literal !== undefined && !isJsonU64WholeNumberLiteral(literal)) {
      return BASH_DEFAULT_TIMEOUT_SECS
    }
    return bashTimeoutSecs(parsed.timeout_secs ?? parsed.timeoutSecs)
  } catch {
    return undefined
  }
}

/** JSON whole-number token the runner would pass to `as_u64`. */
function isJsonU64WholeNumberLiteral(token: string): boolean {
  return /^(?:0|[1-9]\d*)$/u.test(token)
}

function jsonFieldLiteral(raw: string, key: string): string | undefined {
  const needle = `"${key}"`
  let inString = false
  let escape = false
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch !== '"') continue
    if (!raw.startsWith(needle, i)) {
      inString = true
      continue
    }
    let cursor = i + needle.length
    while (cursor < raw.length && /\s/u.test(raw[cursor] ?? '')) cursor += 1
    if (raw[cursor] === ':') return jsonValueLiteral(raw.slice(cursor + 1))
    inString = true
  }
  return undefined
}

function jsonValueLiteral(raw: string): string | undefined {
  const text = raw.trimStart()
  if (!text) return undefined
  if (text.startsWith('"')) {
    let escape = false
    for (let i = 1; i < text.length; i += 1) {
      const ch = text[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') return text.slice(0, i + 1)
    }
    return text
  }
  if (text.startsWith('true')) return 'true'
  if (text.startsWith('false')) return 'false'
  if (text.startsWith('null')) return 'null'
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(text)?.[0]
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
