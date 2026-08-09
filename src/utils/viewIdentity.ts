import type { SidebarSelection, ViewFile } from '../types'

export function viewIdentityKey(view: ViewFile): string {
  return `${view.rootPath ?? ''}\n${view.filename}`
}

export function viewSelectionForView(view: ViewFile): SidebarSelection {
  return view.rootPath
    ? { kind: 'view', filename: view.filename, rootPath: view.rootPath }
    : { kind: 'view', filename: view.filename }
}

export function viewMatchesSelection(view: ViewFile, selection: SidebarSelection): boolean {
  if (selection.kind !== 'view') return false
  return view.filename === selection.filename && (view.rootPath ?? '') === (selection.rootPath ?? '')
}

export function viewVaultPath(view: ViewFile, fallbackVaultPath: string): string {
  return view.rootPath ?? fallbackVaultPath
}
