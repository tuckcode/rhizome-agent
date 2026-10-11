export type ChatRunToolStatus = 'pending' | 'done' | 'error'

export interface ChatRunTool {
  id: string
  name: string
  status: ChatRunToolStatus
}

export interface ChatRunSnapshot {
  isActive: boolean
  hasResponse: boolean
  tools: ChatRunTool[]
}

interface ChatRunMessage {
  actions?: Array<{ tool: string; toolId?: string; status: string }>
  response?: string
}

/**
 * Discrete run-status lines for a polite live region. Token streaming stays
 * off this channel — only tool start/finish, completion, and stop.
 */
export function nextChatRunAnnouncement(
  previous: ChatRunSnapshot | null,
  next: ChatRunSnapshot,
): string | null {
  if (!previous) return null

  if (previous.isActive && !next.isActive) {
    return next.hasResponse ? 'Response complete' : 'Stopped'
  }

  for (const tool of next.tools) {
    const before = previous.tools.find((item) => item.id === tool.id)
    if (before && before.status !== 'done' && tool.status === 'done') {
      return `${tool.name} done`
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
  const latest = [...messages].reverse().find((message) => (
    (message.actions?.length ?? 0) > 0 || Boolean(message.response?.trim())
  )) ?? messages.at(-1)

  return {
    isActive,
    hasResponse: Boolean(latest?.response?.trim()),
    tools: (latest?.actions ?? []).map((action) => ({
      id: action.toolId || action.tool,
      name: action.tool,
      status: action.status as ChatRunToolStatus,
    })),
  }
}
