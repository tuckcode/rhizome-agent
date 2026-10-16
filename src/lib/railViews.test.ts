import { describe, expect, it } from 'vitest'
import { computeActiveRailView, RAIL_VIEW_IDS, RAIL_VIEWS, railViewById } from './railViews'

describe('rail view grouping', () => {
  it('keeps Research → Graph → Mycelium → History in that order', () => {
    expect(RAIL_VIEWS.map((view) => view.id)).toEqual([...RAIL_VIEW_IDS])
    expect(RAIL_VIEWS.map((view) => view.label)).toEqual([
      'Research',
      'Graph',
      'Mycelium',
      'History',
    ])
  })

  it('gives each view one noun, a Go-to label, and digits 1–4', () => {
    expect(RAIL_VIEWS.map((view) => view.shortcutNumber)).toEqual([1, 2, 3, 4])
    expect(RAIL_VIEWS.map((view) => view.goLabel)).toEqual([
      'Go to Research',
      'Go to Graph',
      'Go to Mycelium',
      'Go to History',
    ])
    expect(new Set(RAIL_VIEWS.map((view) => view.commandId)).size).toBe(4)
    expect(new Set(RAIL_VIEWS.map((view) => view.testId)).size).toBe(4)
  })

  it('looks up a view by id', () => {
    expect(railViewById('graph')).toMatchObject({ label: 'Graph', shortcutNumber: 2 })
  })
})

describe('computeActiveRailView', () => {
  const pulse = { kind: 'filter', filter: 'pulse' }
  const notes = { kind: 'filter', filter: 'all' }

  it('returns research when that destination is active', () => {
    expect(computeActiveRailView(notes, false, false, true)).toBe('research')
  })

  it('returns graph when that destination is active', () => {
    expect(computeActiveRailView(notes, true, false, false)).toBe('graph')
  })

  it('returns mycelium when that destination is active', () => {
    expect(computeActiveRailView(notes, false, true, false)).toBe('mycelium')
  })

  it('returns history for the Pulse filter', () => {
    expect(computeActiveRailView(pulse, false, false, false)).toBe('history')
  })

  it('returns null when no rail view is selected', () => {
    expect(computeActiveRailView(notes, false, false, false)).toBeNull()
    expect(computeActiveRailView({ kind: 'entity' }, false, false, false)).toBeNull()
  })
})
