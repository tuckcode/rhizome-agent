// Arrow-key navigation between connected graph nodes (keyboard-first
// app convention). Latest-ref pattern from useKeyboardNavigation so the
// window listener stays stable across renders.

import { useEffect, useRef } from 'react'
import { nextNodeInDirection, pickGraphStartNode } from '../components/graph/graphData'
import type {
  GraphDirection,
  NodeScreenPosition,
  WikiGraphNode,
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
  nodes: readonly Pick<WikiGraphNode, 'id' | 'linkCount' | 'backlinkCount'>[]
  focusedId: string | null
  /** Screen-projected positions from the canvas (may be empty pre-render). */
  getPositions: () => Map<string, NodeScreenPosition>
  /** Graph host. Arrows and Enter only run when this is the focused surface. */
  getContainer: () => HTMLElement | null
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
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

function isActionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const host = target.closest('button, a, [role="button"], [role="link"], [role="menuitem"], [role="radio"]')
  return host != null
}

function eventInDialog(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]') != null
}

function eventInGraph(container: HTMLElement | null, event: KeyboardEvent): boolean {
  if (!container) return false
  if (isEditableTarget(event.target)) return false
  const inside = (
    (event.target instanceof Node && container.contains(event.target))
    || document.activeElement === container
  )
  if (!inside) return false
  // Enter on a graph button or link must fire that control. Escape still
  // clears selection / leaves the view.
  if (event.key !== 'Escape' && isActionTarget(event.target)) return false
  return true
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
        nodes,
        focusedId,
        getPositions,
        getContainer,
        onFocus,
        onOpen,
        onEscape,
      } = latest.current
      if (!enabled) return
      if (event.defaultPrevented) return
      if (event.key === 'Escape') {
        if (isEditableTarget(event.target) || eventInDialog(event.target)) return
        event.preventDefault()
        onEscape()
        return
      }
      if (!eventInGraph(getContainer(), event)) return

      if (!focusedId) {
        const direction = ARROW_DIRECTIONS[event.key]
        if (!direction) return
        const start = pickGraphStartNode(nodes, focusedId)
        if (start) {
          event.preventDefault()
          onFocus(start)
        }
        return
      }

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
