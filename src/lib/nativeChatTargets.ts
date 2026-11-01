import type { AiModelProvider } from './aiTargets'
import {
  isAnthropicTarget,
  isWellFormedRhizomeTarget,
  migrateRhizomeChatTarget,
  rhizomeProviderNeedsApiKey,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from './rhizomeChatModels'
import {
  isLocalProviderKind,
  providerListSectionFor,
  sortByProviderListOrder,
} from './providerListOrder'
import { oauthAccountReady, type OauthStatus } from './providerOauth'

export const FREE_TIER_AUTO_TARGET = 'free_tier_auto'
export const FREE_TIER_AUTO_LABEL = 'Taproot'

export interface NativeChatTargetOption {
  id: string
  label: string
}

/** Catalog models plus configured models plus Taproot. Anthropic stays hidden until 6a. */
export function nativeChatTargetOptions(
  providers?: AiModelProvider[] | null,
): NativeChatTargetOption[] {
  return orderedSeedModels(providers).map((model) => ({
    id: model.id,
    label: model.label,
  }))
}

function orderedSeedModels(providers?: AiModelProvider[] | null): RhizomeChatModel[] {
  const models = seedRhizomeChatModels(providers)
  // Preserve catalog/seed order within a section+readiness bucket so the first
  // ready default stays Ollama llama3.2 (not LM Studio, which sorts earlier by label).
  return sortByProviderListOrder(
    models.map((model, index) => ({ model, index })),
    ({ model, index }) => ({
      section: providerListSectionFor({ kind: model.providerKind }),
      readiness: modelIsReady(model, providers) ? 'ready' : 'needs_setup',
      name: String(index).padStart(6, '0'),
    }),
  ).map(({ model }) => model)
}

function modelIsReady(
  model: RhizomeChatModel,
  providers?: AiModelProvider[] | null,
  oauthByProvider?: Record<string, OauthStatus | null | undefined> | null,
): boolean {
  if (model.providerKind === 'free_tier') return true
  if (isLocalProviderKind(model.providerKind)) return true
  if (model.providerKind === 'open_ai') {
    const chatgpt = oauthByProvider?.openai
    if (oauthAccountReady(chatgpt)) return true
  }
  return !rhizomeProviderNeedsApiKey(model.providerKind, providers)
}

/**
 * First model that is actually ready in the shared list order.
 * A signed-out ChatGPT / keyless OpenAI row must not win over Ollama or Taproot.
 */
export function defaultNativeChatTarget(
  providers?: AiModelProvider[] | null,
  oauthByProvider?: Record<string, OauthStatus | null | undefined> | null,
): string {
  const models = orderedSeedModels(providers)
  const ready = models.find((model) => modelIsReady(model, providers, oauthByProvider))
  return ready?.id ?? FREE_TIER_AUTO_TARGET
}

export function resolveNativeChatTarget(
  stored: string | null | undefined,
  providers?: AiModelProvider[] | null,
  oauthByProvider?: Record<string, OauthStatus | null | undefined> | null,
): string {
  const models = seedRhizomeChatModels(providers)
  const value = stored?.trim()
  if (value && !isAnthropicNativeTarget(value, providers)) {
    const migrated = migrateRhizomeChatTarget(models, value)
    if (models.some((model) => model.id === migrated) || isWellFormedRhizomeTarget(value, providers)) {
      return migrated
    }
  }
  return defaultNativeChatTarget(providers, oauthByProvider)
}

export function isAnthropicNativeTarget(
  target: string,
  providers?: AiModelProvider[] | null,
): boolean {
  return isAnthropicTarget(target, providers)
}
