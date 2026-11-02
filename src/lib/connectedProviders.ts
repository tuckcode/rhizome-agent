import { CONNECTED_EXTERNAL_AGENT_IDS } from './providerListOrder'
import { getAiAgentDefinition, type AiAgentId, type AiAgentsStatus, getAiAgentAvailability } from './aiAgents'
import {
  aiModelProviderCatalog,
  aiModelProviderCatalogEntry,
  isLocalAiProvider,
  normalizeAiModelProviders,
  type AiModelProvider,
} from './aiTargets'
import { providerForDiscover, rhizomeProviderNeedsApiKey } from './rhizomeChatModels'
import {
  connectionAction,
  connectionStatus,
  connectionStatusLabel,
  type ConnectionAction,
  type ConnectionProbe,
  type ConnectionStatus,
} from './providerConnection'
import { canListProviderModelsLive, type ProviderListFailure } from './listProviderModels'
import type { ProviderSettingsTab } from './providerSettingsFocus'
import {
  providerListSectionFor,
  sortByProviderListOrder,
  type ProviderListReadiness,
  type ProviderListSection,
} from './providerListOrder'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
  chatgptOfficialHostConfigured,
  type AccountSignInProvider,
} from './accountSignInProviders'
import { oauthAccountReady, type OauthStatus } from './providerOauth'

export interface ConnectedRow {
  id: string
  rowId: string
  name: string
  kind: 'agent' | 'provider' | 'account'
  status: ConnectionStatus
  statusLabel: string
  action: ConnectionAction
  tab: ProviderSettingsTab
  /** The tab row to scroll to. Distinct from the summary element's id. */
  targetRowId: string
  models: string[]
  showKeyField: boolean
  installUrl: string | null
  provider: AiModelProvider | null
  section: ProviderListSection
  /** Account descriptor when kind === 'account'. */
  account: AccountSignInProvider | null
  accountEmail: string | null
}

export function agentRowId(agentId: string): string {
  return `agent-row-${agentId}`
}

export function providerRowId(providerId: string): string {
  return `provider-row-${providerId}`
}

export function accountRowId(accountId: string): string {
  return `account-row-${accountId}`
}

/** DOM id for FreeTierSettings — Connected Manage scrolls here. */
export function freeTierRowId(): string {
  return 'free-tier-settings'
}

export function summaryRowId(targetRowId: string): string {
  return `summary-${targetRowId}`
}

export function probeToConnection(input: {
  needsKey: boolean
  local: boolean
  failure: ProviderListFailure | null
  models: string[] | null
}): ConnectionProbe | null {
  if (input.needsKey) return { models: [] }
  if (input.failure === null && input.models === null) return null
  if (input.failure === 'unreachable') return { unreachable: true, failed: true, models: [] }
  if (input.failure === 'timeout') return { failed: true, models: [] }
  if (input.failure === 'empty') return { models: [] }
  return { models: input.models ?? [] }
}

function readinessForStatus(status: ConnectionStatus, agentNotInstalled: boolean): ProviderListReadiness {
  if (agentNotInstalled) return 'not_installed'
  if (status === 'ready') return 'ready'
  if (status === 'needs_key' || status === 'not_running' || status === 'load_failed' || status === 'no_models' || status === 'checking') {
    return status === 'needs_key' ? 'needs_setup' : status === 'checking' ? 'other' : 'needs_setup'
  }
  return 'other'
}

export function buildConnectedRows(input: {
  agents: AiAgentsStatus
  providers?: AiModelProvider[] | null
  failureFor: (provider: AiModelProvider) => ProviderListFailure | null
  modelsFor: (provider: AiModelProvider) => string[] | null
  /** oauth_status by account provider id. Missing → signed out. */
  oauthByProvider?: Record<string, OauthStatus | null | undefined> | null
}): ConnectedRow[] {
  const providers = normalizeAiModelProviders(input.providers)
  const rows: ConnectedRow[] = []
  const oauthByProvider = input.oauthByProvider ?? {}
  const hostOk = chatgptOfficialHostConfigured(providers)

  for (const account of ACCOUNT_SIGN_IN_PROVIDERS) {
    const status = oauthByProvider[account.id]
    const ready = hostOk && oauthAccountReady(status)
    const targetRowId = accountRowId(account.id)
    rows.push({
      id: `account:${account.id}`,
      rowId: summaryRowId(targetRowId),
      targetRowId,
      name: account.label,
      kind: 'account',
      status: ready ? 'ready' : 'needs_key',
      statusLabel: ready ? 'Ready' : 'Needs sign-in',
      action: ready ? 'open' : 'none',
      tab: 'api',
      models: ready ? chatgptAccountModelLabels(providers, input.modelsFor) : [],
      showKeyField: false,
      installUrl: null,
      provider: null,
      section: 'accounts',
      account,
      accountEmail: ready ? (status?.email ?? null) : null,
    })
  }

  for (const agentId of CONNECTED_EXTERNAL_AGENT_IDS) {
    const definition = getAiAgentDefinition(agentId as AiAgentId)
    const installed = getAiAgentAvailability(input.agents, definition.id).status === 'installed'
    const targetRowId = agentRowId(definition.id)
    const section = providerListSectionFor({ agent: true, installed })
    rows.push({
      id: `agent:${definition.id}`,
      rowId: summaryRowId(targetRowId),
      targetRowId,
      name: definition.label,
      kind: 'agent',
      status: installed ? 'ready' : 'not_running',
      statusLabel: installed ? 'Ready' : 'Not installed',
      action: installed ? 'open' : 'install',
      tab: 'agents',
      models: [],
      showKeyField: false,
      installUrl: installed ? null : definition.installUrl,
      provider: null,
      section,
      account: null,
      accountEmail: null,
    })
  }

  const seenKinds = new Set<string>()
  for (const provider of providerRows(providers)) {
    seenKinds.add(provider.kind)
    const local = isLocalAiProvider(provider)
    const needsKey = !local && rhizomeProviderNeedsApiKey(provider.kind, providers)
    const listable = provider.kind !== 'anthropic' && canListProviderModelsLive(provider)
    const failure = needsKey || !listable ? null : input.failureFor(provider)
    const models = needsKey ? null : listable ? input.modelsFor(provider) : savedModelLabels(provider)
    const status = connectionStatus({
      needsKey,
      local,
      probe: probeToConnection({ needsKey, local, failure, models }),
    })
    const readyModels = status === 'ready' ? (models ?? []) : []
    const targetRowId = providerRowId(provider.id)
    const section = providerListSectionFor({ kind: provider.kind })
    rows.push({
      id: `provider:${provider.id}`,
      rowId: summaryRowId(targetRowId),
      targetRowId,
      name: provider.name,
      kind: 'provider',
      status,
      statusLabel: statusLabel(status),
      action: connectionAction(status),
      tab: local ? 'local' : 'api',
      models: readyModels,
      showKeyField: !local && provider.kind !== 'anthropic',
      installUrl: null,
      provider,
      section,
      account: null,
      accountEmail: null,
    })
  }

  for (const entry of aiModelProviderCatalog()) {
    if (entry.local || entry.kind === 'anthropic' || entry.kind === 'open_ai_compatible') continue
    if (seenKinds.has(entry.kind)) continue
    if (!rhizomeProviderNeedsApiKey(entry.kind, providers)) continue
    const provider = providerForDiscover(entry.kind)
    const targetRowId = providerRowId(provider.id)
    rows.push({
      id: `provider:${provider.id}`,
      rowId: summaryRowId(targetRowId),
      targetRowId,
      name: provider.name,
      kind: 'provider',
      status: 'needs_key',
      statusLabel: 'Needs a key',
      action: 'add_key',
      tab: 'api',
      models: [],
      showKeyField: true,
      installUrl: null,
      provider,
      section: 'api_keys',
      account: null,
      accountEmail: null,
    })
  }

  const freeTarget = freeTierRowId()
  rows.push({
    id: 'provider:free_tier',
    rowId: summaryRowId(freeTarget),
    targetRowId: freeTarget,
    name: 'Taproot',
    kind: 'provider',
    status: 'ready',
    statusLabel: 'Ready',
    action: 'open',
    tab: 'api',
    models: ['Taproot'],
    showKeyField: false,
    installUrl: null,
    provider: null,
    section: 'free',
    account: null,
    accountEmail: null,
  })

  return sortByProviderListOrder(rows, (row) => ({
    section: row.section,
    readiness: readinessForStatus(row.status, row.section === 'not_installed'),
    name: row.name,
  }))
}

function isBuiltinOpenaiProvider(provider: AiModelProvider): boolean {
  if (provider.kind !== 'open_ai') return false
  const id = provider.id.trim().toLowerCase()
  return id === '' || id === 'openai' || id === 'open_ai'
}

/** Labels for the ChatGPT Connected row when oauth is Ready. */
function chatgptAccountModelLabels(
  providers: AiModelProvider[],
  modelsFor: (provider: AiModelProvider) => string[] | null,
): string[] {
  const openai = providers.find(isBuiltinOpenaiProvider)
  if (openai) {
    const listable = openai.kind !== 'anthropic' && canListProviderModelsLive(openai)
    if (listable) {
      const live = modelsFor(openai)
      if (live && live.length > 0) return live
    }
    const saved = savedModelLabels(openai)
    if (saved.length > 0) return saved
  }
  return [aiModelProviderCatalogEntry('open_ai').default_model_id]
}


function providerRows(providers: AiModelProvider[]): AiModelProvider[] {
  const rows: AiModelProvider[] = []
  const configuredLocal = new Set(
    providers.filter((provider) => isLocalAiProvider(provider)).map((provider) => provider.kind),
  )
  for (const entry of aiModelProviderCatalog()) {
    if (!entry.local) continue
    const configured = providers.filter((provider) => provider.kind === entry.kind)
    if (configured.length > 0) {
      rows.push(...configured)
      continue
    }
    if (!configuredLocal.has(entry.kind)) rows.push(providerForDiscover(entry.kind))
  }
  for (const provider of providers) {
    if (isLocalAiProvider(provider)) continue
    rows.push(provider)
  }
  return rows
}

function savedModelLabels(provider: AiModelProvider): string[] {
  return provider.models
    .map((model) => model.display_name?.trim() || model.id.trim())
    .filter(Boolean)
}

function statusLabel(status: ConnectionStatus): string {
  return connectionStatusLabel(status)
}
