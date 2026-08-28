import { useCallback, useState } from 'react'

/**
 * A drag-resizable panel width that survives a restart.
 *
 * `resizeBy` takes the raw horizontal delta from a drag on the panel's **left**
 * edge, so dragging left widens it — the caller does not have to remember the
 * sign convention, and neither does the next panel that adopts this.
 *
 * The clamp is not decoration. A panel dragged to zero is a panel you cannot
 * get back, and a width stored on a 27" display must not come back as an
 * unusable sliver on a laptop — so the bounds are applied on read as well as
 * on drag.
 */
export function usePanelWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
): { width: number; resizeBy: (deltaX: number) => void } {
  const [width, setWidth] = useState(() =>
    clamp(readStoredWidth(storageKey) ?? defaultWidth, minWidth, maxWidth),
  )

  const resizeBy = useCallback(
    (deltaX: number) => {
      setWidth((current) => {
        const next = clamp(current - deltaX, minWidth, maxWidth)
        try {
          window.localStorage.setItem(storageKey, String(next))
        } catch {
          // A refused write costs the memory of the width, not the resize.
        }
        return next
      })
    },
    [maxWidth, minWidth, storageKey],
  )

  return { width, resizeBy }
}

function readStoredWidth(storageKey: string): number | null {
  try {
    const stored = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  } catch {
    return null
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
