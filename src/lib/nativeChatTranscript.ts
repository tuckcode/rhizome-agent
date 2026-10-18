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
  images?: Array<Array<{ mimeType?: string; data?: string }>>
  /** Model stored on the session log. */
  target?: string
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

/** Forked pending tools land as a denial so the new session is paired. */
export const CANCELLED_NATIVE_TOOL_REASON = 'cancelled'

const liveNativeBySlot = new Map<string, LiveNativeChat>()
const liveNativeRetain = new Map<string, number>()
let nextNativeLivePanel = 0

export interface PersistNativeForkRequest {
  messages: readonly AiAgentMessage[]
  messageId: string
  target: string
  vaultPath?: string | null
  vaultPaths?: string[]
  permissionMode?: AiAgentPermissionMode
  systemPrompt?: string | null
  sourceSessionId?: string | null
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
  if (index < 0) {
    throw new Error(`Unknown native chat message id: ${messageId}`)
  }
  return messages.slice(0, index + 1).map((message) => ({ ...message, isStreaming: false }))
}

/**
 * Fold panel turns into the durable log shape so a fork can be written and
 * later reopened with the same history.
 *
 * Order matches a live native turn: assistant text that arrived before a
 * tool round stays in front of that ToolCall, each call is followed by its
 * ToolResult or ToolDenied, and leftover assistant text comes after those
 * rounds. Live `response` may still hold the full accumulator, so prefixes
 * already emitted as `beforeText` are stripped from that leftover. Pending
 * and errored tools still get a paired result so OpenAI-style providers do
 * not see an unpaired tool_call id.
 */
export function conversationToNativeEvents(
  messages: readonly AiAgentMessage[],
): NativeDurableEvent[] {
  const events: NativeDurableEvent[] = []
  for (const message of messages) {
    if (message.localMarker) continue
    events.push({ User: { text: message.userMessage } })
    for (const action of message.actions) {
      if (action.beforeText) {
        events.push({ Assistant: { text: action.beforeText } })
      }
      const id = action.toolId || nextMessageId()
      const name = action.tool || 'tool'
      events.push({ ToolCall: { id, name, args: action.input ?? '' } })
      if (action.status === 'done') {
        events.push({ ToolResult: { id, name, output: action.output ?? '' } })
        continue
      }
      events.push({
        ToolDenied: {
          id,
          name,
          reason: action.status === 'error'
            ? (action.output || action.label || name)
            : CANCELLED_NATIVE_TOOL_REASON,
        },
      })
    }
    const leftover = leftoverAssistantAfterBeforeText(message.response ?? '', message.actions)
    if (leftover.trim()) {
      events.push({ Assistant: { text: leftover } })
    }
    events.push('TurnEnd')
  }
  return events
}

/** Drop already-emitted round text from a live full-accumulator response. */
function leftoverAssistantAfterBeforeText(
  response: string,
  actions: readonly AiAction[],
): string {
  let offset = 0
  for (const action of actions) {
    const before = action.beforeText
    if (!before) continue
    while (offset < response.length && /\s/u.test(response[offset] ?? '')) {
      offset += 1
    }
    if (!response.startsWith(before, offset)) continue
    offset += before.length
  }
  return response.slice(offset)
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
      sourceSessionId: request.sourceSessionId ?? null,
    },
  })
  trackEvent('chat_native_forked', { engine: 'native' })
  return sessionId
}

/** One slot per Chat panel, or per workspace conversation id. */
export function createNativeLiveSlot(sessionKey?: string | null): string {
  if (sessionKey) return `session:${sessionKey}`
  nextNativeLivePanel += 1
  return `panel:${nextNativeLivePanel}`
}

export function rememberNativeSession(
  slot: string,
  sessionId: string | null,
  readOnly = false,
): void {
  if (!sessionId) {
    liveNativeBySlot.delete(slot)
    return
  }
  liveNativeBySlot.set(slot, { sessionId, readOnly })
}

export function currentNativeSession(slot: string): LiveNativeChat {
  return liveNativeBySlot.get(slot) ?? { sessionId: null, readOnly: false }
}

export function retainNativeLiveSlot(slot: string): void {
  liveNativeRetain.set(slot, (liveNativeRetain.get(slot) ?? 0) + 1)
}

/** Drop the slot when the last Chat panel or workspace session using it closes. */
export function releaseNativeLiveSlot(slot: string): void {
  const next = (liveNativeRetain.get(slot) ?? 0) - 1
  if (next > 0) {
    liveNativeRetain.set(slot, next)
    return
  }
  liveNativeRetain.delete(slot)
  liveNativeBySlot.delete(slot)
}

export function countNativeLiveSlots(): number {
  return liveNativeBySlot.size
}

export function resetNativeLiveSessions(): void {
  liveNativeBySlot.clear()
  liveNativeRetain.clear()
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
export function nativeEventsToConversation(
  events: unknown[] | undefined,
  images?: Array<Array<{ mimeType?: string; data?: string }>>,
): AiAgentMessage[] {
  const messages: AiAgentMessage[] = []
  let current: AiAgentMessage | null = null
  let pendingAssistant = ''

  const flush = () => {
    if (!current) return
    if (pendingAssistant) {
      current = { ...current, response: pendingAssistant }
      pendingAssistant = ''
    }
    messages.push({ ...current, isStreaming: false })
    current = null
  }

  let userIndex = 0
  for (const event of events ?? []) {
    if (event === 'TurnEnd') {
      flush()
      continue
    }
    if (!event || typeof event !== 'object') continue
    const record = event as NativeEventObject
    if (record.User) {
      flush()
      const turnImages = images?.[userIndex] ?? []
      userIndex += 1
      current = {
        id: nextMessageId(),
        userMessage: String(record.User.text ?? ''),
        actions: [],
        images: turnImages
          .filter((image) => image.data && image.mimeType)
          .map((image) => ({
            type: 'image' as const,
            data: String(image.data),
            mimeType: String(image.mimeType),
          })),
      }
      continue
    }
    if (!current) continue
    if (record.Assistant) {
      pendingAssistant = String(record.Assistant.text ?? '')
      continue
    }
    if (record.ToolCall) {
      current = {
        ...current,
        actions: [...current.actions, toolAction(record.ToolCall, 'pending', pendingAssistant)],
      }
      pendingAssistant = ''
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
      const toolId = String(record.ToolDenied.id ?? '')
      const reason = String(record.ToolDenied.reason ?? '')
      const existing = current.actions.some((action) => action.toolId === toolId)
      current = {
        ...current,
        actions: existing
          ? current.actions.map((action) => (
            action.toolId === toolId
              ? { ...action, output: reason, status: 'error' as const }
              : action
          ))
          : [...current.actions, toolAction(record.ToolDenied, 'error')],
      }
      continue
    }
    if (record.ModelFailed) {
      const failure = String(record.ModelFailed.message ?? '')
      pendingAssistant = pendingAssistant
        ? `${pendingAssistant}\n\nError: ${failure}`
        : failure
    }
  }
  flush()
  return messages
}

function toolAction(
  payload: { id?: string; name?: string; args?: string; reason?: string } | undefined,
  status: AiAction['status'],
  beforeText?: string,
): AiAction {
  const name = payload?.name || 'tool'
  return {
    tool: name,
    toolId: payload?.id || nextMessageId(),
    label: payload?.reason ? `${name} ${payload.reason}` : name,
    status,
    input: payload?.args,
    ...(beforeText ? { beforeText } : {}),
  }
}
