import { afterEach, describe, expect, it } from 'vitest'
import { auditUi, classifyWell } from './uiAudit'

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

  /** A bordered, rounded *panel* is not pretending to be pressable. Without
   *  this the rule fires on every card in the app. */
  it('leaves a card alone, however rounded', () => {
    const host = mount('<div style="border: 1px solid; border-radius: 12px">Prime is ready</div>')
    sized(host.firstElementChild!, { w: 560, h: 320 })

    expect(auditUi(host).filter((f) => f.rule === 'inert-control')).toHaveLength(0)
  })

  /** A count badge is bordered, rounded and small, and nobody tries to click
   *  "3". Flagging every badge in the app is noise. */
  it('leaves a count badge alone', () => {
    const host = mount('<span style="border: 1px solid; border-radius: 999px">98</span>')
    sized(host.firstElementChild!, { w: 22, h: 18 })

    expect(auditUi(host).filter((f) => f.rule === 'inert-control')).toHaveLength(0)
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
    expect(tiny[0].detail).toContain('thinner than')
  })

  /** A wide, short pill is easy to hit — 71px of width to aim at. Flagging
   *  every one of those makes a report nobody reads. */
  it('accepts a wide control that is only short', () => {
    const host = mount('<button aria-label="Attached vault">Rhizome Vault</button>')
    sized(host.firstElementChild!, { w: 110, h: 21 })

    expect(auditUi(host).filter((f) => f.rule === 'tiny-target')).toHaveLength(0)
  })

  /** Small in both directions is the real miss risk. */
  it('flags an icon button that is small both ways', () => {
    const host = mount('<button aria-label="Archive"></button>')
    sized(host.firstElementChild!, { w: 21, h: 21 })

    const tiny = auditUi(host).filter((f) => f.rule === 'tiny-target')
    expect(tiny).toHaveLength(1)
    expect(tiny[0].detail).toContain('both directions')
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

  /** A row action drawn fully over its row is a deliberate overlay, not a
   *  collision. Flagging it buried the real finding under 21 copies. */
  it('does not flag a control drawn entirely inside another', () => {
    const host = mount(`
      <button aria-label="Open session">Session</button>
      <button aria-label="Archive">x</button>
    `)
    const [row, action] = host.querySelectorAll('button')
    sized(row, { x: 0, y: 0, w: 200, h: 54 })
    sized(action, { x: 160, y: 16, w: 21, h: 21 })

    expect(auditUi(host).filter((f) => f.rule === 'overlapping-controls')).toHaveLength(0)
  })

  /** A list row passing under a sticky toolbar looks, to geometry, exactly
   *  like a collision. Different scroll containers means one is passing
   *  behind the other by design. */
  it('does not flag content scrolling under a sticky toolbar', () => {
    const host = mount(`
      <div><button aria-label="Search notes">Search</button></div>
      <div id="scroller" style="overflow-y: auto"><button aria-label="Open Essays">Essays</button></div>
    `)
    const toolbar = host.querySelector('[aria-label="Search notes"]')!
    const row = host.querySelector('[aria-label="Open Essays"]')!
    sized(toolbar, { x: 0, y: 0, w: 200, h: 30 })
    sized(row, { x: 0, y: 10, w: 200, h: 30 })

    expect(auditUi(host).filter((f) => f.rule === 'overlapping-controls')).toHaveLength(0)
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

/**
 * The decision part of `snapshotUi`, given the numbers a browser measured.
 * Real layout is tested in `tests/smoke/live-ui.spec.ts`, because jsdom has
 * no layout engine and reports 0 for every height.
 */
describe('classifyWell', () => {
  it('reports a scroller whose content fits as unable to scroll', () => {
    // The Chat transcript bug: `overflow-y: auto`, but the box grew to fit.
    expect(classifyWell({ overflowY: 'auto', scrollHeight: 640, clientHeight: 640 })).toEqual({
      canScroll: false,
      reason: 'no-overflow',
    })
  })

  it('reports a scroller with taller content as able to scroll', () => {
    expect(classifyWell({ overflowY: 'scroll', scrollHeight: 1000, clientHeight: 200 })).toEqual({
      canScroll: true,
      reason: 'scrolls',
    })
  })

  it('reports a box that hides taller content as clipped', () => {
    expect(classifyWell({ overflowY: 'hidden', scrollHeight: 1000, clientHeight: 200 })).toEqual({
      canScroll: false,
      reason: 'clipped',
    })
    expect(classifyWell({ overflowY: 'clip', scrollHeight: 1000, clientHeight: 200 })?.reason).toBe('clipped')
  })

  it('ignores a box that is not a scroller and hides nothing', () => {
    expect(classifyWell({ overflowY: 'hidden', scrollHeight: 200, clientHeight: 200 })).toBeNull()
    expect(classifyWell({ overflowY: 'visible', scrollHeight: 1000, clientHeight: 200 })).toBeNull()
  })

  it('treats a 1px rounding difference as no overflow', () => {
    expect(classifyWell({ overflowY: 'auto', scrollHeight: 201, clientHeight: 200 })?.reason).toBe('no-overflow')
    expect(classifyWell({ overflowY: 'hidden', scrollHeight: 201, clientHeight: 200 })).toBeNull()
  })
})
