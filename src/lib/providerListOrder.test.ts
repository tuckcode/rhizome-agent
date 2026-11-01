import { describe, expect, it } from 'vitest'
import {
  CONNECTED_EXTERNAL_AGENT_IDS,
  localModelRowLabel,
  PROVIDER_LIST_SECTION_ORDER,
  providerListSectionFor,
  sortByProviderListOrder,
} from './providerListOrder'

describe('providerListOrder', () => {
  it('orders sections accounts → api keys → local → free → not installed', () => {
    expect([...PROVIDER_LIST_SECTION_ORDER]).toEqual([
      'accounts',
      'api_keys',
      'local',
      'free',
      'not_installed',
    ])
  })

  it('maps kinds and agents onto those sections', () => {
    expect(providerListSectionFor({ account: true })).toBe('accounts')
    expect(providerListSectionFor({ kind: 'open_ai' })).toBe('api_keys')
    expect(providerListSectionFor({ kind: 'ollama' })).toBe('local')
    expect(providerListSectionFor({ kind: 'free_tier' })).toBe('free')
    expect(providerListSectionFor({ agent: true, installed: false })).toBe('not_installed')
    expect(providerListSectionFor({ agent: true, installed: true })).toBe('api_keys')
  })

  it('sinks needs-setup below ready inside a section, and collapses not-installed last', () => {
    const rows = [
      { name: 'Codex', section: 'not_installed' as const, readiness: 'not_installed' as const },
      { name: 'OpenAI', section: 'api_keys' as const, readiness: 'needs_setup' as const },
      { name: 'Gemini', section: 'api_keys' as const, readiness: 'ready' as const },
      { name: 'ChatGPT', section: 'accounts' as const, readiness: 'needs_setup' as const },
      { name: 'Ollama', section: 'local' as const, readiness: 'ready' as const },
      { name: 'Taproot', section: 'free' as const, readiness: 'ready' as const },
    ]
    const sorted = sortByProviderListOrder(rows, (row) => row).map((row) => row.name)
    expect(sorted).toEqual(['ChatGPT', 'Gemini', 'OpenAI', 'Ollama', 'Taproot', 'Codex'])
  })

  it('excludes Claude Code from the Connected agent list', () => {
    expect(CONNECTED_EXTERNAL_AGENT_IDS).not.toContain('claude_code')
    expect([...CONNECTED_EXTERNAL_AGENT_IDS]).toEqual(['codex', 'opencode', 'antigravity', 'kiro'])
  })

  it('labels local models with their provider', () => {
    expect(localModelRowLabel('llama3.2', 'Ollama')).toBe('llama3.2 · Ollama')
  })
})
