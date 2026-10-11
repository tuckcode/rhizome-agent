import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { AiModelDefinition, AiModelProvider } from '../lib/aiTargets'

interface CompleteAiModelTextRequest {
  provider: AiModelProvider
  model: AiModelDefinition
  message: string
  systemPrompt?: string
}

/** One plain reply from an API model, with no tools and no vault access. */
export async function completeAiModelText(request: CompleteAiModelTextRequest): Promise<string> {
  if (!isTauri()) return ''
  return invoke<string>('complete_ai_model_text', {
    request: {
      provider: request.provider,
      model_id: request.model.id,
      message: request.message,
      system_prompt: request.systemPrompt || null,
      vault_path: null,
      vault_paths: [],
      api_key_override: null,
      event_name: null,
    },
  })
}
