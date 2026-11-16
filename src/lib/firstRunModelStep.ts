import { useSyncExternalStore } from 'react'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import {
  DEFAULT_MODEL_CAPABILITIES,
  normalizeAiModelProviders,
  type AiModelProvider,
  type AiModelProviderKind,
} from './aiTargets'
import { PROVIDER_PRESETS, type ProviderPreset } from './providerPresets'
import { providerForDiscover } from './rhizomeChatModels'

/**
 * First run: the step after the vault where the user connects a model
 * (run plan section 3.4). Order is consent, welcome, vault, model, shell.
 *
 * The step shows once, for a user who just finished the vault step and has
 * no model provider saved. "Set up later" ends it as surely as a connection
 * does, so the step never comes back on its own.
 */

/**
 * Ways to connect, in the order the step offers them when none is detected.
 *
 * Extension point: a new engine (for example Claude Code, ADR-0191) adds its
 * id here, a case in `recommendedModelPath`, and a panel in
 * `FirstRunModelStep.tsx`. Nothing else in first run needs to change.
 */
export const FIRST_RUN_MODEL_PATHS = ['local', 'chatgpt', 'api_key'] as const
export type FirstRunModelPath = typeof FIRST_RUN_MODEL_PATHS[number]

/** Local servers the step probes, in order. Both are in the provider catalog. */
export const FIRST_RUN_LOCAL_KINDS = ['ollama', 'lm_studio'] as const satisfies readonly AiModelProviderKind[]
export type FirstRunLocalKind = typeof FIRST_RUN_LOCAL_KINDS[number]

export interface DetectedLocalModels {
  kind: FirstRunLocalKind
  name: string
  models: string[]
}

/**
 * Key providers the step offers. Anthropic is left out because Rhizome chat
 * does not run Anthropic models yet (see the note in AiProviderSettings).
 * Custom endpoints stay in Settings.
 */
const FIRST_RUN_KEY_PRESET_IDS = ['openai', 'gemini', 'openrouter', 'xai', 'groq'] as const

export function firstRunKeyPresets(): ProviderPreset[] {
  const presets: readonly ProviderPreset[] = PROVIDER_PRESETS
  return FIRST_RUN_KEY_PRESET_IDS.flatMap((id) => {
    const preset = presets.find((entry) => entry.id === id)
    return preset ? [preset] : []
  })
}

/**
 * The one path the step leads with. A model already on this computer needs
 * no account and no key, so it comes first. Otherwise ChatGPT sign-in, which
 * needs no key to paste. A key is always offered as the third path.
 */
export function recommendedModelPath(input: {
  local: DetectedLocalModels | null
}): FirstRunModelPath {
  if (input.local && input.local.models.length > 0) return 'local'
  return 'chatgpt'
}

/** The first local server that answered with at least one model. */
export function firstDetectedLocal(results: DetectedLocalModels[]): DetectedLocalModels | null {
  for (const kind of FIRST_RUN_LOCAL_KINDS) {
    const match = results.find((result) => result.kind === kind && result.models.length > 0)
    if (match) return match
  }
  return null
}

/** Provider row for a detected local server, with the model the user will chat with. */
export function localProviderFor(kind: FirstRunLocalKind, modelId: string): AiModelProvider {
  const base = providerForDiscover(kind)
  return {
    ...base,
    models: [{
      id: modelId,
      display_name: null,
      context_window: null,
      max_output_tokens: null,
      capabilities: DEFAULT_MODEL_CAPABILITIES,
    }],
  }
}

/** Provider row for a key provider. The key itself goes to the OS keychain, never here. */
export function keyProviderFor(preset: ProviderPreset): AiModelProvider {
  return {
    id: preset.id,
    name: preset.label,
    kind: preset.apiStyle,
    base_url: preset.baseUrl,
    api_key_storage: 'local_file',
    api_key_env_var: null,
    headers: null,
    models: [{
      id: preset.modelId,
      display_name: null,
      context_window: null,
      max_output_tokens: null,
      capabilities: DEFAULT_MODEL_CAPABILITIES,
    }],
  }
}

/** Native chat target for a provider's first model, as the composer picker writes it. */
export function nativeTargetFor(provider: AiModelProvider): string | null {
  const model = provider.models[0]
  if (!model) return null
  return `${provider.id.trim().toLowerCase()}/${model.id}`
}

/** Saved providers with `next` added, replacing any row with the same id. */
export function providersWith(
  existing: AiModelProvider[] | null | undefined,
  next: AiModelProvider,
): AiModelProvider[] {
  const id = next.id.trim().toLowerCase()
  const rest = normalizeAiModelProviders(existing).filter((provider) => provider.id !== id)
  return normalizeAiModelProviders([...rest, next])
}

// ── Pending flag ───────────────────────────────────────────────────────────
//
// Set when the vault step finishes, cleared when the model step ends. Kept in
// localStorage beside `welcomeDismissed`, so quitting during the step brings
// it back on the next launch, and a user who finished first run before this
// step existed never sees it.

type Listener = () => void
const listeners = new Set<Listener>()

function readPending(): boolean {
  try {
    return localStorage.getItem(APP_STORAGE_KEYS.firstRunModelStep) === 'pending'
  } catch {
    return false
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

export function markModelStepPending(): void {
  try {
    localStorage.setItem(APP_STORAGE_KEYS.firstRunModelStep, 'pending')
  } catch {
    // localStorage may be unavailable. The step is then skipped, which is safe.
  }
  notify()
}

export function completeModelStep(): void {
  try {
    localStorage.setItem(APP_STORAGE_KEYS.firstRunModelStep, 'done')
  } catch {
    // Same as above: nothing to keep.
  }
  notify()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useModelStepPending(): boolean {
  return useSyncExternalStore(subscribe, readPending, () => false)
}

/** True when the step should show: pending, and no provider is saved yet. */
export function shouldShowModelStep(input: {
  pending: boolean
  providers: AiModelProvider[] | null | undefined
}): boolean {
  if (!input.pending) return false
  return normalizeAiModelProviders(input.providers).length === 0
}
