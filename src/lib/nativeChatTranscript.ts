import type { AiAction } from '../components/AiMessage'
import type { AiAgentMessage } from './aiAgentConversation'
import type { PrimeSessionSummary } from './primeSessionMeta'
import { nextMessageId } from '../utils/ai-chat'

/** Native session files live under Rhizome's config dir, not `~/.prime`. */
export const NATIVE_SESSION_PREFIX = 'rhizome-native:'

export interface NativeChatListItem {
  sessionId: string
  createdAt: string
  target: string
  title: string
  archived?: boolean
}

export interface NativeChatOpenResult {
  sessionId: string
  events?: unknown[]
  warning?: string | null
  readOnly?: boolean
  error?: string | null
  successorId?: string | null
}

/**
 * ChatHome currently always asks the panel to fork a Prime entry. Native
 * chats have no Prime entry ids, so that path must stay Prime-only.
 */
export function forksPrimeEntry(
  isPrimeTarget: boolean,
  forkTargetsPrimeEntry?: boolean,
): boolean {
  return Boolean(isPrimeTarget && forkTargetsPrimeEntry)
}

/**
 * Copy a native transcript through the chosen turn, ready to show as a new
 * native chat. Streaming flags are cleared: a fork is history, not a live turn.
 */
export function transcriptUntilMessage(
  messages: readonly AiAgentMessage[],
  messageId: string,
): AiAgentMessage[] {
  const index = messages.findIndex((message) => message.id === messageId)
  const kept = index >= 0 ? messages.slice(0, index + 1) : [...messages]
  return kept.map((message) => ({ ...message, isStreaming: false }))
}

export function nativeSessionPath(sessionId: string): string {
  return `${NATIVE_SESSION_PREFIX}${sessionId}`
}

export function isNativeSessionPath(path: string | null | undefined): boolean {
  return typeof path === 'string' && path.startsWith(NATIVE_SESSION_PREFIX)
}

export function nativeChatListItemToSummary(item: NativeChatListItem): PrimeSessionSummary {
  const started = Date.parse(item.createdAt)
  return {
    id: item.sessionId,
    path: nativeSessionPath(item.sessionId),
    title: item.title.trim() || item.target.trim() || null,
    startedAt: item.createdAt,
    mtimeMs: Number.isFinite(started) ? started : null,
    archived: item.archived === true,
    hasConversation: true,
  }
}

export function nativeChatListToSummaries(items: unknown): PrimeSessionSummary[] {
  if (!Array.isArray(items)) return []
  return items
    .filter(isNativeChatListItem)
    .map(nativeChatListItemToSummary)
}

function isNativeChatListItem(value: unknown): value is NativeChatListItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<NativeChatListItem>
  return typeof item.sessionId === 'string' && item.sessionId.length > 0
}

type NativeEventObject = Record<string, { text?: string; id?: string; name?: string; args?: string; output?: string; reason?: string; message?: string; cause?: string } | undefined>

/**
 * Fold a native session log into the panel's turn shape so a restored or
 * archived native chat still shows the transcript it carried.
 */
export function nativeEventsToConversation(events: unknown[] | undefined): AiAgentMessage[] {
  const messages: AiAgentMessage[] = []
  let current: AiAgentMessage | null = null

  const flush = () => {
    if (!current) return
    messages.push({ ...current, isStreaming: false })
    current = null
  }

  for (const event of events ?? []) {
    if (event === 'TurnEnd') {
      flush()
      continue
    }
    if (!event || typeof event !== 'object') continue
    const record = event as NativeEventObject
    if (record.User) {
      flush()
      current = {
        id: nextMessageId(),
        userMessage: String(record.User.text ?? ''),
        actions: [],
      }
      continue
    }
    if (!current) continue
    if (record.Assistant) {
      current = { ...current, response: String(record.Assistant.text ?? '') }
      continue
    }
    if (record.ToolCall) {
      current = {
        ...current,
        actions: [...current.actions, toolAction(record.ToolCall, 'done')],
      }
      continue
    }
    if (record.ToolResult && current.actions.length > 0) {
      const toolId = String(record.ToolResult.id ?? '')
      current = {
        ...current,
        actions: current.actions.map((action) => (
          action.toolId === toolId
            ? { ...action, output: String(record.ToolResult?.output ?? ''), status: 'done' }
            : action
        )),
      }
      continue
    }
    if (record.ToolDenied) {
      current = {
        ...current,
        actions: [...current.actions, toolAction(record.ToolDenied, 'error')],
      }
      continue
    }
    if (record.ModelFailed) {
      current = { ...current, response: String(record.ModelFailed.message ?? '') }
    }
  }
  flush()
  return messages
}

function toolAction(
  payload: { id?: string; name?: string; args?: string; reason?: string } | undefined,
  status: AiAction['status'],
): AiAction {
  const name = payload?.name || 'tool'
  return {
    tool: name,
    toolId: payload?.id || nextMessageId(),
    label: payload?.reason ? `${name} ${payload.reason}` : name,
    status,
    input: payload?.args,
  }
}
