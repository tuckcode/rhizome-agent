import type { FilterGroup, SidebarSelection, VaultEntry, ViewFile } from '../types'

export const COLLECTION_PRESENTATION_LIST = 'list'
export const COLLECTION_PRESENTATION_BOARD = 'board'
/** The only property a board groups by. */
export const BOARD_GROUP_BY = 'Status'

export interface ListCollectionPresentationConfig {
  type: typeof COLLECTION_PRESENTATION_LIST
  sort: string | null
  properties: string[]
}

/**
 * Frozen board schema, the same as the Rust `Presentation`:
 * `presentation: {type: board, groupBy: Status, columns: [...]}`.
 */
export interface BoardCollectionPresentationConfig {
  type: typeof COLLECTION_PRESENTATION_BOARD
  groupBy: typeof BOARD_GROUP_BY
  columns: string[]
}

export type CollectionPresentationConfig =
  | ListCollectionPresentationConfig
  | BoardCollectionPresentationConfig

export type CollectionOrigin = 'builtin' | 'type' | 'folder' | 'saved-view' | 'neighborhood'

export interface CollectionDefinition {
  id: string
  label: string
  origin: CollectionOrigin
  selection: SidebarSelection
  presentation: CollectionPresentationConfig
  filter?: FilterGroup
  entry?: VaultEntry
  view?: ViewFile
}
