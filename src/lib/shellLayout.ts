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
import { fitPanePreset, presetFromLegacy, presetToLegacy, type PanePresetState } from './panePresets'
import type { ViewMode } from '../hooks/useViewMode'

export type ShellKind = 'chat-centered' | 'classic'

export type ShellLayoutInput = {
  kind: ShellKind
  preset?: PanePresetState
  railPinned?: boolean
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

export function resolveShellLayout(input: ShellLayoutInput): ShellLayoutState {
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

  const preset = input.preset ?? presetFromLegacy(input.viewMode, input.split)
  const fit = fitPanePreset(preset, { shellWidth: input.shellWidth, noteOpen: input.noteOpen, railPinned: input.railPinned, hideNotesForCanvas: input.hideNotesForCanvas })
  return {
    canvas: 'chat-centered',
    notesOpen: fit.notesOpen,
    browseOpen: fit.browseOpen,
    split: fit.split,
    showRestoreStrip: fit.showRestoreStrip,
    compactSessions: input.railPinned === true && !fit.railPinned,
    compactVaultPanel: presetToLegacy(preset).viewMode !== 'editor-only' && !fit.notesOpen,
    classicSidebarVisible: false,
    classicNoteListVisible: false,
  }
}

/** Inbox / Show Notes / Changes: open the column without collapsing Browse. */
export function bumpViewModeToOpenNotes(viewMode: ViewMode): ViewMode {
  return presetToLegacy({ id: viewMode === 'all' ? 'workbench' : 'notes', widths: {} }).viewMode
}

export function viewModeAfterCollapseNotes(): ViewMode {
  return presetToLegacy({ id: 'chat', widths: {} }).viewMode
}

export function viewModeAfterToggleBrowse(browseOpen: boolean): ViewMode {
  return presetToLegacy({ id: browseOpen ? 'notes' : 'workbench', widths: {} }).viewMode
}
