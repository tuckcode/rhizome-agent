import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOTES_HOVER_CLOSE_DELAY_MS,
  RAIL_COLLAPSED_WIDTH_PX,
  RAIL_HOVER_OPEN_DELAY_MS,
} from '../lib/railChrome'

export interface UseHoverExpandPanelOptions {
  /** Auto mode only. Rail and Open never hover-expand. */
  enabled: boolean
  peerOverlaying?: boolean
  menuOpen?: boolean
  openDelayMs?: number
  closeDelayMs?: number
  collapsedWidth?: number
  onOverlayingChange?: (overlaying: boolean) => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * CommandRail hover: open after 150ms, close after the pointer leaves,
 * stay open while focus is inside. Notes Auto adds menu-open and typing.
 */
export function useHoverExpandPanel({
  enabled,
  peerOverlaying = false,
  menuOpen = false,
  openDelayMs = RAIL_HOVER_OPEN_DELAY_MS,
  closeDelayMs = NOTES_HOVER_CLOSE_DELAY_MS,
  collapsedWidth = RAIL_COLLAPSED_WIDTH_PX,
  onOverlayingChange,
}: UseHoverExpandPanelOptions) {
  const panelRef = useRef<HTMLDivElement>(null)
  const modeButtonRef = useRef<HTMLButtonElement>(null)
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const [keyboardExpanded, setKeyboardExpanded] = useState(false)
  const [prevEnabled, setPrevEnabled] = useState(enabled)
  const [prevPeerOverlaying, setPrevPeerOverlaying] = useState(peerOverlaying)
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled)
    if (!enabled) {
      setHoverExpanded(false)
      setKeyboardExpanded(false)
    }
  }
  if (peerOverlaying !== prevPeerOverlaying) {
    setPrevPeerOverlaying(peerOverlaying)
    if (peerOverlaying) {
      setHoverExpanded(false)
      setKeyboardExpanded(false)
    }
  }
  const suppressHoverRef = useRef(false)
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingRef = useRef(false)

  const cancelPendingHoverOpen = useCallback(() => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current)
    hoverOpenTimer.current = null
  }, [])

  const cancelPendingHoverClose = useCallback(() => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current)
    hoverCloseTimer.current = null
  }, [])

  const expanded = enabled && (hoverExpanded || keyboardExpanded)
  const overlaying = expanded

  useEffect(() => {
    onOverlayingChange?.(overlaying)
  }, [overlaying, onOverlayingChange])

  const keepOpen = useCallback(() => {
    const panel = panelRef.current
    const focusHeld = Boolean(
      document.activeElement instanceof Node && panel?.contains(document.activeElement),
    )
    const typing = typingRef.current || isEditableTarget(document.activeElement)
    return focusHeld || menuOpen || typing
  }, [menuOpen])

  const openFromHover = useCallback(() => {
    cancelPendingHoverClose()
    if (
      !enabled
      || peerOverlaying
      || suppressHoverRef.current
      || hoverExpanded
      || keyboardExpanded
      || hoverOpenTimer.current
    ) return
    hoverOpenTimer.current = setTimeout(() => {
      setHoverExpanded(true)
      hoverOpenTimer.current = null
    }, openDelayMs)
  }, [
    cancelPendingHoverClose,
    enabled,
    hoverExpanded,
    keyboardExpanded,
    openDelayMs,
    peerOverlaying,
  ])

  const collapse = useCallback((returnFocus = false) => {
    suppressHoverRef.current = true
    cancelPendingHoverOpen()
    cancelPendingHoverClose()
    setHoverExpanded(false)
    setKeyboardExpanded(false)
    typingRef.current = false
    if (returnFocus) modeButtonRef.current?.focus()
  }, [cancelPendingHoverClose, cancelPendingHoverOpen])

  const expandFromFocus = useCallback(() => {
    if (!enabled || peerOverlaying) return
    cancelPendingHoverOpen()
    setKeyboardExpanded(true)
  }, [cancelPendingHoverOpen, enabled, peerOverlaying])

  useEffect(() => {
    if (!hoverExpanded || !enabled) return

    const trackPointer = (event: MouseEvent) => {
      const panel = panelRef.current
      const bounds = panel?.getBoundingClientRect()
      const overCollapsedStrip = Boolean(
        bounds
        && event.clientX >= bounds.left
        && event.clientX <= bounds.left + collapsedWidth
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom,
      )
      const overChrome = Boolean(event.target instanceof Node && panel?.contains(event.target))
      const pointerInside = overCollapsedStrip || overChrome || keepOpen()

      if (pointerInside) {
        cancelPendingHoverClose()
        return
      }

      if (hoverCloseTimer.current) return
      hoverCloseTimer.current = setTimeout(() => {
        setHoverExpanded(false)
        hoverCloseTimer.current = null
      }, closeDelayMs)
    }

    window.addEventListener('mousemove', trackPointer)
    return () => window.removeEventListener('mousemove', trackPointer)
  }, [cancelPendingHoverClose, closeDelayMs, collapsedWidth, enabled, hoverExpanded, keepOpen])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return
      if (isEditableTarget(event.target)) typingRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isEditableTarget(event.target)) typingRef.current = false
    }
    panel.addEventListener('keydown', onKeyDown)
    panel.addEventListener('keyup', onKeyUp)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
      panel.removeEventListener('keyup', onKeyUp)
    }
  }, [enabled])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      collapse(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [collapse, expanded])

  useEffect(() => () => {
    cancelPendingHoverOpen()
    cancelPendingHoverClose()
  }, [cancelPendingHoverClose, cancelPendingHoverOpen])

  const onMouseEnter = () => {
    if (peerOverlaying) return
    openFromHover()
  }
  const onMouseLeave = () => {
    suppressHoverRef.current = false
    cancelPendingHoverOpen()
  }
  const onFocusCapture = () => {
    expandFromFocus()
  }

  return {
    panelRef,
    modeButtonRef,
    expanded,
    overlaying,
    hoverExpanded,
    keyboardExpanded,
    openFromHover,
    collapse,
    expandFromFocus,
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
  }
}
