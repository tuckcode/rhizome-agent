import { isStaleBlockReferenceError } from './richEditorTransformErrorRecoveryExtension'
import type { CollapsibleBlock } from './rhizomeCollapsedSections'
import type { RhizomeBlockNoteEditor } from './rhizomeBlockNoteDom'

export type RhizomeBlock = NonNullable<ReturnType<RhizomeBlockNoteEditor['getBlock']>>
export type SideMenuBlock = {
  children?: CollapsibleBlock[]
  content?: unknown
  id: string
  props?: Record<string, unknown>
  type: string
}

type BlockTree = {
  children: readonly BlockTree[]
  id: string
}

export function liveSideMenuBlock(
  editor: RhizomeBlockNoteEditor,
  block: { id: string } | undefined,
) {
  if (!block) return undefined
  try {
    return editor.getBlock(block.id)
  } catch (error) {
    if (isStaleBlockReferenceError(error)) {
      console.warn('[editor] Ignored stale block side-menu lookup:', error)
      return undefined
    }
    throw error
  }
}

export function runSideMenuAction(action: () => void) {
  try {
    action()
  } catch (error) {
    if (isStaleBlockReferenceError(error)) {
      console.warn('[editor] Ignored stale block side-menu action:', error)
      return
    }
    throw error
  }
}

export function hasChildBlock(block: BlockTree, blockId: string): boolean {
  for (const child of block.children) {
    if (child.id === blockId || hasChildBlock(child, blockId)) return true
  }

  return false
}
