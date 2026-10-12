import type { AiModelProvider } from './aiTargets'
import {
  isAnthropicTarget,
  isWellFormedRhizomeTarget,
  migrateRhizomeChatTarget,
  seedRhizomeChatModels,
} from './rhizomeChatModels'

export const FREE_TIER_AUTO_TARGET = 'free_tier_auto'
export const FREE_TIER_AUTO_LABEL = 'Free tier (auto)'

export interface NativeChatTargetOption {
  id: string
  label: string
}

/** Catalog models plus configured models plus Free tier (auto). Anthropic stays hidden until 6a. */
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
  if (value) {
    const migrated = migrateRhizomeChatTarget(models, value)
    if (models.some((model) => model.id === migrated) || isWellFormedRhizomeTarget(value)) {
      return migrated
    }
  }
  return defaultNativeChatTarget(providers)
}

export function isAnthropicNativeTarget(target: string): boolean {
  return isAnthropicTarget(target)
}
