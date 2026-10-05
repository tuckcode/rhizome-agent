import type { PrimeImageContent } from './composerAttachments'
import type { Dispatch, SetStateAction } from 'react'
import type { AiAction } from '../components/AiMessage'
import { buildAgentSystemPrompt } from '../utils/ai-agent'
import {
  MAX_HISTORY_TOKENS,
  formatMessageWithHistory,
  nextMessageId,
  trimHistory,
  type ChatMessage,
} from '../utils/ai-chat'
import { formatPromptWithReferences, type NoteReference } from '../utils/ai-context'
import type { AiAgentId } from './aiAgents'
import { getAiAgentDefinition } from './aiAgents'
import type { AiAgentPermissionMode } from './aiAgentPermissionMode'
import type { AiTarget } from './aiTargets'
import type { AppLocale } from './i18n'

export interface AiAgentMessage {
  userMessage: string
  references?: NoteReference[]
  localMarker?: string
  reasoning?: string
  reasoningDone?: boolean
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  id?: string
  /**
   * Prime's entry id for this turn, when it came from a session log.
   *
   * Only replayed turns have one: the live stream carries no entry ids
   * (`agent_end` reports role/content/model/usage and no `id`), they exist
   * solely on the log envelope. `fork` addresses entries by this, so its
   * presence is what makes forking possible at all.
   */
  primeEntryId?: string
  /**
   * Optimistic mid-turn follow-up waiting for its own reply bubble.
   * Cleared when the stream retargets onto this message after `TurnBoundary`.
   */
  queuedFollowUp?: boolean
  /** When the user turn was created (ms since epoch). Shown as a clock on the bubble. */
  createdAtMs?: number
  /**
   * Images on this user turn. Absent for a text-only message.
   * The bubble reads this to show a thumbnail.
   */
  images?: PrimeImageContent[]
  /**
   * Index of the user item in the Prime transcript this turn came from.
   * Search hits use this to open the session at that point (#23).
   */
  transcriptUserIndex?: number
  /**
   * Index of the last assistant item folded into this turn.
   * Search hits use this to open the session at that point (#23).
   */
  transcriptAssistantIndex?: number
}

export type AgentStatus = 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'

export interface AgentExecutionContext {
  agent: AiAgentId
  target?: AiTarget
  locale?: AppLocale
  ready: boolean
  vaultPath: string
  vaultPaths?: string[]
  agentDocsPath?: string
  permissionMode: AiAgentPermissionMode
  systemPromptOverride?: string
  /** Post-turn wiki auto-distill. Default ON when unset. */
  sessionAutoDistillEnabled?: boolean
}

export interface PendingUserPrompt {
  text: string
  references?: NoteReference[]
  /**
   * Images attached to this turn, already in Prime's `ImageContent` shape.
   * Absent for every text-only message.
   */
  images?: PrimeImageContent[]
}

function toChatHistory(messages: AiAgentMessage[]): ChatMessage[] {
  return messages.filter((message) => !message.localMarker).flatMap((message) => {
    const history: ChatMessage[] = [{ role: 'user', content: message.userMessage, id: message.id ?? '' }]
    if (message.response) {
      history.push({ role: 'assistant', content: message.response, id: `${message.id}-resp` })
    }
    return history
  })
}

export function appendLocalMarker(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  text: string,
): void {
  setMessages((current) => [
    ...current,
    {
      userMessage: '',
      localMarker: text,
      actions: [],
      id: nextMessageId(),
    },
  ])
}

export function createMissingAgentResponse(agent: AiAgentId): string {
  const definition = getAiAgentDefinition(agent)
  if (agent === 'prime') {
    return `${definition.label} is not available on this machine. Install it with \`npm i -g prime-agent\`, run \`prime-agent\` once to log in, then retry.`
  }
  return `${definition.label} is not available on this machine. Install it or switch the default AI agent in Settings.`
}

export function appendLocalResponse(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  prompt: PendingUserPrompt,
  response: string,
): void {
  setMessages((current) => [
    ...current,
    {
      userMessage: prompt.text,
      references: prompt.references,
      ...(prompt.images && prompt.images.length > 0 ? { images: prompt.images } : {}),
      actions: [],
      response,
      id: nextMessageId(),
      createdAtMs: Date.now(),
    },
  ])
}

export function appendQueuedFollowUpMessage(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  text: string,
): string {
  const trimmed = text.trim()
  const messageId = nextMessageId()
  if (!trimmed) return messageId

  setMessages((current) => {
    // Same interrupt already on screen — do not duplicate when queue poll
    // and the send-policy append both see it.
    const already = current.some((message) => (
      !message.localMarker
      && message.userMessage.trim() === trimmed
      && (message.queuedFollowUp || (!message.response && !message.isStreaming))
    ))
    if (already) return current

    return [
      ...current,
      {
        userMessage: trimmed,
        actions: [],
        id: messageId,
        queuedFollowUp: true,
        createdAtMs: Date.now(),
        // Not streaming yet — the reply arrives when Prime drains the queue.
        // Keeping this visible is what makes "Waiting in this session" match
        // the transcript instead of vanishing into a reply-only first bubble.
      },
    ]
  })
  return messageId
}

/**
 * Mirror Prime's follow-up queue into the transcript.
 *
 * The send path also appends on accept, but Chat can lose that bubble when a
 * mid-turn rehydrate/`replaceMessages` races the live stream. `get_queue` is
 * the daemon's source of truth for what is still waiting — keep those lines
 * on screen until their own reply owns them.
 */
export function ensureQueuedFollowUpsInTranscript(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  followUps: string[],
): void {
  for (const text of followUps) {
    appendQueuedFollowUpMessage(setMessages, text)
  }
}

export function appendStreamingMessage(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  prompt: PendingUserPrompt,
): string {
  const messageId = nextMessageId()
  setMessages((current) => [
    ...current,
    {
      userMessage: prompt.text,
      references: prompt.references,
      ...(prompt.images && prompt.images.length > 0 ? { images: prompt.images } : {}),
      actions: [],
      isStreaming: true,
      id: messageId,
      createdAtMs: Date.now(),
    },
  ])
  return messageId
}

export function buildFormattedMessage(
  context: AgentExecutionContext,
  messages: AiAgentMessage[],
  prompt: PendingUserPrompt,
): { formattedMessage: string; systemPrompt: string } {
  const systemPrompt = buildAgentSystemPrompt({
    agent: context.agent,
    agentDocsPath: context.agentDocsPath,
    permissionMode: context.permissionMode,
    vaultPaths: context.vaultPaths,
    vaultContext: context.systemPromptOverride,
  })
  const chatHistory = toChatHistory(messages.filter((message) => !message.isStreaming))
  const trimmedHistory = trimHistory(chatHistory, MAX_HISTORY_TOKENS)
  const promptText = formatPromptWithReferences(prompt.text, prompt.references)

  return {
    formattedMessage: formatMessageWithHistory(trimmedHistory, promptText),
    systemPrompt,
  }
}
