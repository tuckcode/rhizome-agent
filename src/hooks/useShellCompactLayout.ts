import { useCallback, useLayoutEffect, useState, type RefCallback } from 'react'

import { fitPanePreset } from '../lib/panePresets'

export type ShellCompactState = {
  collapseSessions: boolean
  collapseVaultPanel: boolean
}

export function getShellCompactState(width: number | null, noteOpen: boolean, inspectorOpen = false): ShellCompactState {
  const fit = fitPanePreset({ id: 'notes', widths: {} }, { shellWidth: width, noteOpen: noteOpen || inspectorOpen, railPinned: true })
  return { collapseSessions: !fit.railPinned, collapseVaultPanel: !fit.notesOpen }
}

export function useShellCompactLayout(
  enabled: boolean,
  noteOpen: boolean,
  inspectorOpen = false,
): ShellCompactState & { shellRef: RefCallback<HTMLDivElement>; width: number | null } {
  // A callback ref, so the observer attaches when the shell mounts. The shell
  // can mount after `enabled` turns on (the startup screen renders first), and
  // a ref object would leave the effect with nothing to observe.
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const shellRef = useCallback((node: HTMLDivElement | null) => setElement(node), [])
  const [width, setWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!enabled || !element) return

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width
      setWidth(nextWidth > 0 ? nextWidth : null)
    }

    updateWidth()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width
      if (typeof nextWidth === 'number') {
        setWidth(nextWidth > 0 ? nextWidth : null)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, element])

  return {
    shellRef,
    width: enabled ? width : null,
    ...getShellCompactState(enabled ? width : null, noteOpen, inspectorOpen),
  }
}
