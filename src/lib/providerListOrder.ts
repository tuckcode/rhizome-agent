/**
 * Shared section order for the model picker and Settings > Connected.
 * Accounts → API keys → Local → Free → Not installed (collapsed).
 * Within a section, ready rows stay above needs-setup.
 */

export type ProviderListSection =
  | 'accounts'
  | 'api_keys'
  | 'local'
  | 'free'
  | 'not_installed'

export const PROVIDER_LIST_SECTION_ORDER: readonly ProviderListSection[] = [
  'accounts',
  'api_keys',
  'local',
  'free',
  'not_installed',
] as const

export const PROVIDER_LIST_SECTION_LABEL: Record<ProviderListSection, string> = {
  accounts: 'Your accounts',
  api_keys: 'API keys',
  local: 'Local',
  free: 'Free',
  not_installed: 'Not installed',
}

/** Local CLI tools shown in Connected (Claude Code is excluded per Critiquito). */
export const CONNECTED_EXTERNAL_AGENT_IDS = [
  'codex',
  'opencode',
  'antigravity',
  'kiro',
] as const

export type ConnectedExternalAgentId = (typeof CONNECTED_EXTERNAL_AGENT_IDS)[number]

const LOCAL_KINDS = new Set(['ollama', 'lm_studio'])

export function providerListSectionFor(input: {
  kind?: string | null
  agent?: boolean
  installed?: boolean
  account?: boolean
}): ProviderListSection {
  if (input.account) return 'accounts'
  if (input.agent) return input.installed === false ? 'not_installed' : 'api_keys'
  const kind = (input.kind ?? '').trim().toLowerCase()
  if (kind === 'free_tier') return 'free'
  if (LOCAL_KINDS.has(kind)) return 'local'
  return 'api_keys'
}

export type ProviderListReadiness = 'ready' | 'needs_setup' | 'not_installed' | 'other'

export function providerListReadinessRank(status: ProviderListReadiness): number {
  if (status === 'ready') return 0
  if (status === 'needs_setup') return 1
  if (status === 'other') return 2
  return 3
}

export function sortByProviderListOrder<T>(
  items: T[],
  describe: (item: T) => {
    section: ProviderListSection
    readiness: ProviderListReadiness
    /** Stable tie-break within the same readiness bucket. */
    name: string
  },
): T[] {
  const sectionRank = new Map(PROVIDER_LIST_SECTION_ORDER.map((section, index) => [section, index]))
  return [...items].sort((left, right) => {
    const a = describe(left)
    const b = describe(right)
    const sectionDelta = (sectionRank.get(a.section) ?? 99) - (sectionRank.get(b.section) ?? 99)
    if (sectionDelta !== 0) return sectionDelta
    const readyDelta = providerListReadinessRank(a.readiness) - providerListReadinessRank(b.readiness)
    if (readyDelta !== 0) return readyDelta
    return a.name.localeCompare(b.name)
  })
}

/** Model row label under a shared Local header: "llama3.2 · Ollama". */
export function localModelRowLabel(modelId: string, providerName: string): string {
  const model = modelId.trim() || 'model'
  const provider = providerName.trim() || 'Local'
  return `${model} · ${provider}`
}

export function isLocalProviderKind(kind: string | null | undefined): boolean {
  return LOCAL_KINDS.has((kind ?? '').trim().toLowerCase())
}
