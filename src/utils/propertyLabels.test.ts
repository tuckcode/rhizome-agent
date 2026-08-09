import { describe, expect, it } from 'vitest'
import { humanizePropertyKey } from './propertyLabels'

describe('humanizePropertyKey', () => {
  it('humanizes snake_case property keys for display', () => {
    expect(humanizePropertyKey('belongs_to')).toBe('Belongs to')
    expect(humanizePropertyKey('related_to')).toBe('Related to')
  })

  it('preserves already-humanized labels', () => {
    expect(humanizePropertyKey('Belongs to')).toBe('Belongs to')
    expect(humanizePropertyKey('Has')).toBe('Has')
  })

  it('keeps acronym casing when no separators are present', () => {
    expect(humanizePropertyKey('URL')).toBe('URL')
  })
})
