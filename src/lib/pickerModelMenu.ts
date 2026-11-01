import type { TranslationKey } from './i18n'
import type { AiModelProvider, AiModelProviderKind } from './aiTargets'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
  chatgptOfficialHostConfigured,
} from './accountSignInProviders'
import {
  oauthAccountReady,
  type OauthStatus,
} from './providerOauth'
import {
  isLocalProviderKind,
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

const OPENAI_API_KEY_GROUP_LABEL = 'OpenAI API key'

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

function groupHasSelectableModel(group: PickerMenuGroup): boolean {
  return group.rows.some((row) => !row.disabled && Boolean(row.modelId))
}

/** Sink only when the group has nothing the user can pick. */
function groupReadiness(group: PickerMenuGroup): ProviderListReadiness {
  if (groupHasSelectableModel(group)) return 'ready'
  if (group.section === 'not_installed') return 'not_installed'
  return 'needs_setup'
}

export function buildPickerMenu(input: {
  models: PickerMenuModel[]
  failures: PickerMenuFailure[]
  loadingNames: string[]
  needsKey: (providerKind: string, providerId: string) => boolean
  /** @deprecated Sign in lives only on the accounts group. Kept for call-site compat. */
  accountNeedsSignIn?: (providerKind: string, providerId: string) => boolean
  oauthByProvider?: Record<string, OauthStatus | null | undefined> | null
  /** Used to hide ChatGPT Ready when the OpenAI base URL was edited off-host. */
  providers?: AiModelProvider[] | null
}): PickerMenuGroup[] {
  const failureByKey = new Map(input.failures.map((failure) => [failure.cacheKey, failure.kind]))
  const groups: PickerMenuGroup[] = []
  const index: Record<string, number> = {}
  const hostOk = chatgptOfficialHostConfigured(input.providers)

  const accountClaimedModelIds = new Set<string>()
  const readyAccountKeys = new Set<string>()

  for (const account of ACCOUNT_SIGN_IN_PROVIDERS) {
    const status = input.oauthByProvider?.[account.id]
    const ready = hostOk && oauthAccountReady(status)
    const email = ready ? (status?.email ?? null) : null
    const key = `account:${account.id}`
    if (ready) readyAccountKeys.add(key)
    groups.push({
      id: key,
      label: email ? `${account.label} · ${email}` : account.label,
      providerKind: account.providerKind,
      providerId: account.id,
      cacheKey: key,
      tab: 'api',
      section: 'accounts',
      blocked: !ready,
      // Email lives in the label only — do not repeat it as a header hint.
      hint: ready ? null : 'Needs sign-in',
      attention: !ready,
      accountSignIn: !ready,
      rows: ready
        ? []
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
    const failure = failureByKey.get(model.cacheKey)
    const local = isLocalProviderKind(model.providerKind)
    let block: PickerBlock | null = null
    let hint: string | null = null
    if (needsKey) block = 'needs_key'
    else if (!loading && failure === 'unreachable' && local) block = 'not_running'
    else if (!loading && failure === 'empty') hint = pickerBlockReason(model.providerName, 'no_models')
    else if (!loading && failure === 'timeout') hint = pickerBlockReason(model.providerName, 'load_failed')

    // ChatGPT Ready owns builtin openai models (ADR-0186). Account wins overlaps
    // with the OpenAI API key group so the same gpt-* row is not listed twice.
    const chatgptKey = 'account:openai'
    if (isBuiltinOpenaiModel(model) && readyAccountKeys.has(chatgptKey)) {
      if (!accountClaimedModelIds.has(model.modelId)) {
        accountClaimedModelIds.add(model.modelId)
        pushModelOntoGroup(groups, index[chatgptKey], model, null, null)
      }
      continue
    }

    // Sign in lives only on the accounts group — never on the API key row.
    pushModel(groups, index, model, block, hint, false)
  }

  return sortByProviderListOrder(groups, (group) => ({
    section: group.section,
    readiness: groupReadiness(group),
    name: group.label,
  }))
}

function openAiGroupLabel(model: PickerMenuModel): string {
  const id = model.providerId.trim().toLowerCase()
  if (model.providerKind === 'open_ai' && (id === '' || id === 'openai' || id === 'open_ai')) {
    return OPENAI_API_KEY_GROUP_LABEL
  }
  return chatProviderGroupLabel(model.providerName, model.providerKind, model.baseUrl)
}


function isBuiltinOpenaiModel(model: PickerMenuModel): boolean {
  if (model.providerKind !== 'open_ai') return false
  const id = model.providerId.trim().toLowerCase()
  return id === '' || id === 'openai' || id === 'open_ai'
}

function pushModelOntoGroup(
  groups: PickerMenuGroup[],
  at: number,
  model: PickerMenuModel,
  block: PickerBlock | null,
  hint: string | null,
): void {
  const group = groups[at]
  if (block) group.blocked = true
  if (hint) group.hint = hint
  group.attention = group.blocked || group.hint !== null || group.accountSignIn
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

function pushModel(
  groups: PickerMenuGroup[],
  index: Record<string, number>,
  model: PickerMenuModel,
  block: PickerBlock | null,
  hint: string | null = null,
  accountSignIn = false,
): void {
  const local = isLocalProviderKind(model.providerKind)
  // Keep Ollama and LM Studio as separate groups; scope empty/error hints per providerId.
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
        : openAiGroupLabel(model),
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
  // Empty/load hints stay on this provider group only (no Local bleed).
  if (hint) group.hint = hint
  if (accountSignIn) group.accountSignIn = true
  group.attention = group.blocked || group.hint !== null || group.accountSignIn
  const reason = block
    ? pickerBlockReason(local ? model.providerName : group.label, block)
    : null
  // Under a provider-named group, Local rows are model-only; the chip keeps Provider · model.
  const rowLabel = model.displayName.trim() || model.modelId
  group.rows.push({
    id: model.id,
    modelId: model.modelId,
    label: rowLabel,
    providerKind: model.providerKind,
    providerId: model.providerId,
    disabled: block !== null,
    reason,
    action: block === 'needs_key'
      ? 'add_key'
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
