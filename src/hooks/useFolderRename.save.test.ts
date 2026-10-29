import { useEffect, useRef, useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { useFolderRename } from './folder-actions/useFolderRename'
import { AUTO_SAVE_DEBOUNCE_MS } from './useEditorSave'
import { useAppSave } from './useAppSave'
import { isTauri } from '../mock-tauri'
import type { SidebarSelection, VaultEntry } from '../types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  mockInvoke: vi.fn().mockResolvedValue(undefined),
  updateMockContent: vi.fn(),
}))

interface SaveCall {
  command: string
  args?: { path?: string; content?: string }
}

function makeEntry(path: string, filename: string): VaultEntry {
  return {
    path,
    title: filename,
    filename,
    content: '',
    outgoingLinks: [],
    snippet: '',
    wordCount: 0,
    isA: 'Note',
    status: null,
    createdAt: null,
    modifiedAt: null,
    icon: null,
    tags: [],
  } as unknown as VaultEntry
}

function saveCalls(): SaveCall[] {
  return vi.mocked(invoke).mock.calls.map(([command, args]) => ({
    command,
    args: args as SaveCall['args'],
  }))
}

describe('folder rename save path', () => {
  const childPath = '/vault/projects/note.md'
  const movedChildPath = '/vault/work/note.md'
  const outsidePath = '/vault/other.md'
  const pendingBefore = '# Child\n\nPending before rename'
  const pendingOutside = '# Outside\n\nLeave this pending'
  const editedAfter = '# Child\n\nEdited after rename'
  const freshAtOldPath = '# Child\n\nNew note at the old path'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'rename_vault_folder') return { old_path: 'projects', new_path: 'work' }
      return undefined
    })
  })

  function renderRenameSave(options?: {
    onRenameFilename?: (
      path: string,
      newFilenameStem: string,
      vaultPath: string,
      onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
    ) => Promise<void>
  }) {
    const child = makeEntry(childPath, 'note.md')
    const outside = makeEntry(outsidePath, 'other.md')
    const selection: SidebarSelection = { kind: 'folder', path: 'projects' }

    return renderHook(() => {
      const [tabs, setTabs] = useState([
        { entry: child, content: pendingBefore },
        { entry: outside, content: pendingOutside },
      ])
      const [activeTabPath, setActiveTabPath] = useState<string | null>(childPath)
      const activeTabPathRef = useRef(activeTabPath)
      useEffect(() => {
        activeTabPathRef.current = activeTabPath
      }, [activeTabPath])

      const save = useAppSave({
        updateEntry: vi.fn(),
        setTabs,
        handleSwitchTab: setActiveTabPath,
        setToastMessage: vi.fn(),
        loadModifiedFiles: vi.fn(),
        trackUnsaved: vi.fn(),
        clearUnsaved: vi.fn(),
        unsavedPaths: new Set([childPath, outsidePath]),
        tabs,
        activeTabPath,
        handleRenameNote: vi.fn().mockResolvedValue(undefined),
        handleRenameFilename: options?.onRenameFilename ?? vi.fn().mockResolvedValue(undefined),
        replaceEntry: vi.fn(),
        resolvedPath: '/vault',
        initialH1AutoRenameEnabled: false,
      })
      const folder = useFolderRename({
        activeTabPathRef,
        handleSwitchTab: setActiveTabPath,
        reloadFolders: vi.fn().mockResolvedValue([]),
        reloadVault: vi.fn().mockResolvedValue([
          makeEntry(movedChildPath, 'note.md'),
          outside,
        ]),
        selection,
        setSelection: vi.fn(),
        setTabs,
        setToastMessage: vi.fn(),
        vaultPath: '/vault',
      })

      return { save, folder, tabs }
    })
  }

  it('flushes a child note before a folder rename and saves the next edit to the new path', async () => {
    const { result } = renderRenameSave()

    await act(async () => {
      result.current.save.handleContentChange(childPath, pendingBefore)
    })

    await act(async () => {
      await result.current.folder.renameFolder('projects', 'work')
    })

    const callsAfterRename = saveCalls()
    const renameIndex = callsAfterRename.findIndex((call) => call.command === 'rename_vault_folder')
    const flushedChildIndex = callsAfterRename.findIndex((call) => (
      call.command === 'save_note_content_checked'
      && call.args?.path === childPath
      && call.args.content === pendingBefore
    ))
    expect(renameIndex).toBeGreaterThan(-1)
    expect(flushedChildIndex).toBeGreaterThan(-1)
    expect(flushedChildIndex).toBeLessThan(renameIndex)
    expect(callsAfterRename.slice(0, renameIndex).some((call) => call.args?.path === outsidePath)).toBe(false)

    await act(async () => {
      result.current.save.handleContentChange(childPath, editedAfter)
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(saveCalls().at(-1)).toEqual({
      command: 'save_note_content_checked',
      args: expect.objectContaining({ path: movedChildPath, content: editedAfter }),
    })

    await act(async () => {
      result.current.save.handleContentChange(childPath, freshAtOldPath)
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(saveCalls().at(-1)).toEqual({
      command: 'save_note_content_checked',
      args: expect.objectContaining({ path: childPath, content: freshAtOldPath }),
    })
  })

  it('keeps a pending autosave for a note outside the renamed folder', async () => {
    const { result } = renderRenameSave()

    await act(async () => {
      result.current.save.handleContentChange(outsidePath, pendingOutside)
    })

    await act(async () => {
      await result.current.folder.renameFolder('projects', 'work')
    })

    expect(saveCalls().some((call) => call.args?.path === outsidePath)).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(saveCalls().at(-1)).toEqual({
      command: 'save_note_content_checked',
      args: expect.objectContaining({ path: outsidePath, content: pendingOutside }),
    })
  })

  it('retargets a prior note rename when its folder moves', async () => {
    const pathA = '/vault/projects/note-a.md'
    const pathB = '/vault/projects/note-b.md'
    const movedPathB = '/vault/work/note-b.md'
    const renamed = makeEntry(pathA, 'note-a.md')

    const { result } = renderHook(() => {
      const [tabs, setTabs] = useState([{ entry: renamed, content: '# Note A\n\nBody' }])
      const [activeTabPath, setActiveTabPath] = useState<string | null>(pathA)
      const activeTabPathRef = useRef(activeTabPath)
      useEffect(() => {
        activeTabPathRef.current = activeTabPath
      }, [activeTabPath])

      const save = useAppSave({
        updateEntry: vi.fn(),
        setTabs,
        handleSwitchTab: setActiveTabPath,
        setToastMessage: vi.fn(),
        loadModifiedFiles: vi.fn(),
        trackUnsaved: vi.fn(),
        clearUnsaved: vi.fn(),
        unsavedPaths: new Set([pathA]),
        tabs,
        activeTabPath,
        handleRenameNote: vi.fn().mockResolvedValue(undefined),
        handleRenameFilename: vi.fn(async (path, _stem, _vaultPath, onEntryRenamed) => {
          setTabs((current) => current.map((tab) => (
            tab.entry.path === path
              ? { ...tab, entry: { ...tab.entry, path: pathB, filename: 'note-b.md' } }
              : tab
          )))
          setActiveTabPath(pathB)
          onEntryRenamed(path, { path: pathB, filename: 'note-b.md', title: 'Note A' }, '# Note A\n\nBody')
        }),
        replaceEntry: vi.fn(),
        resolvedPath: '/vault',
        initialH1AutoRenameEnabled: false,
      })
      const folder = useFolderRename({
        activeTabPathRef,
        handleSwitchTab: setActiveTabPath,
        reloadFolders: vi.fn().mockResolvedValue([]),
        reloadVault: vi.fn().mockResolvedValue([makeEntry(movedPathB, 'note-b.md')]),
        selection: { kind: 'folder', path: 'projects' },
        setSelection: vi.fn(),
        setTabs,
        setToastMessage: vi.fn(),
        vaultPath: '/vault',
      })
      return { save, folder }
    })

    await act(async () => {
      await result.current.save.handleFilenameRename(pathA, 'note-b')
    })
    await act(async () => {
      await result.current.folder.renameFolder('projects', 'work')
    })
    await act(async () => {
      result.current.save.handleContentChange(pathA, '# Note A\n\nAfter the folder move')
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(saveCalls().at(-1)).toEqual({
      command: 'save_note_content_checked',
      args: expect.objectContaining({
        path: movedPathB,
        content: '# Note A\n\nAfter the folder move',
      }),
    })
  })
})
