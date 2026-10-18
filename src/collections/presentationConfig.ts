import type { ViewDefinition } from '../types'
import { SUGGESTED_STATUSES } from '../utils/statusStyles'
import {
  BOARD_GROUP_BY,
  COLLECTION_PRESENTATION_BOARD,
  COLLECTION_PRESENTATION_LIST,
  type BoardCollectionPresentationConfig,
  type CollectionPresentationConfig,
  type ListCollectionPresentationConfig,
} from './collectionTypes'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function listPresentation(source: UnknownRecord, fallback: ListCollectionPresentationConfig): ListCollectionPresentationConfig {
  return {
    type: COLLECTION_PRESENTATION_LIST,
    sort: nullableString(source.sort) ?? fallback.sort,
    properties: stringArray(source.properties).length > 0 ? stringArray(source.properties) : fallback.properties,
  }
}

/** Trimmed, deduped without regard to case. Empty: the suggested statuses. */
function boardColumns(value: unknown): string[] {
  const columns: string[] = []
  for (const item of stringArray(value)) {
    const name = item.trim()
    if (name && !columns.some((column) => column.toLowerCase() === name.toLowerCase())) columns.push(name)
  }
  return columns.length > 0 ? columns : [...SUGGESTED_STATUSES]
}

function isBoardType(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === COLLECTION_PRESENTATION_BOARD
}

function isStatusGroup(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && ['Status', 'status'].includes(value.trim()))
}

/** A board config, or null when the view should show as a list. */
function boardPresentation(source: UnknownRecord): BoardCollectionPresentationConfig | null {
  if (!isBoardType(source.type) || !isStatusGroup(source.groupBy)) return null
  return { type: COLLECTION_PRESENTATION_BOARD, groupBy: BOARD_GROUP_BY, columns: boardColumns(source.columns) }
}

export function defaultListPresentation(): ListCollectionPresentationConfig {
  return { type: COLLECTION_PRESENTATION_LIST, sort: null, properties: [] }
}

export function presentationFromViewDefinition(definition: ViewDefinition): CollectionPresentationConfig {
  const fallback: ListCollectionPresentationConfig = {
    type: COLLECTION_PRESENTATION_LIST,
    sort: nullableString(definition.sort),
    properties: stringArray(definition.listPropertiesDisplay),
  }
  const rawPresentation = Reflect.get(definition as unknown as UnknownRecord, 'presentation')
  if (!isRecord(rawPresentation)) return fallback
  if (rawPresentation.type === COLLECTION_PRESENTATION_LIST) return listPresentation(rawPresentation, fallback)
  // A malformed board config falls back to list, so the view stays visible.
  return boardPresentation(rawPresentation) ?? fallback
}
