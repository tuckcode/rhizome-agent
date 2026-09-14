import { describe, expect, it } from 'vitest'
import {
  primeSessionRowTitles,
  type PrimeSessionSummary,
} from './primeSessionMeta'

function session(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return { id: 'id-1', path: '/sessions/id-1.jsonl', ...overrides }
}

describe('leftover untitled session rows', () => {
  const UNTITLED = 'Untitled session'

  it('falls empty title back to the untitled string you pass in', () => {
    expect(primeSessionRowTitles([session({ id: 'bbbbbb222222' })], UNTITLED)).toEqual([
      'Untitled session',
    ])
    expect(primeSessionRowTitles([session({ id: 'x', title: '   ' })], UNTITLED)).toEqual([
      'Untitled session',
    ])
  })

  it('disambiguates two untitled rows', () => {
    const titles = primeSessionRowTitles(
      [
        session({ id: '01a0252e-b9d5-71e9-83de-2bce32f65c06' }),
        session({ id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9' }),
      ],
      UNTITLED,
    )

    expect(titles).toEqual(['Untitled session · f65c06', 'Untitled session · e521f9'])
  })
})
