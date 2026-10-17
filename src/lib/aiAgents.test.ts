import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AI_AGENT,
  PRODUCT_AI_AGENT_DEFINITIONS,
  composerAgentLabel,
  getAiAgentDefinition,
  getNextAiAgentId,
  normalizeAiAgentsStatus,
  normalizeStoredAiAgent,
  resolveDefaultAiAgent,
} from './aiAgents'

describe('aiAgents helpers', () => {
  it('normalizes stored agent ids including prime', () => {
    expect(normalizeStoredAiAgent('prime')).toBe('prime')
    expect(normalizeStoredAiAgent('claude_code')).toBe('claude_code')
    expect(normalizeStoredAiAgent('hermes')).toBe('hermes')
    expect(normalizeStoredAiAgent('gemini')).toBe('antigravity')
    expect(normalizeStoredAiAgent('cursor')).toBeNull()
  })

  it('defaults to Prime for Rhizome Agent product', () => {
    expect(DEFAULT_AI_AGENT).toBe('prime')
    expect(resolveDefaultAiAgent(undefined)).toBe('prime')
    expect(resolveDefaultAiAgent(null)).toBe('prime')
    // Legacy stored backends fall back to Prime in product resolution
    expect(resolveDefaultAiAgent('claude_code')).toBe('prime')
    expect(resolveDefaultAiAgent('prime')).toBe('prime')
  })

  it('exposes only Prime in product definitions, labeled Prime Agent', () => {
    expect(PRODUCT_AI_AGENT_DEFINITIONS.map((d) => d.id)).toEqual(['prime'])
    expect(getAiAgentDefinition('prime').label).toBe('Prime Agent')
    expect(getAiAgentDefinition('prime').shortLabel).toBe('Prime')
  })

  it('names the composer after the engine running the chat', () => {
    expect(composerAgentLabel({ chatEngine: 'prime', agent: 'prime' })).toBe('Prime')
    expect(composerAgentLabel({ chatEngine: 'native', agent: 'prime' })).toBe('Rhizome')
    expect(composerAgentLabel({ agent: 'prime' })).toBe('Prime')
    expect(composerAgentLabel({ chatEngine: 'prime', agent: 'codex', targetLabel: 'Codex' })).toBe('Codex')
    expect(composerAgentLabel({ chatEngine: 'native', agent: 'codex', targetLabel: 'Codex' })).toBe('Rhizome')
  })

  it('normalizes raw status payloads including prime', () => {
    const statuses = normalizeAiAgentsStatus({
      prime: { installed: true, version: '1.2.3' },
      claude_code: { installed: true, version: '1.0.20' },
      hermes: { installed: false, version: null },
    })

    expect(statuses.prime).toEqual({ status: 'installed', version: '1.2.3' })
    expect(statuses.claude_code).toEqual({ status: 'installed', version: '1.0.20' })
    expect(statuses.hermes).toEqual({ status: 'missing', version: null })
  })

  it('cycles only product-visible agents', () => {
    expect(getNextAiAgentId('prime')).toBe('prime')
    expect(getNextAiAgentId('claude_code')).toBe('prime')
  })
})
