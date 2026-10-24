import type { AiModelProviderKind } from './aiTargets'

export type PickerBlock =
  | 'needs_key'
  | 'not_running'
  | 'no_models'
  | 'load_failed'

export interface PickerMenuModel {
  id: string
  modelId: string
  displayName: string
  providerName: string
  providerKind: string
  providerId: string
  cacheKey: string
  baseUrl?: string | null
}

export interface PickerMenuFailure {
  cacheKey: string
  kind: 'timeout' | 'unreachable' | 'empty'
}

export interface PickerMenuRow {
  id: string
  modelId: string
  label: string
  providerKind: string
  providerId: string
  disabled: boolean
  reason: string | null
  action: 'add_key' | 'retry' | null
  tab: 'local' | 'api' | 'agents'
}

export interface PickerMenuGroup {
  id: string
  label: string
  providerKind: string
  providerId: string
  cacheKey: string
  tab: 'local' | 'api' | 'agents'
  /** Rows cannot be picked. Needs a key, or a local server that is not running. */
  blocked: boolean
  /** Shown once on the group header. Saved rows stay selectable. */
  hint: string | null
  attention: boolean
  rows: PickerMenuRow[]
}

const LOCAL_KINDS = new Set(['ollama', 'lm_studio'])

export function baseUrlHost(baseUrl: string | null | undefined): string | null {
  const raw = baseUrl?.trim()
  if (!raw) return null
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const host = new URL(withScheme).hostname
    return host || null
  } catch {
    return null
  }
}

/** Custom hosts use the name the user typed, or the base URL host. */
export function chatProviderGroupLabel(
  name: string,
  kind: string,
  baseUrl?: string | null,
): string {
  const trimmed = name.trim()
  if (kind === 'open_ai_compatible' && trimmed.toLowerCase() === 'custom provider') {
    return baseUrlHost(baseUrl) ?? trimmed
  }
  return trimmed || baseUrlHost(baseUrl) || 'Provider'
}

export function pickerBlockReason(
  providerName: string,
  block: PickerBlock,
): string {
  if (block === 'needs_key') return 'Needs an API key'
  if (block === 'not_running') return `${providerName} isn't running`
  if (block === 'no_models') return 'No models found'
  return "Couldn't load models"
}

function settingsTab(kind: string): 'local' | 'api' {
  return LOCAL_KINDS.has(kind) ? 'local' : 'api'
}

function isCatalogCustomSeed(model: PickerMenuModel): boolean {
  return model.providerKind === 'open_ai_compatible' && model.providerId === 'open_ai_compatible'
}

export function buildPickerMenu(input: {
  models: PickerMenuModel[]
  failures: PickerMenuFailure[]
  loadingNames: string[]
  needsKey: (providerKind: string, providerId: string) => boolean
}): PickerMenuGroup[] {
  const failureByKey = new Map(input.failures.map((failure) => [failure.cacheKey, failure.kind]))
  const groups: PickerMenuGroup[] = []
  const index: Record<string, number> = {}

  for (const model of input.models) {
    if (model.providerKind === 'free_tier') {
      pushModel(groups, index, model, null, null)
      continue
    }
    if (isCatalogCustomSeed(model)) continue
    if (model.providerKind === 'anthropic') continue

    const loading = input.loadingNames.includes(model.providerName) || input.loadingNames.includes(model.cacheKey)
    const needsKey = input.needsKey(model.providerKind, model.providerId)
    const failure = failureByKey.get(model.cacheKey)
    const local = LOCAL_KINDS.has(model.providerKind)
    let block: PickerBlock | null = null
    let hint: string | null = null
    if (needsKey) block = 'needs_key'
    else if (!loading && failure === 'unreachable' && local) block = 'not_running'
    else if (!loading && failure === 'empty') hint = pickerBlockReason(model.providerName, 'no_models')
    else if (!loading && failure === 'timeout') hint = pickerBlockReason(model.providerName, 'load_failed')
    pushModel(groups, index, model, block, hint)
  }

  return groups
}

function pushModel(
  groups: PickerMenuGroup[],
  index: Record<string, number>,
  model: PickerMenuModel,
  block: PickerBlock | null,
  hint: string | null = null,
): void {
  const key = model.cacheKey || `${model.providerKind}:${model.providerId}`
  let at = index[key]
  if (at === undefined) {
    at = groups.length
    index[key] = at
    const tab = model.providerKind === 'free_tier' ? 'api' : settingsTab(model.providerKind)
    groups.push({
      id: key,
      label: model.providerKind === 'free_tier'
        ? model.providerName
        : chatProviderGroupLabel(model.providerName, model.providerKind, model.baseUrl),
      providerKind: model.providerKind,
      providerId: model.providerId,
      cacheKey: key,
      tab,
      blocked: false,
      hint: null,
      attention: false,
      rows: [],
    })
  }
  const group = groups[at]
  if (block) group.blocked = true
  if (hint) group.hint = hint
  group.attention = group.blocked || group.hint !== null
  const reason = block ? pickerBlockReason(group.label, block) : null
  group.rows.push({
    id: model.id,
    modelId: model.modelId,
    label: model.displayName.trim() || model.modelId,
    providerKind: model.providerKind,
    providerId: model.providerId,
    disabled: block !== null,
    reason,
    action: block === 'needs_key' ? 'add_key' : block ? 'retry' : null,
    tab: group.tab,
  })
}

/** Needs a key, not running, or a list that failed. Loading groups are not counted. */
export function unsetProviderGroupCount(groups: PickerMenuGroup[]): number {
  return groups.filter((group) => group.attention && group.providerKind !== 'free_tier').length
}

export function providerKindForTab(kind: string): 'local' | 'api' {
  return settingsTab(kind as AiModelProviderKind)
}
