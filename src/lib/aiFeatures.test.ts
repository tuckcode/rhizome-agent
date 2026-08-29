import { describe, expect, it } from 'vitest'
import { areAiFeaturesEnabled } from './aiFeatures'

describe('areAiFeaturesEnabled', () => {
  /**
   * The switch behind this is gone (2026-08-29). It used to turn off the AI
   * surfaces, which in Rhizome Agent means turning off the product.
   *
   * This still returns `true` rather than being deleted, because
   * `ai_features_enabled: false` may already sit in someone's settings file.
   * Honouring it would leave them with the app switched off and no control to
   * switch it back on.
   */
  it('is on, whatever a settings file left behind says', () => {
    expect(areAiFeaturesEnabled()).toBe(true)
  })
})
