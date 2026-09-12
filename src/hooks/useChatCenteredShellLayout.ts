import { useCallback, useMemo, useState, type RefObject } from 'react'
import { useChatNoteSplit, type ChatNoteSplit } from '../components/chatNoteSplit'
import {
  bumpViewModeToOpenNotes,
  resolveShellLayout,
  viewModeAfterCollapseNotes,
  viewModeAfterToggleBrowse,
  type ShellKind,
  type ShellLayoutState,
} from '../lib/shellLayout'
import { useShellCompactLayout } from './useShellCompactLayout'
import type { ViewMode } from './useViewMode'

export type ChatCenteredShellLayout = ShellLayoutState & {
  shellRef: RefObject<HTMLDivElement | null>
  openNotes: () => void
  collapseNotes: () => void
  toggleBrowse: () => void
  ensureNotesOpen: () => void
  setSplit: (next: ChatNoteSplit) => void
}

interface UseChatCenteredShellLayoutArgs {
  kind: ShellKind
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  noteOpen: boolean
  inspectorOpen: boolean
  hideNotesForCanvas: boolean
  chatDestination?: boolean
}

/**
 * Owns persistence remaps, compact, the restore strip, and rail pressed state
 * for the Chat-centered shell. Classic shell uses the same discriminant.
 */
export function useChatCenteredShellLayout({
  kind,
  viewMode,
  setViewMode,
  noteOpen,
  inspectorOpen,
  hideNotesForCanvas,
  chatDestination = false,
}: UseChatCenteredShellLayoutArgs): ChatCenteredShellLayout {
  const { split, setSplit: persistSplit } = useChatNoteSplit()
  const { shellRef, width } = useShellCompactLayout(kind === 'chat-centered', false, inspectorOpen)
  const [compactVaultPanelOpen, setCompactVaultPanelOpen] = useState(false)

  const layout = useMemo(
    () => resolveShellLayout({
      kind,
      viewMode,
      split,
      noteOpen,
      shellWidth: width,
      inspectorOpen,
      compactVaultPanelOpen,
      hideNotesForCanvas,
      chatDestination,
    }),
    [
      chatDestination,
      compactVaultPanelOpen,
      hideNotesForCanvas,
      inspectorOpen,
      kind,
      noteOpen,
      split,
      viewMode,
      width,
    ],
  )

  const ensureNotesOpen = useCallback(() => {
    const nextMode = bumpViewModeToOpenNotes(viewMode)
    if (nextMode !== viewMode) setViewMode(nextMode)
    setCompactVaultPanelOpen(true)
  }, [setViewMode, viewMode])

  const openNotes = ensureNotesOpen

  const collapseNotes = useCallback(() => {
    setCompactVaultPanelOpen(false)
    setViewMode(viewModeAfterCollapseNotes())
  }, [setViewMode])

  const toggleBrowse = useCallback(() => {
    setViewMode(viewModeAfterToggleBrowse(viewMode === 'all'))
  }, [setViewMode, viewMode])

  const setSplit = useCallback((next: ChatNoteSplit) => {
    persistSplit(next)
    if (next === 'side-by-side') setCompactVaultPanelOpen(false)
  }, [persistSplit])

  return {
    ...layout,
    shellRef,
    openNotes,
    collapseNotes,
    toggleBrowse,
    ensureNotesOpen,
    setSplit,
  }
}
