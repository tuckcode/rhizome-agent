import { useEffect, useState } from 'react'

export const CONNECTIONS_PLACEMENT_STORAGE_KEY = 'rhizome:connections-placement:v1'
export const CONNECTIONS_PLACEMENT_CHANGED_EVENT = 'rhizome:connections-placement-changed'

export type ConnectionsView = 'graph' | 'mycelium'
export type ConnectionsPlacement = 'sidebar' | 'full' | 'off'

export type ConnectionsPlacements = Record<ConnectionsView, ConnectionsPlacement>

function normalizePlacement(value: unknown): ConnectionsPlacement {
  return value === 'full' || value === 'off' ? value : 'sidebar'
}

export function readConnectionsPlacements(): ConnectionsPlacements {
  try {
    const value = JSON.parse(localStorage.getItem(CONNECTIONS_PLACEMENT_STORAGE_KEY) ?? '{}') as {
      graph?: unknown
      mycelium?: unknown
    }
    return {
      graph: normalizePlacement(value?.graph),
      mycelium: normalizePlacement(value?.mycelium),
    }
  } catch {
    return { graph: 'sidebar', mycelium: 'sidebar' }
  }
}

export function writeConnectionsPlacements(next: ConnectionsPlacements): void {
  try {
    localStorage.setItem(CONNECTIONS_PLACEMENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // In-memory preferences still work.
  }
  window.dispatchEvent(new Event(CONNECTIONS_PLACEMENT_CHANGED_EVENT))
}

export function isConnectionsViewOff(
  view: ConnectionsView,
  placements: ConnectionsPlacements = readConnectionsPlacements(),
): boolean {
  return placements[view] === 'off'
}

export function useConnectionsPlacements(): ConnectionsPlacements {
  const [placements, setPlacements] = useState(readConnectionsPlacements)
  useEffect(() => {
    const sync = () => setPlacements(readConnectionsPlacements())
    window.addEventListener('storage', sync)
    window.addEventListener(CONNECTIONS_PLACEMENT_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CONNECTIONS_PLACEMENT_CHANGED_EVENT, sync)
    }
  }, [])
  return placements
}

export function availableConnectionsViews(
  placements: ConnectionsPlacements = readConnectionsPlacements(),
): ConnectionsView[] {
  return (['graph', 'mycelium'] as const).filter((view) => placements[view] !== 'off')
}
