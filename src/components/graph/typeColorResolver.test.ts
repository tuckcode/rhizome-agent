import { afterEach, describe, expect, it } from 'vitest'
import { createTypeColorResolver } from './typeColorResolver'

const root = document.documentElement

afterEach(() => {
  root.style.removeProperty('--accent-red')
  root.style.removeProperty('--muted-foreground')
})

describe('createTypeColorResolver', () => {
  it('resolves a type CSS variable to its computed value', () => {
    root.style.setProperty('--accent-red', '#e05252')
    const resolver = createTypeColorResolver(root)
    expect(resolver.colorFor('Project', false)).toBe('#e05252')
  })

  it('memoizes until invalidated, then picks up theme changes', () => {
    root.style.setProperty('--accent-red', '#e05252')
    const resolver = createTypeColorResolver(root)
    expect(resolver.colorFor('Project', false)).toBe('#e05252')

    root.style.setProperty('--accent-red', '#aa1111')
    expect(resolver.colorFor('Project', false)).toBe('#e05252')

    resolver.invalidate()
    expect(resolver.colorFor('Project', false)).toBe('#aa1111')
  })

  it('resolves ghosts to the muted foreground tone', () => {
    root.style.setProperty('--muted-foreground', '#777777')
    const resolver = createTypeColorResolver(root)
    expect(resolver.colorFor('Project', true)).toBe('#777777')
  })

  it('falls back to a concrete color when the variable is undefined', () => {
    const resolver = createTypeColorResolver(root)
    const color = resolver.colorFor(null, true)
    expect(color.startsWith('#')).toBe(true)
  })
})
