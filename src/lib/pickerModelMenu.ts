import type { TranslationKey } from './i18n'
import type { AiModelProviderKind } from './aiTargets'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
} from './accountSignInProviders'
import {
  oauthAccountReady,
  type OauthStatus,
} from './providerOauth'
import {
  isLocalProviderKind,
  localModelRowLabel,
  providerListSectionFor,
  sortByProviderListOrder,
  type ProviderListReadiness,
  type ProviderListSection,
} from './providerListOrder'

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
  action: 'add_key' | 'retry' | 'sign_in' | null
  tab: 'local' | 'api' | 'agents'
}

export interface PickerMenuGroup {
  id: string
  label: string
  providerKind: string
  providerId: string
  cacheKey: string
  tab: 'local' | 'api' | 'agents'
  section: ProviderListSection
  /** Rows cannot be picked. Needs a key, or a local server that is not running. */
  blocked: boolean
  /** Shown once on the group header. Saved rows stay selectable. */
  hint: string | null
  attention: boolean
  rows: PickerMenuRow[]
  /** Account sign-in affordance on the group header. */
  accountSignIn: boolean
}

const LOCAL_GROUP_ID = 'local'
const LOCAL_GROUP_LABEL = 'Local'

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

/** Map picker empty/error hint strings to existing i18n keys (en.json owned by #284). */
export function pickerHintI18nKey(hint: string | null | undefined): TranslationKey | null {
  if (hint === 'No models found') return 'ai.composer.noModelsFound'
  if (hint === "Couldn't load models") return 'ai.composer.couldntLoadModels'
  return null
}

function settingsTab(kind: string): 'local' | 'api' {
  return isLocalProviderKind(kind) ? 'local' : 'api'
}

function isCatalogCustomSeed(model: PickerMenuModel): boolean {
  return model.providerKind === 'open_ai_compatible' && model.providerId === 'open_ai_compatible'
}

function groupReadiness(group: PickerMenuGroup): ProviderListReadiness {
  if (group.blocked && group.rows.some((row) => row.action === 'add_key' || row.action === 'sign_in')) {
    return 'needs_setup'
  }
  if (group.blocked) return 'needs_setup'
  if (group.attention) return 'needs_setup'
  return 'ready'
}

export function buildPickerMenu(input: {
  models: PickerMenuModel[]
  failures: PickerMenuFailure[]
  loadingNames: string[]
  needsKey: (providerKind: string, providerId: string) => boolean
  /** When true, OpenAI group shows Sign in instead of only Add key. */
  accountNeedsSignIn?: (providerKind: string, providerId: string) => boolean
  oauthByProvider?: Record<string, OauthStatus | null | undefined> | null
}): PickerMenuGroup[] {
  const failureByKey = new Map(input.failures.map((failure) => [failure.cacheKey, failure.kind]))
  const groups: PickerMenuGroup[] = []
  const index: Record<string, number> = {}

  for (const account of ACCOUNT_SIGN_IN_PROVIDERS) {
    const status = input.oauthByProvider?.[account.id]
    const ready = oauthAccountReady(status)
    const key = `account:${account.id}`
    groups.push({
      id: key,
      label: account.label,
      providerKind: account.providerKind,
      providerId: account.id,
      cacheKey: key,
      tab: 'api',
      section: 'accounts',
      blocked: !ready,
      hint: ready ? (status?.email ?? null) : 'Needs sign-in',
      attention: !ready,
      accountSignIn: !ready,
      rows: ready
        ? [{
            id: key,
            modelId: '',
            label: status?.email ?? 'Signed in',
            providerKind: account.providerKind,
            providerId: account.id,
            disabled: true,
            reason: null,
            action: null,
            tab: 'api',
          }]
        : [{
            id: key,
            modelId: '',
            label: account.signInLabel,
            providerKind: account.providerKind,
            providerId: account.id,
            disabled: true,
            reason: 'Needs sign-in',
            action: 'sign_in',
            tab: 'api',
          }],
    })
    index[key] = groups.length - 1
  }

  for (const model of input.models) {
    if (model.providerKind === 'free_tier') {
      pushModel(groups, index, model, null, null, false)
      continue
    }
    if (isCatalogCustomSeed(model)) continue
    if (model.providerKind === 'anthropic') continue

    const loading = input.loadingNames.includes(model.providerName) || input.loadingNames.includes(model.cacheKey)
    const needsKey = input.needsKey(model.providerKind, model.providerId)
    const needsSignIn = input.accountNeedsSignIn?.(model.providerKind, model.providerId) ?? false
    const failure = failureByKey.get(model.cacheKey)
    const local = isLocalProviderKind(model.providerKind)
    let block: PickerBlock | null = null
    let hint: string | null = null
    if (needsKey && !needsSignIn) block = 'needs_key'
    else if (needsSignIn && needsKey) block = 'needs_key'
    else if (!loading && failure === 'unreachable' && local) block = 'not_running'
    else if (!loading && failure === 'empty') hint = pickerBlockReason(model.providerName, 'no_models')
    else if (!loading && failure === 'timeout') hint = pickerBlockReason(model.providerName, 'load_failed')
    pushModel(groups, index, model, block, hint, needsSignIn)
  }

  const merged = mergeLocalGroups(groups)
  return sortByProviderListOrder(merged, (group) => ({
    section: group.section,
    readiness: groupReadiness(group),
    name: group.label,
  }))
}

function mergeLocalGroups(groups: PickerMenuGroup[]): PickerMenuGroup[] {
  const locals = groups.filter((group) => isLocalProviderKind(group.providerKind))
  if (locals.length <= 1) {
    return groups.map((group) =>
      isLocalProviderKind(group.providerKind)
        ? {
            ...group,
            id: LOCAL_GROUP_ID,
            label: LOCAL_GROUP_LABEL,
            section: 'local' as const,
            rows: group.rows.map((row) => ({
              ...row,
              label: localModelRowLabel(row.modelId || row.label, group.label),
            })),
          }
        : group,
    )
  }

  const rest = groups.filter((group) => !isLocalProviderKind(group.providerKind))
  const merged: PickerMenuGroup = {
    id: LOCAL_GROUP_ID,
    label: LOCAL_GROUP_LABEL,
    providerKind: 'ollama',
    providerId: LOCAL_GROUP_ID,
    cacheKey: LOCAL_GROUP_ID,
    tab: 'local',
    section: 'local',
    blocked: locals.some((group) => group.blocked),
    hint: locals.find((group) => group.hint)?.hint ?? null,
    attention: locals.some((group) => group.attention),
    accountSignIn: false,
    rows: locals.flatMap((group) =>
      group.rows.map((row) => ({
        ...row,
        label: localModelRowLabel(row.modelId || row.label, group.label),
      })),
    ),
  }
  return [...rest, merged]
}

function pushModel(
  groups: PickerMenuGroup[],
  index: Record<string, number>,
  model: PickerMenuModel,
  block: PickerBlock | null,
  hint: string | null = null,
  accountSignIn = false,
): void {
  const local = isLocalProviderKind(model.providerKind)
  const key = local
    ? `local:${model.providerKind}:${model.providerId}`
    : (model.cacheKey || `${model.providerKind}:${model.providerId}`)
  let at = index[key]
  if (at === undefined) {
    at = groups.length
    index[key] = at
    const tab = model.providerKind === 'free_tier' ? 'api' : settingsTab(model.providerKind)
    const section = providerListSectionFor({ kind: model.providerKind })
    groups.push({
      id: key,
      label: model.providerKind === 'free_tier'
        ? model.providerName
        : chatProviderGroupLabel(model.providerName, model.providerKind, model.baseUrl),
      providerKind: model.providerKind,
      providerId: model.providerId,
      cacheKey: key,
      tab,
      section,
      blocked: false,
      hint: null,
      attention: false,
      accountSignIn: false,
      rows: [],
    })
  }
  const group = groups[at]
  if (block) group.blocked = true
  if (hint) group.hint = hint
  if (accountSignIn) group.accountSignIn = true
  group.attention = group.blocked || group.hint !== null || group.accountSignIn
  const reason = block
    ? pickerBlockReason(local ? model.providerName : group.label, block)
    : null
  const rowLabel = local
    ? localModelRowLabel(model.displayName.trim() || model.modelId, model.providerName)
    : (model.displayName.trim() || model.modelId)
  group.rows.push({
    id: model.id,
    modelId: model.modelId,
    label: rowLabel,
    providerKind: model.providerKind,
    providerId: model.providerId,
    disabled: block !== null,
    reason,
    action: block === 'needs_key'
      ? (accountSignIn ? 'sign_in' : 'add_key')
      : block
        ? 'retry'
        : null,
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
