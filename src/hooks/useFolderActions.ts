import type { FolderNode, SidebarSelection, VaultEntry } from '../types'
import type { FolderTab } from './folder-actions/folderActionUtils'
import { useFolderDelete } from './folder-actions/useFolderDelete'
import { useFolderRename } from './folder-actions/useFolderRename'

interface UseFolderActionsInput {
  vaultPath: string
  selection: SidebarSelection
  setSelection: (selection: SidebarSelection) => void
  setTabs: React.Dispatch<React.SetStateAction<FolderTab[]>>
  activeTabPathRef: React.MutableRefObject<string | null>
  handleSwitchTab: (path: string) => void
  closeAllTabs: () => void
  reloadVault: () => Promise<VaultEntry[]>
  reloadFolders: () => Promise<FolderNode[]>
  setToastMessage: (message: string | null) => void
}

export function useFolderActions({
  vaultPath,
  selection,
  setSelection,
  setTabs,
  activeTabPathRef,
  handleSwitchTab,
  closeAllTabs,
  reloadVault,
  reloadFolders,
  setToastMessage,
}: UseFolderActionsInput) {
  const renameActions = useFolderRename({
    activeTabPathRef,
    handleSwitchTab,
    reloadFolders,
    reloadVault,
    selection,
    setSelection,
    setTabs,
    setToastMessage,
    vaultPath,
  })
  const deleteActions = useFolderDelete({
    activeTabPathRef,
    clearFolderRename: renameActions.cancelFolderRename,
    closeAllTabs,
    reloadFolders,
    reloadVault,
    selection,
    setSelection,
    setTabs,
    setToastMessage,
    vaultPath,
  })

  return {
    ...renameActions,
    ...deleteActions,
  }
}
