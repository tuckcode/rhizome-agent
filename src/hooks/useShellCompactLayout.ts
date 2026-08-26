import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export const SHELL_COLLAPSE_SESSIONS_WIDTH = 1420
export const SHELL_COLLAPSE_VAULT_PANEL_WIDTH = 1180

export type ShellCompactState = {
  collapseSessions: boolean
  collapseVaultPanel: boolean
}

export function getShellCompactState(
  width: number | null,
  noteOpen: boolean,
  inspectorOpen = false,
): ShellCompactState {
  if (!noteOpen || width === null || width <= 0) {
    return { collapseSessions: false, collapseVaultPanel: false }
  }

  const inspectorAllowance = inspectorOpen ? 240 : 0
  return {
    collapseSessions: width < SHELL_COLLAPSE_SESSIONS_WIDTH + inspectorAllowance,
    collapseVaultPanel: width < SHELL_COLLAPSE_VAULT_PANEL_WIDTH + inspectorAllowance,
  }
}

export function useShellCompactLayout(
  enabled: boolean,
  noteOpen: boolean,
  inspectorOpen = false,
): ShellCompactState & { shellRef: RefObject<HTMLDivElement | null> } {
  const shellRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!enabled) return

    const element = shellRef.current
    if (!element) return

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
  }, [enabled])

  return {
    shellRef,
    ...getShellCompactState(enabled ? width : null, noteOpen, inspectorOpen),
  }
}
