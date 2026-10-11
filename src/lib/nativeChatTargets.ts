import catalog from '../shared/aiModelProviderCatalog.json'

export const FREE_TIER_AUTO_TARGET = 'free_tier_auto'
export const FREE_TIER_AUTO_LABEL = 'Free tier (auto)'

export interface NativeChatTargetOption {
  id: string
  label: string
}

interface CatalogEntry {
  kind: string
  name: string
  default_model_id: string
}

/** Catalog models plus Free tier (auto). Anthropic stays hidden until 6a. */
export function nativeChatTargetOptions(): NativeChatTargetOption[] {
  const models = (catalog as CatalogEntry[])
    .filter((entry) => entry.kind !== 'anthropic')
    .map((entry) => ({
      id: `${entry.kind}/${entry.default_model_id}`,
      label: `${entry.name} · ${entry.default_model_id}`,
    }))
  return [
    ...models,
    { id: FREE_TIER_AUTO_TARGET, label: FREE_TIER_AUTO_LABEL },
  ]
}

export function defaultNativeChatTarget(): string {
  return nativeChatTargetOptions()[0]?.id ?? FREE_TIER_AUTO_TARGET
}

export function resolveNativeChatTarget(stored: string | null | undefined): string {
  const options = nativeChatTargetOptions()
  if (stored && options.some((option) => option.id === stored)) return stored
  return defaultNativeChatTarget()
}

export function isAnthropicNativeTarget(target: string): boolean {
  const id = target.trim().toLowerCase()
  return id.startsWith('anthropic/') || id.includes('/claude')
}
