export type ChatRunToolStatus = 'pending' | 'done' | 'error'

export interface ChatRunTool {
  id: string
  name: string
  status: ChatRunToolStatus
  needsApproval?: boolean
}

export interface ChatRunSnapshot {
  isActive: boolean
  hasResponse: boolean
  tools: ChatRunTool[]
  notice?: string
  noticeId?: string
}

interface ChatRunMessage {
  id?: string
  actions?: Array<{ tool: string; toolId?: string; status: string; approval?: unknown }>
  response?: string
  localMarker?: string
  localMarkerTone?: 'warning'
}

/**
 * Join two live-status lines. A trailing period, question mark, or
 * exclamation on the first line is kept; otherwise a period is added
 * so "Running get_note" and "get_note done" do not run together.
 */
export function joinChatRunLines(pending: string, next: string): string {
  const left = pending.trimEnd()
  const sep = /[.!?]$/.test(left) ? ' ' : '. '
  return `${left}${sep}${next}`
}

/**
 * Discrete run-status lines for a polite live region. Token streaming stays
 * off this channel — only tool start/finish, completion, stop, and a
 * non-fatal warning notice.
 */
export function nextChatRunAnnouncement(
  previous: ChatRunSnapshot | null,
  next: ChatRunSnapshot,
): string | null {
  if (!previous) return null

  const lines: string[] = []
  if (next.notice && next.noticeId && next.noticeId !== previous.noticeId) {
    lines.push(next.notice)
  }
  if (previous.isActive && !next.isActive) {
    lines.push(next.hasResponse ? 'Response complete' : 'Stopped')
  }
  if (lines.length > 0) {
    return lines.join(' ')
  }

  for (const tool of next.tools) {
    const before = previous.tools.find((item) => item.id === tool.id)
    if (before && before.status !== 'error' && tool.status === 'error') {
      return `${tool.name} failed`
    }
  }

  for (const tool of next.tools) {
    const before = previous.tools.find((item) => item.id === tool.id)
    if (before && before.status !== 'done' && tool.status === 'done') {
      return `${tool.name} done`
    }
  }

  for (const tool of next.tools) {
    const before = previous.tools.find((item) => item.id === tool.id)
    if (!before && tool.status === 'pending' && tool.needsApproval) {
      return `Needs approval for ${tool.name}`
    }
  }

  for (const tool of next.tools) {
    const before = previous.tools.find((item) => item.id === tool.id)
    if (!before && tool.status === 'pending') {
      return `Running ${tool.name}`
    }
  }

  return null
}

export function chatRunSnapshotFromMessages(
  messages: ChatRunMessage[],
  isActive: boolean,
): ChatRunSnapshot {
  const latestTurn = [...messages].reverse().find((message) => !message.localMarker)
  const warning = [...messages]
    .reverse()
    .find((message) => message.localMarkerTone === 'warning' && message.localMarker)

  return {
    isActive,
    hasResponse: Boolean(latestTurn?.response?.trim()),
    tools: (latestTurn?.actions ?? []).map((action) => ({
      id: action.toolId || action.tool,
      name: action.tool,
      status: action.status as ChatRunToolStatus,
      needsApproval: Boolean(action.approval),
    })),
    notice: warning?.localMarker,
    noticeId: warning?.id,
  }
}
