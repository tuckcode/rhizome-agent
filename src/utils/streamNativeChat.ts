import { isTauri } from '../mock-tauri'
import type { AiAgentPermissionMode } from '../lib/aiAgentPermissionMode'
import { normalizeAiAgentPermissionMode } from '../lib/aiAgentPermissionMode'
import { isAnthropicNativeTarget } from '../lib/nativeChatTargets'
import { trackEvent } from '../lib/telemetry'
import { cleanupTauriEventListener } from './tauriEventCleanup'
import type { AgentStreamCallbacks } from './streamAiAgent'

export const ANTHROPIC_NATIVE_REFUSAL =
  'Anthropic catalog models are not available on the native engine until 6a.'

export interface StreamNativeChatRequest {
  target: string
  message: string
  systemPrompt?: string
  vaultPath: string
  vaultPaths?: string[]
  permissionMode?: AiAgentPermissionMode
  callbacks: AgentStreamCallbacks
  signal?: AbortSignal
}

interface NativeEngineEvent {
  kind: string
  text?: string
  message?: string
  name?: string
  id?: string
  args?: string
  output?: string
}

function applyNativeEvent(event: NativeEngineEvent, callbacks: AgentStreamCallbacks): boolean {
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
    case 'error':
      callbacks.onError(event.message ?? 'Native chat failed')
      return false
    case 'turn_end':
    case 'cancelled':
      return true
    default:
      return false
  }
}

export async function streamNativeChat(request: StreamNativeChatRequest): Promise<void> {
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
    const sessionId = await invoke<string>('native_chat_start', {
      request: {
        target: request.target,
        prompt: request.message,
        systemPrompt: request.systemPrompt || null,
        vaultPath: request.vaultPath || null,
        vaultPaths: request.vaultPaths ?? [],
        permissionMode: normalizeAiAgentPermissionMode(request.permissionMode),
      },
    })
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
      void listen<NativeEngineEvent>(`native-chat:${sessionId}`, (event) => {
        if (applyNativeEvent(event.payload, request.callbacks)) finish()
      }).then((stop) => {
        unlisten = stop
        if (settled) cleanupTauriEventListener(stop)
      })
    })
  } catch (error) {
    request.callbacks.onError(error instanceof Error ? error.message : String(error))
    request.callbacks.onDone()
  }
}
