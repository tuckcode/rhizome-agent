import { describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion } from './reducedMotion'

function viewWith(matches: boolean): Window {
  return { matchMedia: vi.fn(() => ({ matches })) } as unknown as Window
}

describe('prefersReducedMotion', () => {
  it('reports the system preference', () => {
    expect(prefersReducedMotion(viewWith(true))).toBe(true)
    expect(prefersReducedMotion(viewWith(false))).toBe(false)
  })

  it('says no when the query cannot be run, rather than guessing yes', () => {
    expect(prefersReducedMotion(undefined)).toBe(false)
    expect(prefersReducedMotion({} as unknown as Window)).toBe(false)
  })

  it('survives an engine whose matchMedia throws', () => {
    const view = {
      matchMedia: () => {
        throw new Error('nope')
      },
    } as unknown as Window
    expect(prefersReducedMotion(view)).toBe(false)
  })
})
