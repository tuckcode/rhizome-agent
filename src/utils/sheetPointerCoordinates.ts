import type { PointerEvent as ReactPointerEvent } from 'react'
import { getDocumentZoom } from '../extensions/zoomCursorFix'

const MIN_ZOOM_DELTA = 0.001
const SHEET_POINTER_COORDINATES_PATCHED = Symbol('sheetPointerCoordinatesPatched')
const SHEET_POINTER_COORDINATES_PATCH = Symbol('sheetPointerCoordinatesPatch')

interface SheetPointerCoordinates {
  clientX: number
  clientY: number
  pageX: number
  pageY: number
}

type SheetPointerCoordinatePatchState = {
  [SHEET_POINTER_COORDINATES_PATCH]?: SheetPointerCoordinates
  [SHEET_POINTER_COORDINATES_PATCHED]?: true
}

export function sheetCoordinateOrigin(container: HTMLDivElement): HTMLElement {
  return container.querySelector<HTMLElement>('.sheet-container canvas') ?? container
}

export function elementCoordinateScale(element: HTMLElement, rect: DOMRect, zoom: number): { x: number; y: number } {
  const widthScale = element.clientWidth > 0 && rect.width > 0
    ? element.clientWidth / rect.width
    : 1 / zoom
  const heightScale = element.clientHeight > 0 && rect.height > 0
    ? element.clientHeight / rect.height
    : 1 / zoom

  return {
    x: Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1,
    y: Number.isFinite(heightScale) && heightScale > 0 ? heightScale : 1,
  }
}

export function localElementCoordinate(coordinate: number, rect: DOMRect, scale: number, axis: 'x' | 'y'): number {
  const origin = axis === 'x' ? rect.left || rect.x : rect.top || rect.y
  return (coordinate - origin) * scale
}

function overrideEventCoordinate(
  event: SheetPointerCoordinates,
  property: keyof SheetPointerCoordinates,
  value: number,
): void {
  try {
    Object.defineProperty(event, property, {
      configurable: true,
      get: () => value,
    })
  } catch {
    // Some browser event implementations expose read-only, non-configurable coordinates.
  }
}

function applyEventCoordinatePatch(event: SheetPointerCoordinates, coordinates: SheetPointerCoordinates): void {
  overrideEventCoordinate(event, 'clientX', coordinates.clientX)
  overrideEventCoordinate(event, 'clientY', coordinates.clientY)
  overrideEventCoordinate(event, 'pageX', coordinates.pageX)
  overrideEventCoordinate(event, 'pageY', coordinates.pageY)
}

function markSheetPointerEventCoordinatesPatched(
  event: SheetPointerCoordinates,
  coordinates: SheetPointerCoordinates,
): void {
  try {
    Object.defineProperty(event, SHEET_POINTER_COORDINATES_PATCH, {
      configurable: true,
      value: coordinates,
    })
    Object.defineProperty(event, SHEET_POINTER_COORDINATES_PATCHED, {
      configurable: true,
      value: true,
    })
  } catch {
    const patchState = event as SheetPointerCoordinatePatchState
    patchState[SHEET_POINTER_COORDINATES_PATCH] = coordinates
    patchState[SHEET_POINTER_COORDINATES_PATCHED] = true
  }
}

function sheetPointerEventCoordinatesWerePatched(event: SheetPointerCoordinates): boolean {
  return (event as SheetPointerCoordinatePatchState)[SHEET_POINTER_COORDINATES_PATCHED] === true
}

function sheetPointerEventCoordinatePatch(event: SheetPointerCoordinates): SheetPointerCoordinates | null {
  return (event as SheetPointerCoordinatePatchState)[SHEET_POINTER_COORDINATES_PATCH] ?? null
}

function scaledElementCoordinate(coordinate: number, origin: number, scale: number): number {
  return origin + ((coordinate - origin) * scale)
}

export function patchSheetPointerEventCoordinates(
  event: SheetPointerCoordinates,
  container: HTMLDivElement,
): boolean {
  if (sheetPointerEventCoordinatesWerePatched(event)) return false

  const zoom = getDocumentZoom()
  if (Math.abs(zoom - 1) < MIN_ZOOM_DELTA) return false
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false

  const originElement = sheetCoordinateOrigin(container)
  const originRect = originElement.getBoundingClientRect()
  const scale = elementCoordinateScale(originElement, originRect, zoom)
  const originLeft = originRect.left || originRect.x
  const originTop = originRect.top || originRect.y
  const clientX = scaledElementCoordinate(event.clientX, originLeft, scale.x)
  const clientY = scaledElementCoordinate(event.clientY, originTop, scale.y)
  const coordinates = {
    clientX,
    clientY,
    pageX: clientX + window.scrollX,
    pageY: clientY + window.scrollY,
  }
  applyEventCoordinatePatch(event, coordinates)
  markSheetPointerEventCoordinatesPatched(event, coordinates)
  return true
}

export function patchReactSheetPointerEvent(
  event: ReactPointerEvent<HTMLDivElement>,
  container: HTMLDivElement | null,
): void {
  if (!container) return
  const nativeCoordinates = sheetPointerEventCoordinatePatch(event.nativeEvent)
  if (nativeCoordinates) {
    applyEventCoordinatePatch(event, nativeCoordinates)
    markSheetPointerEventCoordinatesPatched(event, nativeCoordinates)
    return
  }

  patchSheetPointerEventCoordinates(event, container)
  patchSheetPointerEventCoordinates(event.nativeEvent, container)
}
