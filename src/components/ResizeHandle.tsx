import { useCallback, useEffect, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  /**
   * Which edge of the panel the handle straddles. A `leading` handle sits on
   * the panel's right edge, so dragging right widens it. A `trailing` handle
   * sits on the left edge of a right-docked panel, where the same drag has to
   * mean the opposite — otherwise the sidebar shrinks as you pull it wider.
   */
  edge?: 'leading' | 'trailing'
  /**
   * `flow` (default) is a flex sibling between columns. `absolute` sits on
   * the panel's own edge so an overlay still has a handle — compact Notes
   * is position:absolute, so a flex sibling would not line up with it.
   */
  placement?: 'flow' | 'absolute'
  label?: string
  testId?: string
}

function handleClassName(edge: 'leading' | 'trailing', placement: 'flow' | 'absolute'): string {
  // w-4 is 14px at this app's 14px root — the 12px floor from the UI audit.
  // w-1 (the old 4px strip) took three attempts to grab.
  const hit =
    'z-30 w-4 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--border)]'
  if (placement === 'absolute') {
    const inset = edge === 'trailing' ? '-left-[10px]' : '-right-[10px]'
    return `absolute inset-y-0 ${inset} ${hit}`
  }
  const overlap = edge === 'trailing' ? '-mr-2' : '-ml-2'
  return `relative ${overlap} shrink-0 self-stretch ${hit}`
}

export function ResizeHandle({
  onResize,
  edge = 'leading',
  placement = 'flow',
  label,
  testId,
}: ResizeHandleProps) {
  const direction = edge === 'trailing' ? -1 : 1
  const handleRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const pendingDelta = useRef(0)
  const rafId = useRef(0)

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      lastX.current = e.clientX
      pendingDelta.current = 0
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      pendingDelta.current += (e.clientX - lastX.current) * direction
      lastX.current = e.clientX

      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          if (pendingDelta.current !== 0) {
            onResize(pendingDelta.current)
            pendingDelta.current = 0
          }
          rafId.current = 0
        })
      }
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
          rafId.current = 0
        }
        if (pendingDelta.current !== 0) {
          onResize(pendingDelta.current)
          pendingDelta.current = 0
        }
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [onResize, direction])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.addEventListener('mousedown', handleMouseDown)
    return () => handle.removeEventListener('mousedown', handleMouseDown)
  }, [handleMouseDown])

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-testid={testId}
      className={handleClassName(edge, placement)}
    />
  )
}
