import { describe, expect, it } from 'vitest'
import { filterModels, partitionModelsByConnection, groupModelsByProvider, type PrimeModel } from './primeModels'

function model(overrides: Partial<PrimeModel> = {}): PrimeModel {
  return { id: 'm1', name: 'Model One', provider: 'xai', ...overrides }
}

describe('groupModelsByProvider', () => {
  it('groups by provider, providers alphabetical and models by name within', () => {
    const groups = groupModelsByProvider([
      model({ id: 'z', name: 'Zeta', provider: 'xai' }),
      model({ id: 'a', name: 'Alpha', provider: 'xai' }),
      model({ id: 'c', name: 'Claude', provider: 'anthropic' }),
    ])

    expect(groups.map((g) => g.provider)).toEqual(['anthropic', 'xai'])
    expect(groups[1].models.map((m) => m.name)).toEqual(['Alpha', 'Zeta'])
  })

  /** A menu entry that cannot be switched to is worse than no entry. */
  it('drops models missing the provider or id that set_model needs', () => {
    const groups = groupModelsByProvider([
      model({ id: '', provider: 'xai' }),
      model({ id: 'ok', provider: '  ' }),
      model({ id: 'good', provider: 'xai' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].models.map((m) => m.id)).toEqual(['good'])
  })

  it('sorts an unnamed model by its id rather than dropping it', () => {
    const groups = groupModelsByProvider([
      model({ id: 'b-model', name: '', provider: 'local' }),
      model({ id: 'a-model', name: '', provider: 'local' }),
    ])

    expect(groups[0].models.map((m) => m.id)).toEqual(['a-model', 'b-model'])
  })

  it('returns nothing for an empty list', () => {
    expect(groupModelsByProvider([])).toEqual([])
  })

  describe('partitionModelsByConnection', () => {
    const catalog = [
      model({ id: 'a', provider: 'opencode' }),
      model({ id: 'b', provider: 'prime-inference' }),
      model({ id: 'c', provider: 'anthropic' }),
    ]

    it('separates models whose provider has no credentials', () => {
      const { available, unavailable } = partitionModelsByConnection(catalog, [
        'opencode',
        'anthropic',
      ])
      expect(available.map((m) => m.id)).toEqual(['a', 'c'])
      expect(unavailable.map((m) => m.id)).toEqual(['b'])
    })

    // Unknown credentials must not grey out a working model. The backend
    // refuses to guess for the same reason.
    it('treats an unknown credential set as everything available', () => {
      const { available, unavailable } = partitionModelsByConnection(catalog, [])
      expect(available).toHaveLength(3)
      expect(unavailable).toHaveLength(0)
    })

    it('keeps unusable models rather than hiding them', () => {
      const { available, unavailable } = partitionModelsByConnection(catalog, ['opencode'])
      expect(available.length + unavailable.length).toBe(catalog.length)
    })
  })

  describe('filterModels', () => {
    const catalog = [
      model({ id: 'big-pickle', name: 'Big Pickle', provider: 'opencode' }),
      model({ id: 'claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' }),
      model({ id: 'grok-4.6', name: 'Grok 4.6', provider: 'xai' }),
    ]

    it('matches on name, id and provider', () => {
      expect(filterModels(catalog, 'pickle').map((m) => m.id)).toEqual(['big-pickle'])
      expect(filterModels(catalog, 'opus').map((m) => m.id)).toEqual(['claude-opus-5'])
      expect(filterModels(catalog, 'xai').map((m) => m.id)).toEqual(['grok-4.6'])
    })

    it('ignores case and surrounding space', () => {
      expect(filterModels(catalog, '  GROK ').map((m) => m.id)).toEqual(['grok-4.6'])
    })

    // A blank query is a way through the list, not a gate in front of it.
    it('returns everything for a blank query', () => {
      expect(filterModels(catalog, '   ')).toHaveLength(3)
    })

    it('returns nothing when nothing matches', () => {
      expect(filterModels(catalog, 'nous-portal')).toHaveLength(0)
    })
  })
})
