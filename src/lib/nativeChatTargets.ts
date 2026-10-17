import type { AiModelProvider } from './aiTargets'
import {
  isAnthropicTarget,
  isWellFormedRhizomeTarget,
  migrateRhizomeChatTarget,
  seedRhizomeChatModels,
} from './rhizomeChatModels'

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
  return seedRhizomeChatModels(providers).map((model) => ({
    id: model.id,
    label: model.label,
  }))
}

export function defaultNativeChatTarget(
  providers?: AiModelProvider[] | null,
): string {
  return nativeChatTargetOptions(providers)[0]?.id ?? FREE_TIER_AUTO_TARGET
}

export function resolveNativeChatTarget(
  stored: string | null | undefined,
  providers?: AiModelProvider[] | null,
): string {
  const models = seedRhizomeChatModels(providers)
  const value = stored?.trim()
  if (value && !isAnthropicNativeTarget(value, providers)) {
    const migrated = migrateRhizomeChatTarget(models, value)
    if (models.some((model) => model.id === migrated) || isWellFormedRhizomeTarget(value, providers)) {
      return migrated
    }
  }
  return defaultNativeChatTarget(providers)
}

export function isAnthropicNativeTarget(
  target: string,
  providers?: AiModelProvider[] | null,
): boolean {
  return isAnthropicTarget(target, providers)
}
