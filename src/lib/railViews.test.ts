import { describe, expect, it } from 'vitest'
import { RAIL_VIEW_IDS, RAIL_VIEWS, railViewById } from './railViews'

describe('rail view grouping', () => {
  it('keeps Research → Graph → Mycelium → Changes → History in that order', () => {
    expect(RAIL_VIEWS.map((view) => view.id)).toEqual([...RAIL_VIEW_IDS])
    expect(RAIL_VIEWS.map((view) => view.label)).toEqual([
      'Research',
      'Graph',
      'Mycelium',
      'Changes',
      'History',
    ])
  })

  it('gives each view one noun, a Go-to label, and digits 1–5', () => {
    expect(RAIL_VIEWS.map((view) => view.shortcutNumber)).toEqual([1, 2, 3, 4, 5])
    expect(RAIL_VIEWS.map((view) => view.goLabel)).toEqual([
      'Go to Research',
      'Go to Graph',
      'Go to Mycelium',
      'Go to Changes',
      'Go to History',
    ])
    expect(new Set(RAIL_VIEWS.map((view) => view.commandId)).size).toBe(5)
    expect(new Set(RAIL_VIEWS.map((view) => view.testId)).size).toBe(5)
  })

  it('looks up a view by id', () => {
    expect(railViewById('graph')).toMatchObject({ label: 'Graph', shortcutNumber: 2 })
  })
})
