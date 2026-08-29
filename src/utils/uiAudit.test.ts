import { afterEach, describe, expect, it } from 'vitest'
import { auditUi } from './uiAudit'

/**
 * Each case here is a defect that was actually found the slow way first —
 * by the user pointing at a screenshot, or by measuring one element after a
 * report. The point of the audit is that none of them needed an eye.
 */

function mount(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

function sized(node: Element, box: { x?: number; y?: number; w: number; h: number }) {
  const { x = 0, y = 0, w, h } = box
  node.getBoundingClientRect = () =>
    ({ x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }) as DOMRect
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('auditUi', () => {
  /** The `ctx · note` pill, and "Save as custom" before it. */
  it('flags something styled like a pill that cannot be pressed', () => {
    const host = mount('<span style="border: 1px solid; border-radius: 999px">ctx · memory-loop.md</span>')
    sized(host.firstElementChild!, { w: 120, h: 22 })

    const inert = auditUi(host).filter((f) => f.rule === 'inert-control')
    expect(inert).toHaveLength(1)
    expect(inert[0].label).toContain('memory-loop.md')
  })

  it('leaves a real control alone, however pill-shaped', () => {
    const host = mount('<button style="border: 1px solid; border-radius: 999px">Rhizome Vault</button>')
    sized(host.firstElementChild!, { w: 120, h: 22 })

    expect(auditUi(host).filter((f) => f.rule === 'inert-control')).toHaveLength(0)
  })

  /** The vault, as a composer pill and again in the status bar. */
  it('flags two controls carrying the same label', () => {
    const host = mount(`
      <button aria-label="Attached vault">Rhizome Vault</button>
      <button aria-label="Attached vault">Rhizome Vault · main · 29</button>
    `)
    for (const node of host.querySelectorAll('button')) sized(node, { w: 100, h: 24 })

    const dupes = auditUi(host).filter((f) => f.rule === 'duplicate-control')
    expect(dupes).toHaveLength(1)
    expect(dupes[0].label).toBe('Attached vault')
  })

  /** The 8px resize handle that took three attempts to grab. */
  it('flags a target too small to hit', () => {
    const host = mount('<button aria-label="Resize sessions column"></button>')
    sized(host.firstElementChild!, { w: 8, h: 600 })

    const tiny = auditUi(host).filter((f) => f.rule === 'tiny-target')
    expect(tiny).toHaveLength(1)
    expect(tiny[0].detail).toContain('8x600')
  })

  it('accepts a target at the floor', () => {
    const host = mount('<button aria-label="Send">Send</button>')
    sized(host.firstElementChild!, { w: 24, h: 24 })

    expect(auditUi(host).filter((f) => f.rule === 'tiny-target')).toHaveLength(0)
  })

  /** A label drawn over a list row reads as a rendering fault. */
  it('flags two controls drawn on top of each other', () => {
    const host = mount(`
      <button aria-label="Open session">Rhizome Vault</button>
      <button aria-label="Context window">CONTEXT WINDOW</button>
    `)
    const [a, b] = host.querySelectorAll('button')
    sized(a, { x: 0, y: 100, w: 200, h: 40 })
    sized(b, { x: 0, y: 130, w: 200, h: 40 })

    const overlaps = auditUi(host).filter((f) => f.rule === 'overlapping-controls')
    expect(overlaps).toHaveLength(1)
  })

  /** Nesting is not overlap — a button inside a menu row is ordinary. */
  it('does not flag a control nested inside another', () => {
    const host = mount('<div role="menuitem"><button aria-label="Archive">x</button></div>')
    const outer = host.firstElementChild!
    sized(outer, { w: 200, h: 40 })
    sized(outer.firstElementChild!, { w: 24, h: 24 })

    expect(auditUi(host).filter((f) => f.rule === 'overlapping-controls')).toHaveLength(0)
  })

  it('finds nothing wrong with a clean surface', () => {
    const host = mount('<button aria-label="Send">Send</button><button aria-label="Stop">Stop</button>')
    const [a, b] = host.querySelectorAll('button')
    sized(a, { x: 0, y: 0, w: 60, h: 30 })
    sized(b, { x: 80, y: 0, w: 60, h: 30 })

    expect(auditUi(host)).toEqual([])
  })
})
