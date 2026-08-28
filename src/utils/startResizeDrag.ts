import { type MouseEvent as ReactMouseEvent } from 'react'

/**
 * Drag a divider.
 *
 * Reports deltas rather than absolute positions, so the caller decides what
 * the drag means — left edge or right, width or height. Lives here because
 * both the AI workspace handles and the Chat note pane need it; it was private
 * to `AiWorkspaceResizeHandles` first.
 *
 * The cursor and text-selection overrides are on `document.body` for the
 * duration: without them the pointer flickers back to a text caret the moment
 * it leaves the 4px handle, and dragging selects the transcript behind it.
 */
export function startResizeDrag(
  event: ReactMouseEvent,
  cursor: string,
  onDrag: (deltaX: number, deltaY: number) => void,
) {
  event.preventDefault()
  event.stopPropagation()

  let lastX = event.clientX
  let lastY = event.clientY
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - lastX
    const deltaY = moveEvent.clientY - lastY
    lastX = moveEvent.clientX
    lastY = moveEvent.clientY
    onDrag(deltaX, deltaY)
  }
  const handleMouseUp = () => {
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}
