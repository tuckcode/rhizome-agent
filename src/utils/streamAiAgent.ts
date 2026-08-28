import type { PrimeImageContent } from '../lib/composerAttachments'
import { isTauri } from '../mock-tauri'
import { getAiAgentDefinition, type AiAgentId } from '../lib/aiAgents'
import {
  normalizeAiAgentPermissionMode,
  type AiAgentPermissionMode,
} from '../lib/aiAgentPermissionMode'
import { createScopedStreamEventName } from './aiStreamEvents'
import { cleanupTauriEventListener } from './tauriEventCleanup'

type AiAgentStreamEvent =
  | { kind: 'Init'; session_id: string }
  | { kind: 'TextDelta'; text: string }
  | { kind: 'ThinkingDelta'; text: string }
  | { kind: 'ToolStart'; tool_name: string; tool_id: string; input?: string }
  | { kind: 'ToolDone'; tool_id: string; output?: string }
  | { kind: 'Error'; message: string }
  | { kind: 'QueueUpdate'; queued: number }
  | { kind: 'Compaction'; phase: string; reason?: string; tokens_before?: number }
  | { kind: 'Done' }

export interface AgentStreamCallbacks {
  onText: (text: string) => void
  onThinking: (text: string) => void
  onToolStart: (toolName: string, toolId: string, input?: string) => void
  onToolDone: (toolId: string, output?: string) => void
  onError: (message: string) => void
  /** Context compaction. Optional so existing callers are unaffected. */
  onCompaction?: (phase: string, reason?: string, tokensBefore?: number) => void
  /** Steering/follow-up queue depth changed. Optional. */
  onQueueUpdate?: (queued: number) => void
  onDone: () => void
}

export interface StreamAiAgentRequest {
  agent: AiAgentId
  message: string
  systemPrompt?: string
  vaultPath: string
  vaultPaths?: string[]
  permissionMode?: AiAgentPermissionMode
  /** Prime only. Absent or empty for a text-only turn. */
  images?: PrimeImageContent[]
  callbacks: AgentStreamCallbacks
  signal?: AbortSignal
}

const CONVERSATION_HISTORY_OPEN_MARKER = ['<', 'conversation_history', '>'].join('')

/**
 * Ask the mock agent for a turn that produces no assistant text.
 *
 * The empty-turn path — stream ends with nothing, `finalResponseText`
 * substitutes a placeholder, and the transcript shows "… finished without
 * returning a reply" — was unreachable in mock mode, so nothing could test
 * what the UI does with it. That is how C51 shipped: promote treated the
 * placeholder as the reply and wrote it to the vault. This seam makes the
 * path drivable from Playwright.
 */
export const MOCK_EMPTY_REPLY_PROMPT = '__mock_empty_reply__'

function mockAgentResponse(agent: AiAgentId, message: string): string {
  const agentLabel = getAiAgentDefinition(agent).label
  if (message.trim() === MOCK_EMPTY_REPLY_PROMPT) return ''
  if (message.indexOf(CONVERSATION_HISTORY_OPEN_MARKER) >= 0) {
    const allUserLines = message.match(/\[user\]: .+/g) ?? []
    const turnCount = allUserLines.length
    const lastLine = allUserLines.at(-1) ?? ''
    const lastUserMsg = lastLine.replace('[user]: ', '')
    return `[mock-${agentLabel.toLowerCase()} turns=${turnCount}] You asked: "${lastUserMsg}" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`
  }
  return `[mock-${agentLabel.toLowerCase()}] You said: "${message}" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`
}

function handleStreamEvent(data: AiAgentStreamEvent, callbacks: AgentStreamCallbacks): void {
  switch (data.kind) {
    case 'TextDelta':
      callbacks.onText(data.text)
      return
    case 'ThinkingDelta':
      callbacks.onThinking(data.text)
      return
    case 'ToolStart':
      callbacks.onToolStart(data.tool_name, data.tool_id, data.input)
      return
    case 'ToolDone':
      callbacks.onToolDone(data.tool_id, data.output)
      return
    case 'Error':
      callbacks.onError(data.message)
      return
    case 'Compaction':
      callbacks.onCompaction?.(data.phase, data.reason, data.tokens_before)
      return
    case 'QueueUpdate':
      callbacks.onQueueUpdate?.(data.queued)
      return
    case 'Done':
      callbacks.onDone()
      return
  }
}

function createStreamCloser(callbacks: AgentStreamCallbacks): () => void {
  let closed = false
  return () => {
    if (closed) return
    closed = true
    callbacks.onDone()
  }
}

function addAbortListener(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {}
  if (signal.aborted) {
    onAbort()
    return () => {}
  }

  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

function streamMockAiAgent(request: StreamAiAgentRequest): void {
  const { agent, message, callbacks, signal } = request
  const closeStream = createStreamCloser(callbacks)
  let removeAbortListener = (): void => {}
  const timeout = window.setTimeout(() => {
    removeAbortListener()
    callbacks.onText(mockAgentResponse(agent, message))
    closeStream()
  }, 300)
  removeAbortListener = addAbortListener(signal, () => {
    window.clearTimeout(timeout)
    closeStream()
  })
}

function nativeAgentStreamRequest(request: StreamAiAgentRequest, eventName: string) {
  return {
    agent: request.agent,
    message: request.message,
    system_prompt: request.systemPrompt || null,
    vault_path: request.vaultPath,
    vault_paths: request.vaultPaths && request.vaultPaths.length > 0 ? request.vaultPaths : null,
    permission_mode: normalizeAiAgentPermissionMode(request.permissionMode),
    event_name: eventName,
  }
}

function isPrimeAgent(agent: AiAgentId): boolean {
  return agent === 'prime'
}

async function streamNativeAiAgent(request: StreamAiAgentRequest): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const usePrime = isPrimeAgent(request.agent)
  const eventName = createScopedStreamEventName(
    usePrime ? 'prime-session-stream' : 'ai-agent-stream',
  )
  const closeStream = createStreamCloser(request.callbacks)

  const abortNativeStream = (): void => {
    if (usePrime) {
      void invoke<boolean>('abort_prime_session_turn').catch(() => {})
      return
    }
    void invoke<boolean>('abort_ai_agent_stream', { eventName }).catch(() => {})
  }

  const unlisten = await listen<AiAgentStreamEvent>(eventName, (event) => {
    if (event.payload.kind === 'Done') {
      closeStream()
      return
    }

    handleStreamEvent(event.payload, request.callbacks)
  })
  const removeAbortListener = addAbortListener(request.signal, abortNativeStream)
  if (request.signal?.aborted) {
    cleanupTauriEventListener(unlisten)
    closeStream()
    return
  }

  try {
    if (usePrime) {
      await invoke<string>('stream_prime_session', {
        // PrimePromptRequest uses serde rename_all = "camelCase"
        request: {
          message: request.message,
          // `PrimePromptRequest.images` — omitted entirely for a text-only
          // turn so the command on the wire is unchanged.
          images: request.images ?? [],
          systemPrompt: request.systemPrompt || null,
          vaultPath: request.vaultPath || '',
          eventName,
          provider: null,
          modelId: null,
          newSession: false,
        },
      })
    } else {
      await invoke<string>('stream_ai_agent', {
        request: nativeAgentStreamRequest(request, eventName),
      })
    }
    closeStream()
  } catch (err) {
    request.callbacks.onError(err instanceof Error ? err.message : String(err))
    closeStream()
  } finally {
    removeAbortListener()
    cleanupTauriEventListener(unlisten)
  }
}

export async function streamAiAgent(request: StreamAiAgentRequest): Promise<void> {
  if (request.signal?.aborted) {
    request.callbacks.onDone()
    return
  }

  if (!isTauri()) {
    streamMockAiAgent(request)
    return
  }

  await streamNativeAiAgent(request)
}
