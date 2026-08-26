import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef } from 'react'

const NO_DRAG_SELECTOR = [
  'button',
  'input',
  'select',
  'a',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[data-no-drag]',
].join(', ')

function isDragDisabledTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NO_DRAG_SELECTOR) !== null
}

function performCurrentWindowTitlebarDoubleClick(): Promise<void> {
  return invoke<void>('perform_current_window_titlebar_double_click')
}

/**
 * Returns a mousedown handler that triggers Tauri window drag via startDragging().
 * More reliable than data-tauri-drag-region with titleBarStyle: Overlay in Tauri v2.
 *
 * Drag starts only after the pointer moves. Starting a native drag on the first
 * click of a double-click races maximize/unmaximize and snaps the window back.
 */
type DragRegionMouseEvent = React.MouseEvent | MouseEvent
const TITLEBAR_DOUBLE_CLICK_MS = 500
const TITLEBAR_DOUBLE_CLICK_MIN_MS = 40
const TITLEBAR_ACTION_LOCK_MS = 400
const DRAG_DISTANCE_PX = 4

export function useDragRegion<T extends HTMLElement = HTMLElement>() {
  const dragRegionRef = useRef<T | null>(null)
  const lastBackgroundMouseDownRef = useRef<number | null>(null)
  const lastActionAtRef = useRef<number | null>(null)
  const pendingDragRef = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)

  const onMouseDown = useCallback((e: DragRegionMouseEvent) => {
    if (e.button !== 0) return
    if (isDragDisabledTarget(e.target)) return
    e.preventDefault()
    e.stopPropagation()

    const now = Date.now()
    const previous = lastBackgroundMouseDownRef.current
    const elapsed = previous === null ? Number.POSITIVE_INFINITY : now - previous
    const nativeDoubleClick = 'detail' in e && e.detail >= 2
    const repeatedBackgroundClick =
      elapsed >= TITLEBAR_DOUBLE_CLICK_MIN_MS &&
      elapsed <= TITLEBAR_DOUBLE_CLICK_MS

    if (nativeDoubleClick || repeatedBackgroundClick) {
      lastBackgroundMouseDownRef.current = null
      pendingDragRef.current = null
      if (lastActionAtRef.current !== null && now - lastActionAtRef.current < TITLEBAR_ACTION_LOCK_MS) {
        return
      }
      lastActionAtRef.current = now
      void performCurrentWindowTitlebarDoubleClick().catch(() => {})
      return
    }

    lastBackgroundMouseDownRef.current = now
    pendingDragRef.current = { x: e.clientX, y: e.clientY }
    draggingRef.current = false
  }, [])

  useEffect(() => {
    const element = dragRegionRef.current

    const onMouseMove = (event: MouseEvent) => {
      const pending = pendingDragRef.current
      if (!pending || draggingRef.current) return
      const deltaX = event.clientX - pending.x
      const deltaY = event.clientY - pending.y
      if ((deltaX * deltaX) + (deltaY * deltaY) < DRAG_DISTANCE_PX * DRAG_DISTANCE_PX) return
      pendingDragRef.current = null
      draggingRef.current = true
      void getCurrentWindow().startDragging().catch(() => {})
    }

    const onMouseUp = () => {
      pendingDragRef.current = null
      draggingRef.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    element?.addEventListener('mousedown', onMouseDown)
    return () => {
      element?.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseDown])

  return { dragRegionRef, onMouseDown }
}
