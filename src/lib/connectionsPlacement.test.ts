import { afterEach, describe, expect, it } from 'vitest'
import {
  CONNECTIONS_PLACEMENT_STORAGE_KEY,
  availableConnectionsViews,
  isConnectionsViewOff,
  readConnectionsPlacements,
  writeConnectionsPlacements,
} from './connectionsPlacement'

afterEach(() => {
  localStorage.clear()
})

describe('connectionsPlacement', () => {
  it('treats missing storage as sidebar for both views', () => {
    expect(readConnectionsPlacements()).toEqual({ graph: 'sidebar', mycelium: 'sidebar' })
    expect(availableConnectionsViews()).toEqual(['graph', 'mycelium'])
  })

  it('hides a view whose placement is off', () => {
    writeConnectionsPlacements({ graph: 'off', mycelium: 'sidebar' })
    expect(isConnectionsViewOff('graph')).toBe(true)
    expect(isConnectionsViewOff('mycelium')).toBe(false)
    expect(availableConnectionsViews()).toEqual(['mycelium'])
  })

  it('treats garbage JSON as the sidebar default', () => {
    localStorage.setItem(CONNECTIONS_PLACEMENT_STORAGE_KEY, '{not-json')
    expect(readConnectionsPlacements()).toEqual({ graph: 'sidebar', mycelium: 'sidebar' })
  })
})
