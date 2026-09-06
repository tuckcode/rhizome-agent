import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { appendLocalMarker, type AgentStatus, type AiAgentMessage } from './aiAgentConversation'
import { detectFileOperation, type AgentFileCallbacks } from './aiAgentFileOperations'
import {
  markReasoningDone,
  updateMessage,
  updateToolAction,
  type ToolInvocation,
} from './aiAgentMessageState'
import { getAiAgentDefinition, type AiAgentId } from './aiAgents'
import {
  trackAiAgentResponseCompleted,
  trackAiAgentResponseFailed,
  trackVaultCredentialsHandled,
} from './productAnalytics'
import { translate, type AppLocale } from './i18n'
import { localizedStreamErrorMessage } from './localizedStreamError'
import {
  isSessionAutoDistillEnabled,
  queueSessionAutoDistill,
} from '../utils/sessionAutoDistill'

const MAX_RETAINED_TOOL_OUTPUT_CHARS = 20_000
const ASCII_WORD_RE = /^[A-Za-z0-9_]$/u
const SENTENCE_START_RE = /^[A-ZÀ-ÖØ-Þ]$/u

type AssistantResponseText = string
type StreamErrorMessage = string
type ToolInvocationId = string
type ToolOutputText = string

interface ToolOutputInspection {
  output?: ToolOutputText
}

function normalizeAssistantResponseText(response: AssistantResponseText): AssistantResponseText {
  let normalized = ''

  for (let index = 0; index < response.length; index += 1) {
    normalized += response[index]

    if (needsSpaceAfterSentencePunctuation(response, index) || needsSpaceAfterWikilink(response, index)) {
      normalized += ' '
    }
  }

  return normalized
}

function needsSpaceAfterSentencePunctuation(response: AssistantResponseText, index: number): boolean {
  const char = response[index]
  if (char !== '.' && char !== '!' && char !== '?') return false
  if (isSingleLetterInitialBeforePunctuation(response, index)) return false

  return startsSentenceOrWikilink(response, index + 1)
}

function startsSentenceOrWikilink(response: AssistantResponseText, index: number): boolean {
  return startsWikilink(response, index) || SENTENCE_START_RE.test(response[index] ?? '')
}

function startsWikilink(response: AssistantResponseText, index: number): boolean {
  return response[index] === '[' && response[index + 1] === '['
}

function isSingleLetterInitialBeforePunctuation(response: AssistantResponseText, punctuationIndex: number): boolean {
  const initialIndex = punctuationIndex - 1
  if (!SENTENCE_START_RE.test(response[initialIndex] ?? '')) return false

  const previousChar = response[initialIndex - 1]
  return previousChar === undefined || !ASCII_WORD_RE.test(previousChar)
}

function needsSpaceAfterWikilink(response: AssistantResponseText, index: number): boolean {
  return response[index - 1] === ']' && response[index] === ']' && SENTENCE_START_RE.test(response[index + 1] ?? '')
}

export interface StreamMutationContext {
  agent: AiAgentId
  locale?: AppLocale
  messageId: string
  vaultPath: string
  /** User text for this turn — used by session auto-distill. */
  userMessage?: string
  /** Explicit true opts in. Unset/false skips (product default OFF). */
  sessionAutoDistillEnabled?: boolean
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>
  setStatus: Dispatch<SetStateAction<AgentStatus>>
  abortRef: MutableRefObject<{ aborted: boolean }>
  responseAccRef: MutableRefObject<string>
  toolInputMapRef: MutableRefObject<Map<string, ToolInvocation>>
  fileCallbacksRef: MutableRefObject<AgentFileCallbacks | undefined>
}

function finalResponseText(response: AssistantResponseText, agent: AiAgentId): AssistantResponseText {
  if (response.trim()) return normalizeAssistantResponseText(response)

  if (agent === 'opencode') {
    return [
      'OpenCode returned no assistant text.',
      'Check the selected provider/model context limit or retry the request.',
      'For large active notes, Rhizome sends a compact note snapshot and OpenCode can read the full file with get_note(path).',
    ].join(' ')
  }

  return `${getAiAgentDefinition(agent).label} finished without returning a reply.`
}

function retainedToolOutput({ output }: ToolOutputInspection): ToolOutputText | undefined {
  if (!output || output.length <= MAX_RETAINED_TOOL_OUTPUT_CHARS) return output

  const omitted = output.length - MAX_RETAINED_TOOL_OUTPUT_CHARS
  return [
    output.slice(0, MAX_RETAINED_TOOL_OUTPUT_CHARS),
    `[Tool output truncated: ${omitted} chars omitted]`,
  ].join('\n\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toolOutputIndicatesFailure({ output }: ToolOutputInspection): boolean {
  const trimmed = output?.trim()
  if (!trimmed) return false
  if (/^Error:/iu.test(trimmed)) return true

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return false
  }
  if (!parsed) return false
  if (!isRecord(parsed)) return false

  const error = parsed.error
  return parsed.isError === true || typeof error === 'string' || isRecord(error)
}

function sealPendingActions(message: AiAgentMessage): AiAgentMessage['actions'] {
  return message.actions.map((action) => (
    action.status === 'pending' ? { ...action, status: 'done' as const } : action
  ))
}

function findQueuedFollowUpId(
  messages: AiAgentMessage[],
  sealedMessageId: string,
): string | undefined {
  const sealedIndex = messages.findIndex((message) => message.id === sealedMessageId)
  const searchFrom = sealedIndex >= 0 ? sealedIndex + 1 : 0
  return messages.slice(searchFrom).find((message) => (
    !message.localMarker
    && !!message.userMessage.trim()
    && !message.response
    && (message.queuedFollowUp || !message.isStreaming)
  ))?.id
}

export function createStreamCallbacks(context: StreamMutationContext) {
  const {
    messageId,
    agent,
    locale = 'en',
    vaultPath,
    userMessage = '',
    sessionAutoDistillEnabled,
    setMessages,
    setStatus,
    abortRef,
    responseAccRef,
    toolInputMapRef,
    fileCallbacksRef,
  } = context
  let failureTracked = false
  let streamFailed = false
  // Retargeted after each Prime TurnBoundary so a queued follow-up owns its
  // own bubble instead of merging into the first turn's reply.
  let activeMessageId = messageId
  let sealedByTurnBoundary = false

  function sealActiveTurn(): void {
    const sealedText = finalResponseText(responseAccRef.current, agent)
    const rawResponse = responseAccRef.current
    const toolCount = toolInputMapRef.current.size
    const toolNames = Array.from(toolInputMapRef.current.values()).map((t) => t.tool)
    trackAiAgentResponseCompleted(agent, rawResponse, toolCount, failureTracked)
    const sealedId = activeMessageId
    const retarget: { id?: string; userMessage?: string } = {}

    setMessages((current) => {
      const prior = current.find((message) => message.id === sealedId)
      retarget.userMessage = prior?.userMessage
      const sealed = current.map((message) => (
        message.id === sealedId
          ? {
              ...message,
              isStreaming: false,
              reasoningDone: true,
              response: sealedText,
              actions: sealPendingActions(message),
            }
          : message
      ))
      retarget.id = findQueuedFollowUpId(sealed, sealedId)
      if (!retarget.id) return sealed
      return sealed.map((message) => (
        message.id === retarget.id
          ? {
              ...message,
              isStreaming: true,
              queuedFollowUp: undefined,
            }
          : message
      ))
    })

    if (isSessionAutoDistillEnabled(sessionAutoDistillEnabled)) {
      void queueSessionAutoDistill({
        vaultPath,
        userMessage: retarget.userMessage ?? userMessage,
        assistantResponse: sealedText,
        toolNames,
      }).then((result) => {
        if (!result.queued || result.redactedCount <= 0) return
        trackVaultCredentialsHandled('auto_distill', 'redact', result.redactedCount)
        appendLocalMarker(
          setMessages,
          translate(locale, 'ai.marker.credentialsRedactedDistill', {
            count: result.redactedCount,
            plural: result.redactedCount === 1 ? '' : 's',
          }),
        )
      }).catch(() => {
        // best-effort — never block the chat UI on distill failures
      })
    }

    responseAccRef.current = ''
    toolInputMapRef.current = new Map()
    failureTracked = false
    if (retarget.id) {
      activeMessageId = retarget.id
    }
    sealedByTurnBoundary = true
  }

  return {
    onThinking: (chunk: string) => {
      if (abortRef.current.aborted) return
      sealedByTurnBoundary = false
      updateMessage(setMessages, activeMessageId, (message) => ({
        ...message,
        reasoning: (message.reasoning ?? '') + chunk,
      }))
    },

    onText: (chunk: string) => {
      if (abortRef.current.aborted) return
      sealedByTurnBoundary = false
      markReasoningDone(setMessages, activeMessageId)
      responseAccRef.current += chunk
    },

    onToolStart: (toolName: string, toolId: string, input?: string) => {
      if (abortRef.current.aborted) return
      sealedByTurnBoundary = false

      markReasoningDone(setMessages, activeMessageId)
      setStatus('tool-executing')

      const previous = toolInputMapRef.current.get(toolId)
      toolInputMapRef.current.set(toolId, { tool: toolName, input: input ?? previous?.input })

      updateMessage(setMessages, activeMessageId, (message) => updateToolAction(message, toolName, toolId, input))
    },

    onToolDone: (toolId: ToolInvocationId, output?: ToolOutputText) => {
      if (abortRef.current.aborted) return

      const info = toolInputMapRef.current.get(toolId)
      const toolOutput = { output }
      const failed = toolOutputIndicatesFailure(toolOutput)
      if (info && !failed) {
        detectFileOperation({
          toolName: info.tool,
          input: info.input,
          vaultPath,
          callbacks: fileCallbacksRef.current,
        })
      }

      updateMessage(setMessages, activeMessageId, (message) => ({
        ...message,
        actions: message.actions.map((action) => (
          action.toolId === toolId
            ? { ...action, status: failed ? 'error' as const : 'done' as const, output: retainedToolOutput(toolOutput) }
            : action
        )),
      }))
    },

    onError: (error: StreamErrorMessage) => {
      if (abortRef.current.aborted) return

      setStatus('error')
      streamFailed = true
      const displayError = localizedStreamErrorMessage({ message: error, locale })
      const partial = normalizeAssistantResponseText(responseAccRef.current)
      failureTracked = true
      trackAiAgentResponseFailed(agent, partial, toolInputMapRef.current.size)
      updateMessage(setMessages, activeMessageId, (message) => ({
        ...message,
        isStreaming: false,
        reasoningDone: true,
        response: partial ? `${partial}\n\nError: ${displayError}` : `Error: ${displayError}`,
        actions: message.actions.map((action) => (
          action.status === 'pending' ? { ...action, status: 'error' as const } : action
        )),
        queuedFollowUp: undefined,
      }))
    },

    onTurnBoundary: () => {
      if (abortRef.current.aborted) return
      if (streamFailed) return
      sealActiveTurn()
      // Stay in thinking — a follow-up turn may still be streaming.
      setStatus('thinking')
    },

    onDone: () => {
      if (abortRef.current.aborted) return
      if (streamFailed) return

      setStatus('done')
      // TurnBoundary already sealed the last agent_end and cleared the
      // accumulator. Do not invent "finished without returning a reply".
      if (sealedByTurnBoundary && !responseAccRef.current.trim()) {
        updateMessage(setMessages, activeMessageId, (message) => ({
          ...message,
          isStreaming: false,
          reasoningDone: true,
          queuedFollowUp: undefined,
          actions: sealPendingActions(message),
        }))
        fileCallbacksRef.current?.onVaultChanged?.()
        return
      }

      const finalResponse = finalResponseText(responseAccRef.current, agent)
      trackAiAgentResponseCompleted(agent, responseAccRef.current, toolInputMapRef.current.size, failureTracked)
      updateMessage(setMessages, activeMessageId, (message) => ({
        ...message,
        isStreaming: false,
        reasoningDone: true,
        response: finalResponse,
        queuedFollowUp: undefined,
        actions: sealPendingActions(message),
      }))
      fileCallbacksRef.current?.onVaultChanged?.()

      if (isSessionAutoDistillEnabled(sessionAutoDistillEnabled)) {
        const toolNames = Array.from(toolInputMapRef.current.values()).map((t) => t.tool)
        void queueSessionAutoDistill({
          vaultPath,
          userMessage,
          assistantResponse: finalResponse,
          toolNames,
        }).then((result) => {
          if (!result.queued || result.redactedCount <= 0) return
          trackVaultCredentialsHandled('auto_distill', 'redact', result.redactedCount)
          appendLocalMarker(
            setMessages,
            translate(locale, 'ai.marker.credentialsRedactedDistill', {
              count: result.redactedCount,
              plural: result.redactedCount === 1 ? '' : 's',
            }),
          )
        }).catch(() => {
          // best-effort — never block the chat UI on distill failures
        })
      }
    },
  }
}
