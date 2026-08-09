// Arrow-key navigation between connected graph nodes (keyboard-first
// app convention). Latest-ref pattern from useKeyboardNavigation so the
// window listener stays stable across renders.

import { useEffect, useRef } from 'react'
import { nextNodeInDirection } from '../components/graph/graphData'
import type {
  GraphDirection,
  NodeScreenPosition,
} from '../components/graph/graphTypes'

const ARROW_DIRECTIONS: Record<string, GraphDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

interface UseGraphKeyboardNavOptions {
  enabled: boolean
  adjacency: Map<string, Set<string>>
  focusedId: string | null
  /** Screen-projected positions from the canvas (may be empty pre-render). */
  getPositions: () => Map<string, NodeScreenPosition>
  onFocus: (id: string) => void
  onOpen: (id: string) => void
  /** Escape: exit ego view first, then close the preview (caller decides). */
  onEscape: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function useGraphKeyboardNav(options: UseGraphKeyboardNavOptions): void {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const {
        enabled,
        adjacency,
        focusedId,
        getPositions,
        onFocus,
        onOpen,
        onEscape,
      } = latest.current
      if (!enabled || isEditableTarget(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onEscape()
        return
      }
      if (!focusedId) return

      if (event.key === 'Enter') {
        event.preventDefault()
        onOpen(focusedId)
        return
      }
      const direction = ARROW_DIRECTIONS[event.key]
      if (!direction) return
      const next = nextNodeInDirection(adjacency, getPositions(), focusedId, direction)
      if (next) {
        event.preventDefault()
        onFocus(next)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
