import { isTauri } from '../mock-tauri'
import type { AiAgentPermissionMode } from '../lib/aiAgentPermissionMode'
import { normalizeAiAgentPermissionMode } from '../lib/aiAgentPermissionMode'
import { isAnthropicNativeTarget } from '../lib/nativeChatTargets'
import { trackEvent } from '../lib/telemetry'
import { cleanupTauriEventListener } from './tauriEventCleanup'
import type { AgentStreamCallbacks } from './streamAiAgent'

export const ANTHROPIC_NATIVE_REFUSAL =
  'Anthropic catalog models are not available on the native engine until 6a.'

/** Where hosted native-engine keys are stored. */
export const NATIVE_NO_KEY_GUIDANCE =
  'Add a key in Settings → AI Agents → API models.'

/**
 * Native auth failures must name Settings, never Prime install copy.
 */
export function nativeChatUserError(message: string): string {
  const trimmed = message.trim()
  if (/prime.?agent is not available|npm i -g prime-agent/i.test(trimmed)) {
    return `This native chat needs an API key. ${NATIVE_NO_KEY_GUIDANCE}`
  }
  if (/no (local |free-tier )?(api|provider) key/i.test(trimmed)) {
    const withStop = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
    return `${withStop} ${NATIVE_NO_KEY_GUIDANCE}`
  }
  return trimmed
}

export interface StreamNativeChatRequest {
  target: string
  message: string
  systemPrompt?: string
  vaultPath: string
  vaultPaths?: string[]
  permissionMode?: AiAgentPermissionMode
  /** Continue this live native session instead of starting a new log. */
  sessionId?: string | null
  callbacks: AgentStreamCallbacks
  signal?: AbortSignal
}

export interface NativeEngineEvent {
  kind: string
  text?: string
  message?: string
  name?: string
  id?: string
  args?: string
  output?: string
  fatal?: boolean
  prompt_id?: string
  tool?: string
  options?: Array<{ id: string; label: string }>
  path?: string
  preview?: string
  reason?: string
}

export function applyNativeEvent(event: NativeEngineEvent, callbacks: AgentStreamCallbacks): boolean {
  switch (event.kind) {
    case 'text_delta':
      if (event.text) callbacks.onText(event.text)
      return false
    case 'tool_call':
      callbacks.onToolStart(event.name ?? 'tool', event.id ?? '', event.args)
      return false
    case 'tool_result':
      callbacks.onToolDone(event.id ?? '', event.output)
      return false
    case 'tool_denied':
      callbacks.onToolDenied?.(event.id ?? '', event.reason ?? 'denied')
      return false
    case 'approval_requested':
      callbacks.onApprovalRequested?.({
        promptId: event.prompt_id ?? '',
        tool: event.tool ?? event.name ?? 'tool',
        args: event.args ?? '',
        options: event.options ?? [],
        path: event.path,
        preview: event.preview,
        reply: () => {},
      })
      return false
    case 'approval_dismissed':
      callbacks.onApprovalDismissed?.(event.prompt_id ?? '')
      return false
    case 'error': {
      const message = nativeChatUserError(event.message ?? 'Native chat failed')
      if (event.fatal === false) {
        callbacks.onNotice?.(message)
        return false
      }
      callbacks.onError(message)
      return true
    }
    case 'turn_end':
    case 'cancelled':
      return true
    default:
      return false
  }
}

export async function streamNativeChat(request: StreamNativeChatRequest): Promise<string | undefined> {
  if (request.signal?.aborted) {
    request.callbacks.onDone()
    return
  }
  trackEvent('chat_native_turn_started', { engine: 'native' })
  if (isAnthropicNativeTarget(request.target)) {
    request.callbacks.onError(ANTHROPIC_NATIVE_REFUSAL)
    request.callbacks.onDone()
    return
  }
  if (!isTauri()) {
    request.callbacks.onText(`[mock-native] You said: "${request.message}"`)
    request.callbacks.onDone()
    return
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  try {
    const sessionId = request.sessionId
      ? request.sessionId
      : await invoke<string>('native_chat_start', {
        request: {
          target: request.target,
          prompt: request.message,
          systemPrompt: request.systemPrompt || null,
          vaultPath: request.vaultPath || null,
          vaultPaths: request.vaultPaths ?? [],
          permissionMode: normalizeAiAgentPermissionMode(request.permissionMode),
        },
      })
    if (request.sessionId) {
      await invoke('native_chat_send', { sessionId, text: request.message })
    }
    await new Promise<void>((resolve) => {
      let settled = false
      let unlisten: (() => void) | undefined
      const finish = () => {
        if (settled) return
        settled = true
        if (unlisten) cleanupTauriEventListener(unlisten)
        request.callbacks.onDone()
        resolve()
      }
      const onAbort = () => {
        void invoke('native_chat_cancel', { sessionId }).catch(() => {})
        finish()
      }
      request.signal?.addEventListener('abort', onAbort, { once: true })
      if (request.signal?.aborted) {
        onAbort()
        return
      }
      const callbacks: AgentStreamCallbacks = {
        ...request.callbacks,
        onApprovalRequested: (prompt) => {
          request.callbacks.onApprovalRequested?.({
            ...prompt,
            reply: (choice) => {
              void invoke('native_chat_approval_reply', {
                sessionId,
                promptId: prompt.promptId,
                reply: choice,
              }).catch(() => {})
            },
          })
        },
      }
      void listen<NativeEngineEvent>(`native-chat:${sessionId}`, (event) => {
        if (settled) return
        if (applyNativeEvent(event.payload, callbacks)) finish()
      }).then((stop) => {
        unlisten = stop
        if (settled) cleanupTauriEventListener(stop)
      })
    })
    return sessionId
  } catch (error) {
    request.callbacks.onError(
      nativeChatUserError(error instanceof Error ? error.message : String(error)),
    )
    request.callbacks.onDone()
  }
}
