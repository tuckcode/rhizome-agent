/**
 * Chat-centered shell layout as one decision.
 *
 * Notes-open is a single idea. Callers used to recombine view mode, compact
 * width, Beside, a compact override, and canvas destinations in App. This
 * module owns that conjunction. Persistence stays the existing view-mode
 * contract: editor-only, editor-list, all.
 *
 * C72 policy lives here: Inbox opens Notes and does not close them. Chat stays
 * the canvas. A closed Notes column leaves a restore strip, not an empty edge.
 * ADR-0166 Chat-as-centre is not reopened.
 */

import type { ChatNoteSplit } from '../components/chatNoteSplit'
import { shouldForceChatShellCompact } from '../components/chatNoteSplit'
import { getShellCompactState } from '../hooks/useShellCompactLayout'
import type { ViewMode } from '../hooks/useViewMode'

export type ShellKind = 'chat-centered' | 'classic'

export type ShellLayoutInput = {
  kind: ShellKind
  viewMode: ViewMode
  split: ChatNoteSplit
  noteOpen: boolean
  shellWidth: number | null
  inspectorOpen: boolean
  compactVaultPanelOpen: boolean
  hideNotesForCanvas: boolean
  chatDestination?: boolean
}

export type ShellLayoutState = {
  canvas: ShellKind
  notesOpen: boolean
  browseOpen: boolean
  split: ChatNoteSplit
  showRestoreStrip: boolean
  compactSessions: boolean
  compactVaultPanel: boolean
  classicSidebarVisible: boolean
  classicNoteListVisible: boolean
}

/**
 * Window width must not hide Notes. Beside still folds the columns so Chat
 * keeps a usable centre. The compact observer still measures width for the
 * Sessions column when a future caller turns that path on; Notes stay until
 * the user closes them or chooses Beside.
 */
function widthCompactState(
  kind: ShellKind,
  shellWidth: number | null,
  inspectorOpen: boolean,
) {
  if (kind !== 'chat-centered') {
    return { collapseSessions: false, collapseVaultPanel: false }
  }
  return getShellCompactState(shellWidth, false, inspectorOpen)
}

export function resolveShellLayout(input: ShellLayoutInput): ShellLayoutState {
  const forceCompact = input.kind === 'chat-centered'
    && shouldForceChatShellCompact(input.split, input.noteOpen)
  const widthCompact = widthCompactState(input.kind, input.shellWidth, input.inspectorOpen)
  const compactSessions = forceCompact || widthCompact.collapseSessions
  const compactVaultPanel = forceCompact || widthCompact.collapseVaultPanel

  if (input.kind === 'classic') {
    const chatDestination = input.chatDestination === true
    const notesOpen = !chatDestination && !input.hideNotesForCanvas && input.viewMode !== 'editor-only'
    const browseOpen = !chatDestination && input.viewMode === 'all'
    return {
      canvas: 'classic',
      notesOpen,
      browseOpen,
      split: input.split,
      showRestoreStrip: false,
      compactSessions: false,
      compactVaultPanel: false,
      classicSidebarVisible: browseOpen,
      classicNoteListVisible: notesOpen,
    }
  }

  const persistedOpen = input.viewMode !== 'editor-only'
  const notesOpen = persistedOpen && !input.hideNotesForCanvas && (!compactVaultPanel || input.compactVaultPanelOpen)
  const browseOpen = persistedOpen && input.viewMode === 'all'

  return {
    canvas: 'chat-centered',
    notesOpen,
    browseOpen,
    split: input.split,
    showRestoreStrip: !notesOpen && !input.hideNotesForCanvas,
    compactSessions,
    compactVaultPanel,
    classicSidebarVisible: false,
    classicNoteListVisible: false,
  }
}

/** Inbox / Show Notes / Changes: open the column without collapsing Browse. */
export function bumpViewModeToOpenNotes(viewMode: ViewMode): ViewMode {
  return viewMode === 'editor-only' ? 'editor-list' : viewMode
}

export function viewModeAfterCollapseNotes(): ViewMode {
  return 'editor-only'
}

export function viewModeAfterToggleBrowse(browseOpen: boolean): ViewMode {
  return browseOpen ? 'editor-list' : 'all'
}
