import { useEffect, useRef, useState } from 'react'
import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SidebarSelection, VaultEntry } from '../types'
import { useFolderActions } from './useFolderActions'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

const { mockInvoke } = await import('../mock-tauri')
const mockInvokeFn = mockInvoke as ReturnType<typeof vi.fn>

const folderEntry: VaultEntry = {
  path: '/vault/projects/note.md',
  filename: 'note.md',
  title: 'Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: null,
  createdAt: null,
  fileSize: 10,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: true,
}

function renderFolderActions({
  initialSelection,
  initialTabs = [{ entry: folderEntry, content: '# Note' }],
  reloadVault,
  reloadFolders,
  setToastMessage,
}: {
  initialSelection: SidebarSelection
  initialTabs?: Array<{ entry: VaultEntry; content: string }>
  reloadVault: ReturnType<typeof vi.fn>
  reloadFolders: ReturnType<typeof vi.fn>
  setToastMessage: ReturnType<typeof vi.fn>
}) {
  return renderHook(() => {
    const [selection, setSelection] = useState<SidebarSelection>(initialSelection)
    const [tabs, setTabs] = useState(initialTabs)
    const [activeTabPath, setActiveTabPath] = useState<string | null>(initialTabs[0]?.entry.path ?? null)
    const activeTabPathRef = useRef(activeTabPath)

    useEffect(() => {
      activeTabPathRef.current = activeTabPath
    }, [activeTabPath])

    const actions = useFolderActions({
      vaultPath: '/vault',
      selection,
      setSelection,
      setTabs,
      activeTabPathRef,
      handleSwitchTab: setActiveTabPath,
      closeAllTabs: () => {
        setTabs([])
        setActiveTabPath(null)
      },
      reloadVault,
      reloadFolders,
      setToastMessage,
    })

    return { actions, selection, tabs, activeTabPath }
  })
}

describe('useFolderActions', () => {
  let reloadVault: ReturnType<typeof vi.fn>
  let reloadFolders: ReturnType<typeof vi.fn>
  let setToastMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockInvokeFn.mockReset()
    reloadVault = vi.fn()
    reloadFolders = vi.fn().mockResolvedValue([])
    setToastMessage = vi.fn()
  })

  it('renames a selected folder and updates selection plus active tab path', async () => {
    const renamedEntry = { ...folderEntry, path: '/vault/work/note.md' }
    reloadVault.mockResolvedValue([renamedEntry])
    mockInvokeFn.mockResolvedValue({ old_path: 'projects', new_path: 'work' })

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects' },
      reloadVault,
      reloadFolders,
      setToastMessage,
    })

    await act(async () => {
      await result.current.actions.renameFolder('projects', 'work')
    })

    expect(result.current.selection).toEqual({ kind: 'folder', path: 'work' })
    expect(result.current.tabs[0]?.entry.path).toBe('/vault/work/note.md')
    expect(result.current.activeTabPath).toBe('/vault/work/note.md')
    expect(setToastMessage).toHaveBeenCalledWith('Renamed folder to "work"')
  })

  it('deletes a selected folder and clears the active note gracefully', async () => {
    reloadVault.mockResolvedValue([])
    mockInvokeFn.mockResolvedValue('projects')

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects' },
      reloadVault,
      reloadFolders,
      setToastMessage,
    })

    act(() => {
      result.current.actions.requestDeleteFolder('projects')
    })

    await act(async () => {
      await result.current.actions.confirmDeleteSelectedFolder()
    })

    expect(result.current.selection).toEqual({ kind: 'filter', filter: 'all' })
    expect(result.current.tabs).toEqual([])
    expect(result.current.activeTabPath).toBeNull()
    expect(setToastMessage).toHaveBeenCalledWith('Deleted folder "projects"')
  })
})
