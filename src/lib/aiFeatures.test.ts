import { describe, expect, it } from 'vitest'
import { areAiFeaturesEnabled } from './aiFeatures'

describe('areAiFeaturesEnabled', () => {
  it('defaults AI features on unless the user explicitly disables them', () => {
    expect(areAiFeaturesEnabled(undefined)).toBe(true)
    expect(areAiFeaturesEnabled({ ai_features_enabled: null })).toBe(true)
    expect(areAiFeaturesEnabled({ ai_features_enabled: true })).toBe(true)
    expect(areAiFeaturesEnabled({ ai_features_enabled: false })).toBe(false)
  })
})
