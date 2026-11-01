import { KEPT_EXTERNAL_AGENT_IDS } from './migrateRemovedHarnessChoices'
import { getAiAgentDefinition, type AiAgentId, type AiAgentsStatus, getAiAgentAvailability } from './aiAgents'
import {
  aiModelProviderCatalog,
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

export interface ConnectedRow {
  id: string
  rowId: string
  name: string
  kind: 'agent' | 'provider'
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
}

export function agentRowId(agentId: string): string {
  return `agent-row-${agentId}`
}

export function providerRowId(providerId: string): string {
  return `provider-row-${providerId}`
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

export function buildConnectedRows(input: {
  agents: AiAgentsStatus
  providers?: AiModelProvider[] | null
  failureFor: (provider: AiModelProvider) => ProviderListFailure | null
  modelsFor: (provider: AiModelProvider) => string[] | null
}): ConnectedRow[] {
  const providers = normalizeAiModelProviders(input.providers)
  const rows: ConnectedRow[] = []

  for (const agentId of KEPT_EXTERNAL_AGENT_IDS) {
    const definition = getAiAgentDefinition(agentId as AiAgentId)
    const installed = getAiAgentAvailability(input.agents, definition.id).status === 'installed'
    const targetRowId = agentRowId(definition.id)
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
    })
  }

  return rows
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
