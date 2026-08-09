import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Model } from '@ironcalc/workbook'
import { sheetCellWikilinkTarget } from '../utils/sheetWikilinkModelBridge'

interface SheetNavigationWorkbook {
  model: Model
}

interface SheetCellIndexes {
  column: number
  row: number
}

interface SheetWikilinkNavigationOptions {
  cellFromPointer: (
    event: ReactPointerEvent<HTMLDivElement>,
    container: HTMLDivElement,
    model: Model,
  ) => SheetCellIndexes | null
  containerRef: RefObject<HTMLDivElement | null>
  dismissTransientUi: () => void
  onNavigateWikilink?: (target: string) => void
  onBeforeNavigate?: () => void
  sheetIndex: number
  workbookRef: RefObject<SheetNavigationWorkbook | null>
}

function hasFollowModifier(event: ReactPointerEvent<HTMLDivElement>): boolean {
  return event.metaKey || event.ctrlKey
}

export function useSheetWikilinkNavigation({
  cellFromPointer,
  containerRef,
  dismissTransientUi,
  onNavigateWikilink,
  onBeforeNavigate,
  sheetIndex,
  workbookRef,
}: SheetWikilinkNavigationOptions) {
  return useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    const current = workbookRef.current
    if (!container || !current || !onNavigateWikilink || !hasFollowModifier(event)) return false

    const cell = cellFromPointer(event, container, current.model)
    if (!cell) return false

    const target = sheetCellWikilinkTarget(current.model, sheetIndex, cell.row, cell.column)
    if (!target) return false

    event.preventDefault()
    event.stopPropagation()
    onBeforeNavigate?.()
    dismissTransientUi()
    onNavigateWikilink(target)
    return true
  }, [cellFromPointer, containerRef, dismissTransientUi, onBeforeNavigate, onNavigateWikilink, sheetIndex, workbookRef])
}
