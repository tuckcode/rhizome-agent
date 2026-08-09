import type { Model } from '@ironcalc/workbook'
import type { VaultEntry } from '../types'
import { parseSheetMarkdownCell } from './sheetMarkdownCell'
import {
  firstSheetWikilinkTarget,
  sheetCellContainsPlainWikilink,
  sheetWikilinkColor,
  sheetWikilinkDisplayValue,
} from './sheetWikilinks'

export const SHEET_WIKILINK_FONT_COLOR = '#155dff'

const SHEET_WIKILINK_FORMATTED_VALUE_BRIDGE = Symbol('sheetWikilinkFormattedValueBridge')

type SheetWikilinkFormattedValueBridgeState = {
  [SHEET_WIKILINK_FORMATTED_VALUE_BRIDGE]?: Model['getFormattedCellValue']
}

export function sheetWikilinkFormattedValueKey(sheet: number, row: number, column: number): string {
  return `${sheet}:${row}:${column}`
}

function resolveCssColorLiteral(value: string, fallback: string): string {
  const variableMatch = value.match(/^var\((--[^,\s)]+)(?:,\s*([^)]+))?\)$/)
  if (!variableMatch || typeof window === 'undefined') return value

  const variableName = variableMatch[1]
  const inlineFallback = variableMatch[2]?.trim()
  const resolved = window.getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
    || window.getComputedStyle(document.body).getPropertyValue(variableName).trim()
  return resolved || inlineFallback || fallback
}

export function sheetWikilinkCanvasColor(
  value: string,
  entries: VaultEntry[],
  sourceEntry: VaultEntry | null | undefined,
): string {
  return resolveCssColorLiteral(
    sheetWikilinkColor(value, entries, sourceEntry, SHEET_WIKILINK_FONT_COLOR),
    SHEET_WIKILINK_FONT_COLOR,
  )
}

export function applySheetWikilinkStyle(
  model: Model,
  area: { sheet: number; row: number; column: number; width: number; height: number },
  color = SHEET_WIKILINK_FONT_COLOR,
): void {
  model.updateRangeStyle(area, 'font.color', color)
  model.updateRangeStyle(area, 'font.u', 'true')
}

export function sheetCellWikilinkTarget(
  model: Model,
  sheetIndex: number,
  row: number,
  column: number,
): string | null {
  const content = parseSheetMarkdownCell(model.getCellContent(sheetIndex, row, column)).value
  return sheetCellContainsPlainWikilink(content) ? firstSheetWikilinkTarget(content) : null
}

export function bridgeSheetWikilinkFormattedValues({
  entries,
  formattedValues,
  model,
  sheetIndex,
  sourceEntry,
}: {
  entries: VaultEntry[]
  formattedValues?: ReadonlyMap<string, string>
  model: Model
  sheetIndex: number
  sourceEntry?: VaultEntry | null
}): void {
  const bridgedModel = model as Model & SheetWikilinkFormattedValueBridgeState
  if (bridgedModel[SHEET_WIKILINK_FORMATTED_VALUE_BRIDGE]) return

  const rawGetFormattedCellValue = model.getFormattedCellValue.bind(model)
  const bridgedGetFormattedCellValue: Model['getFormattedCellValue'] = (sheet, row, column) => {
    if (sheet !== sheetIndex) return rawGetFormattedCellValue(sheet, row, column)

    const precomputedValue = formattedValues?.get(sheetWikilinkFormattedValueKey(sheet, row, column))
    if (precomputedValue !== undefined) return precomputedValue

    const formattedValue = rawGetFormattedCellValue(sheet, row, column)
    if (formattedValues && !formattedValue.includes('[[')) return formattedValue

    const rawContent = parseSheetMarkdownCell(model.getCellContent(sheet, row, column)).value
    return sheetCellContainsPlainWikilink(rawContent)
      ? sheetWikilinkDisplayValue(rawContent, entries, sourceEntry)
      : formattedValue
  }

  bridgedModel[SHEET_WIKILINK_FORMATTED_VALUE_BRIDGE] = rawGetFormattedCellValue
  try {
    Object.defineProperty(bridgedModel, 'getFormattedCellValue', {
      configurable: true,
      value: bridgedGetFormattedCellValue,
    })
  } catch {
    bridgedModel.getFormattedCellValue = bridgedGetFormattedCellValue
  }
}
