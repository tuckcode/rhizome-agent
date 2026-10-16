import type { AiAction } from '../components/AiMessage'
import type { AiAgentMessage } from './aiAgentConversation'
import type { AiAgentPermissionMode } from './aiAgentPermissionMode'
import type { PrimeSessionSummary } from './primeSessionMeta'
import { callHost } from './callHost'
import { trackEvent } from './telemetry'
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

export type NativeDurableEvent =
  | { User: { text: string } }
  | { Assistant: { text: string } }
  | { ToolCall: { id: string; name: string; args: string } }
  | { ToolResult: { id: string; name: string; output: string } }
  | { ToolDenied: { id: string; name: string; reason: string } }
  | { ModelFailed: { message: string } }
  | { Cancelled: { cause: string } }
  | 'TurnEnd'

export interface LiveNativeChat {
  sessionId: string | null
  readOnly: boolean
}

export interface PersistNativeForkRequest {
  messages: readonly AiAgentMessage[]
  messageId: string
  target: string
  vaultPath?: string | null
  vaultPaths?: string[]
  permissionMode?: AiAgentPermissionMode
  systemPrompt?: string | null
}

let liveNativeChat: LiveNativeChat = { sessionId: null, readOnly: false }

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
  if (index < 0) {
    throw new Error(`Unknown native chat message id: ${messageId}`)
  }
  return messages.slice(0, index + 1).map((message) => ({ ...message, isStreaming: false }))
}

/**
 * Fold panel turns into the durable log shape so a fork can be written and
 * later reopened with the same history.
 */
export function conversationToNativeEvents(
  messages: readonly AiAgentMessage[],
): NativeDurableEvent[] {
  const events: NativeDurableEvent[] = []
  for (const message of messages) {
    if (message.localMarker) continue
    events.push({ User: { text: message.userMessage } })
    if (message.response) {
      events.push({ Assistant: { text: message.response } })
    }
    for (const action of message.actions) {
      const id = action.toolId || nextMessageId()
      const name = action.tool || 'tool'
      if (action.status === 'error') {
        events.push({
          ToolDenied: { id, name, reason: action.output || action.label || name },
        })
        continue
      }
      events.push({ ToolCall: { id, name, args: action.input ?? '' } })
      if (action.status === 'done') {
        events.push({ ToolResult: { id, name, output: action.output ?? '' } })
      }
    }
    events.push('TurnEnd')
  }
  return events
}

/**
 * Write the kept turns as a new native session. A fork of an archived chat
 * is still a new id, so it lands unarchived.
 */
export async function persistNativeFork(request: PersistNativeForkRequest): Promise<string> {
  const kept = transcriptUntilMessage(request.messages, request.messageId)
  const events = conversationToNativeEvents(kept)
  const sessionId = await callHost<string>('native_chat_fork', {
    request: {
      events,
      target: request.target,
      systemPrompt: request.systemPrompt ?? null,
      vaultPath: request.vaultPath ?? null,
      vaultPaths: request.vaultPaths ?? [],
      permissionMode: request.permissionMode ?? 'safe',
    },
  })
  trackEvent('chat_native_forked', { engine: 'native' })
  return sessionId
}

export function rememberNativeSession(sessionId: string | null, readOnly = false): void {
  liveNativeChat = { sessionId, readOnly }
}

export function currentNativeSession(): LiveNativeChat {
  return liveNativeChat
}

export function nativeSessionPath(sessionId: string): string {
  return `${NATIVE_SESSION_PREFIX}${sessionId}`
}

export function isNativeSessionPath(path: string | null | undefined): boolean {
  return typeof path === 'string' && path.startsWith(NATIVE_SESSION_PREFIX)
}

export function nativeSessionIdFromPath(path: string | null | undefined): string | null {
  if (!isNativeSessionPath(path) || !path) return null
  const sessionId = path.slice(NATIVE_SESSION_PREFIX.length)
  return sessionId.length > 0 ? sessionId : null
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
        actions: [...current.actions, toolAction(record.ToolCall, 'pending')],
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
