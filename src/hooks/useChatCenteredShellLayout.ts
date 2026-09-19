import { useCallback } from 'react'
import { useChatNoteSplit } from '../components/chatNoteSplit'
import { bumpViewModeToOpenNotes, viewModeAfterCollapseNotes, viewModeAfterToggleBrowse, resolveShellLayout, type ShellKind } from '../lib/shellLayout'
import { fitPanePreset, resizePresetWidth, type PaneColumn } from '../lib/panePresets'
import { useShellCompactLayout } from './useShellCompactLayout'
import type { useViewMode } from './useViewMode'

type PaneControls = Pick<ReturnType<typeof useViewMode>, 'viewMode' | 'setViewMode' | 'panePreset' | 'setPanePreset' | 'updatePanePreset'>
interface UseChatCenteredShellLayoutArgs extends PaneControls {
  kind: ShellKind
  noteOpen: boolean
  inspectorOpen: boolean
  hideNotesForCanvas: boolean
  chatDestination?: boolean
  railPinned: boolean
}

/** Derive geometry from the one preset. Temporary folds never change persistence. */
export function useChatCenteredShellLayout(args: UseChatCenteredShellLayoutArgs) {
  const { kind, panePreset, setViewMode, updatePanePreset, noteOpen, railPinned, hideNotesForCanvas } = args
  const { shellRef, width } = useShellCompactLayout(kind === 'chat-centered', noteOpen)
  const context = { shellWidth: width, noteOpen, railPinned, hideNotesForCanvas }
  const fit = fitPanePreset(panePreset, context)
  const layout = resolveShellLayout({
    ...args, preset: panePreset, split: fit.split, shellWidth: width, compactVaultPanelOpen: false,
  })
  const ensureNotesOpen = useCallback(() => {
    if (panePreset.id !== 'workbench' && panePreset.id !== 'notes') setViewMode(bumpViewModeToOpenNotes(args.viewMode))
  }, [panePreset.id, args.viewMode, setViewMode])
  const collapseNotes = useCallback(() => setViewMode(viewModeAfterCollapseNotes()), [setViewMode])
  const toggleBrowse = useCallback(() => setViewMode(viewModeAfterToggleBrowse(panePreset.id === 'workbench')), [panePreset.id, setViewMode])
  const { setSplit } = useChatNoteSplit(args)
  const resizeColumn = (column: PaneColumn, delta: number) => {
    updatePanePreset(resizePresetWidth(panePreset, column, fit.widths[column] + delta, context))
  }
  return { ...layout, shellRef, widths: fit.widths, fittedRailPinned: fit.railPinned, resizeColumn, openNotes: ensureNotesOpen, ensureNotesOpen, collapseNotes, toggleBrowse, setSplit }
}
