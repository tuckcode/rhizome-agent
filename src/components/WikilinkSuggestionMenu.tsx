import type { ComponentType, SVGAttributes } from 'react'
import { NoteSearchList } from './NoteSearchList'
import type { WorkspaceIdentity } from '../types'
import './WikilinkSuggestionMenu.css'

export interface WikilinkSuggestionItem {
  title: string
  onItemClick: () => void
  noteType?: string
  typeColor?: string
  typeLightColor?: string
  TypeIcon?: ComponentType<SVGAttributes<SVGSVGElement>>
  aliases?: string[]
  entryTitle?: string
  path?: string
  workspace?: WorkspaceIdentity | null
}

interface WikilinkSuggestionMenuProps {
  items: WikilinkSuggestionItem[]
  loadingState: 'loading-initial' | 'loading' | 'loaded'
  selectedIndex: number | undefined
  onItemClick?: (item: WikilinkSuggestionItem) => void
}

function runSuggestionItemClickOnce(
  item: WikilinkSuggestionItem,
  onItemClick?: (item: WikilinkSuggestionItem) => void,
): void {
  let itemActionRan = false
  const runItemAction = () => {
    itemActionRan = true
    item.onItemClick()
  }

  if (onItemClick) {
    onItemClick({ ...item, onItemClick: runItemAction })
  }

  if (!itemActionRan) runItemAction()
}

export function WikilinkSuggestionMenu({ items, selectedIndex, onItemClick }: WikilinkSuggestionMenuProps) {
  return (
    <div className="wikilink-menu">
        <NoteSearchList
          items={items}
          selectedIndex={selectedIndex ?? 0}
          getItemKey={(item, i) => `${item.title}-${item.path ?? i}`}
          onItemClick={(item) => runSuggestionItemClickOnce(item, onItemClick)}
          activateOnMouseDown
          emptyMessage="No results"
        />
    </div>
  )
}
