import {
  useCallback,
  useLayoutEffect,
  type CSSProperties,
  type RefObject,
} from 'react'

const DEFAULT_DROPDOWN_MARGIN = 8
const DEFAULT_DROPDOWN_OFFSET = 4

export interface AnchoredDropdownPosition {
  left: number
  top: number
  maxHeight?: number
}

export interface AnchoredDropdownViewport {
  width: number
  height: number
}

export interface AnchoredDropdownOptions {
  width: number
  maxHeight?: number
  minHeight?: number
  offset?: number
  viewportPadding?: number
}

export type AnchoredDropdownAnchorElement = 'self' | 'parent'

export function getAnchoredDropdownLeft(
  anchorRight: number,
  dropdownWidth: number,
  viewportWidth: number,
  margin = DEFAULT_DROPDOWN_MARGIN,
) {
  const rightAlignedLeft = anchorRight - dropdownWidth
  const minLeft = margin
  const maxLeft = viewportWidth - dropdownWidth - margin
  if (maxLeft < minLeft) return minLeft
  return Math.min(Math.max(rightAlignedLeft, minLeft), maxLeft)
}

function getViewport(): AnchoredDropdownViewport {
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  }
}

export function resolveAnchoredDropdownPosition(
  anchorRect: DOMRectReadOnly,
  {
    width,
    maxHeight,
    minHeight,
    offset = DEFAULT_DROPDOWN_OFFSET,
    viewportPadding = DEFAULT_DROPDOWN_MARGIN,
  }: AnchoredDropdownOptions,
  viewport = getViewport(),
): AnchoredDropdownPosition {
  const left = getAnchoredDropdownLeft(anchorRect.right, width, viewport.width, viewportPadding)
  const belowTop = anchorRect.bottom + offset

  if (maxHeight === undefined) {
    const maxTop = Math.max(viewportPadding, viewport.height - viewportPadding)
    return { left, top: Math.min(Math.max(viewportPadding, belowTop), maxTop) }
  }

  const availableBelow = viewport.height - belowTop - viewportPadding
  const availableAbove = anchorRect.top - viewportPadding - offset
  const openAbove = minHeight !== undefined && availableBelow < minHeight && availableAbove > availableBelow
  const availableHeight = openAbove ? availableAbove : availableBelow
  const viewportBoundedMinHeight = Math.min(
    minHeight ?? 0,
    Math.max(0, viewport.height - (viewportPadding * 2)),
  )
  const resolvedMaxHeight = Math.max(viewportBoundedMinHeight, Math.min(maxHeight, availableHeight))
  const top = openAbove
    ? Math.max(viewportPadding, anchorRect.top - offset - resolvedMaxHeight)
    : Math.min(belowTop, viewport.height - viewportPadding - resolvedMaxHeight)

  return { left, top, maxHeight: resolvedMaxHeight }
}

function getAnchorElement(
  anchorRef: RefObject<HTMLElement | null>,
  anchorElement: AnchoredDropdownAnchorElement,
) {
  const current = anchorRef.current
  if (!current) return null
  return anchorElement === 'parent' ? current.parentElement : current
}

export function getAnchoredDropdownStyle(
  position: AnchoredDropdownPosition | null,
  width: number,
): CSSProperties {
  return {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    width,
    maxHeight: position?.maxHeight,
    visibility: position ? 'visible' : 'hidden',
  }
}

export function useAnchoredDropdownPosition({
  anchorRef,
  dropdownRef,
  anchorElement = 'self',
  open = true,
  width,
  maxHeight,
  minHeight,
  offset,
  viewportPadding,
}: AnchoredDropdownOptions & {
  anchorRef: RefObject<HTMLElement | null>
  dropdownRef: RefObject<HTMLElement | null>
  anchorElement?: AnchoredDropdownAnchorElement
  open?: boolean
}) {
  const updatePosition = useCallback(() => {
    const anchor = getAnchorElement(anchorRef, anchorElement)
    const dropdown = dropdownRef.current
    if (!anchor || !dropdown) return

    const position = resolveAnchoredDropdownPosition(anchor.getBoundingClientRect(), {
      width,
      maxHeight,
      minHeight,
      offset,
      viewportPadding,
    })

    dropdown.style.left = `${position.left}px`
    dropdown.style.top = `${position.top}px`
    dropdown.style.width = `${width}px`
    dropdown.style.visibility = 'visible'
    if (position.maxHeight === undefined) {
      dropdown.style.removeProperty('max-height')
    } else {
      dropdown.style.maxHeight = `${position.maxHeight}px`
    }
  }, [anchorElement, anchorRef, dropdownRef, maxHeight, minHeight, offset, viewportPadding, width])

  useLayoutEffect(() => {
    if (!open) return

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  return { updatePosition }
}
