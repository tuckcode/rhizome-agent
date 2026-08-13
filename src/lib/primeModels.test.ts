import { describe, expect, it } from 'vitest'
import { groupModelsByProvider, type PrimeModel } from './primeModels'

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
})
