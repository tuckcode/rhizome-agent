import { describe, expect, it } from 'vitest'
import {
  EMPTY_PRIME_QUEUE,
  normalizePrimeQueue,
  primeQueueIsEmpty,
  primeQueueItems,
} from './primeQueue'

describe('primeQueue', () => {
  it('lists steering before follow-ups, oldest first in each lane', () => {
    expect(
      primeQueueItems({
        steering: ['focus on error handling'],
        followUp: ['then summarise', 'then ship it'],
      }).map((item) => `${item.lane}:${item.text}`),
    ).toEqual([
      'steer:focus on error handling',
      'followUp:then summarise',
      'followUp:then ship it',
    ])
  })

  it('drops blank previews', () => {
    expect(
      normalizePrimeQueue({ steering: ['  '], followUp: ['then summarise', ''] }).followUp,
    ).toEqual(['then summarise'])
  })

  it('treats missing arrays as empty rather than unknown', () => {
    expect(primeQueueIsEmpty(undefined)).toBe(true)
    expect(primeQueueIsEmpty(EMPTY_PRIME_QUEUE)).toBe(true)
    expect(primeQueueIsEmpty({ steering: ['x'], followUp: [] })).toBe(false)
  })
})
