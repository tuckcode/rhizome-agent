import { afterEach, describe, expect, it } from 'vitest'
import { createEdgeColorResolver } from './edgeColorResolver'

const root = document.documentElement

afterEach(() => {
  root.style.removeProperty('--accent-blue')
  root.style.removeProperty('--accent-purple')
  root.style.removeProperty('--accent-teal')
  root.style.removeProperty('--accent-orange')
})

describe('createEdgeColorResolver', () => {
  it('resolves each edge kind to its own CSS variable', () => {
    root.style.setProperty('--accent-blue', '#2266ee')
    root.style.setProperty('--accent-purple', '#8844cc')
    root.style.setProperty('--accent-teal', '#22aabb')
    root.style.setProperty('--accent-orange', '#ee8822')
    const resolver = createEdgeColorResolver(root)

    expect(resolver.colorFor('wikilink')).toBe('#2266ee')
    expect(resolver.colorFor('belongs_to')).toBe('#8844cc')
    expect(resolver.colorFor('related_to')).toBe('#22aabb')
    expect(resolver.colorFor('relationship')).toBe('#ee8822')
  })

  it('gives every edge kind a visually distinct color', () => {
    root.style.setProperty('--accent-blue', '#2266ee')
    root.style.setProperty('--accent-purple', '#8844cc')
    root.style.setProperty('--accent-teal', '#22aabb')
    root.style.setProperty('--accent-orange', '#ee8822')
    const resolver = createEdgeColorResolver(root)

    const colors = ['wikilink', 'belongs_to', 'related_to', 'relationship'].map((kind) =>
      resolver.colorFor(kind as Parameters<typeof resolver.colorFor>[0]),
    )
    expect(new Set(colors).size).toBe(4)
  })

  it('memoizes until invalidated, then picks up theme changes', () => {
    root.style.setProperty('--accent-blue', '#2266ee')
    const resolver = createEdgeColorResolver(root)
    expect(resolver.colorFor('wikilink')).toBe('#2266ee')

    root.style.setProperty('--accent-blue', '#111111')
    expect(resolver.colorFor('wikilink')).toBe('#2266ee')

    resolver.invalidate()
    expect(resolver.colorFor('wikilink')).toBe('#111111')
  })

  it('falls back to a concrete color when the variable is undefined', () => {
    const resolver = createEdgeColorResolver(root)
    const color = resolver.colorFor('wikilink')
    expect(color.startsWith('#')).toBe(true)
  })
})
