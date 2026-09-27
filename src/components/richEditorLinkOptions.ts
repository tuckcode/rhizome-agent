import type { BlockNoteEditorOptions } from '@blocknote/core'

type RichEditorLinkOptions = NonNullable<BlockNoteEditorOptions<never, never, never>['links']>

/**
 * BlockNote opens a clicked link with window.open unless links.onClick
 * handles it. Returning false leaves the click to useEditorLinkActivation,
 * which opens links through the guarded native opener.
 */
export const RICH_EDITOR_LINK_OPTIONS: RichEditorLinkOptions = {
  onClick: () => false,
}
