import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeleteActions } from './useDeleteActions'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

const { mockInvoke } = await import('../mock-tauri')
const mockInvokeFn = mockInvoke as ReturnType<typeof vi.fn>

describe('useDeleteActions', () => {
  let onDeselectNote: ReturnType<typeof vi.fn>
  let removeEntry: ReturnType<typeof vi.fn>
  let removeEntries: ReturnType<typeof vi.fn>
  let resolveVaultPathForPath: ReturnType<typeof vi.fn>
  let refreshModifiedFiles: ReturnType<typeof vi.fn>
  let reloadVault: ReturnType<typeof vi.fn>
  let setToastMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onDeselectNote = vi.fn()
    removeEntry = vi.fn()
    removeEntries = vi.fn()
    resolveVaultPathForPath = vi.fn()
    refreshModifiedFiles = vi.fn().mockResolvedValue(undefined)
    reloadVault = vi.fn().mockResolvedValue(undefined)
    setToastMessage = vi.fn()
    mockInvokeFn.mockReset()
  })

  function renderDeleteActions(options: { resolveVaultPathForPath?: (path: string) => string | null | undefined } = {}) {
    return renderHook(() =>
      useDeleteActions({
        onDeselectNote,
        removeEntry,
        removeEntries,
        resolveVaultPathForPath: options.resolveVaultPathForPath,
        refreshModifiedFiles,
        reloadVault,
        setToastMessage,
      }),
    )
  }

  async function openDeleteDialog(
    result: ReturnType<typeof renderDeleteActions>['result'],
    paths: string[],
  ) {
    if (paths.length === 1) {
      await act(async () => {
        await result.current.handleDeleteNote(paths[0])
      })
      return
    }

    act(() => {
      result.current.handleBulkDeletePermanently(paths)
    })
  }

  async function confirmCurrentDelete(result: ReturnType<typeof renderDeleteActions>['result']) {
    await act(async () => {
      await result.current.confirmDelete!.onConfirm()
    })
  }

  async function confirmDeleteAndExpectBatchCall(paths: string[], deletedPaths = paths) {
    mockInvokeFn.mockResolvedValue(deletedPaths)
    const { result } = renderDeleteActions()

    await openDeleteDialog(result, paths)
    await confirmCurrentDelete(result)

    expect(result.current.confirmDelete).toBeNull()
    expect(mockInvokeFn).toHaveBeenCalledTimes(1)
    expect(mockInvokeFn).toHaveBeenCalledWith('batch_delete_notes', { paths })

    return { result }
  }

  // --- deleteNoteFromDisk ---

  describe('deleteNoteFromDisk', () => {
    it('invokes batch_delete_notes, updates pending state, and returns true', async () => {
      let resolveDelete: ((paths: string[]) => void) | null = null
      mockInvokeFn.mockImplementation(() => new Promise((resolve) => {
        resolveDelete = resolve as (paths: string[]) => void
      }))
      const { result } = renderDeleteActions()
      let okPromise: Promise<boolean> | undefined

      act(() => {
        okPromise = result.current.deleteNoteFromDisk('/vault/a.md')
      })

      expect(result.current.pendingDeleteCount).toBe(1)
      expect(mockInvokeFn).toHaveBeenCalledWith('batch_delete_notes', { paths: ['/vault/a.md'] })
      expect(onDeselectNote).toHaveBeenCalledWith('/vault/a.md')
      expect(removeEntries).toHaveBeenCalledWith(['/vault/a.md'])
      expect(removeEntry).not.toHaveBeenCalled()
      expect(setToastMessage).toHaveBeenNthCalledWith(1, 'Deleting note...')

      let ok: boolean | undefined
      await act(async () => {
        resolveDelete?.(['/vault/a.md'])
        ok = await okPromise
      })

      expect(ok).toBe(true)
      expect(result.current.pendingDeleteCount).toBe(0)
      expect(refreshModifiedFiles).toHaveBeenCalledTimes(1)
      expect(setToastMessage).toHaveBeenLastCalledWith('Note permanently deleted')
    })

    it('passes the owning vault path when deleting a note outside the default vault', async () => {
      mockInvokeFn.mockResolvedValue(['/team/a.md'])
      resolveVaultPathForPath.mockReturnValue('/team')
      const { result } = renderDeleteActions({ resolveVaultPathForPath })

      await act(async () => {
        await result.current.deleteNoteFromDisk('/team/a.md')
      })

      expect(mockInvokeFn).toHaveBeenCalledWith('batch_delete_notes', {
        paths: ['/team/a.md'],
        vaultPath: '/team',
      })
    })

    it('reloads the vault and returns false on failure', async () => {
      mockInvokeFn.mockRejectedValue(new Error('disk full'))
      const { result } = renderDeleteActions()
      let ok: boolean | undefined
      await act(async () => {
        ok = await result.current.deleteNoteFromDisk('/vault/a.md')
      })
      expect(ok).toBe(false)
      expect(reloadVault).toHaveBeenCalledTimes(1)
      expect(refreshModifiedFiles).toHaveBeenCalledTimes(1)
      expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to delete'))
    })
  })

  // --- handleDeleteNote ---

  describe('handleDeleteNote', () => {
    it('sets confirmDelete dialog state', async () => {
      const { result } = renderDeleteActions()
      await openDeleteDialog(result, ['/vault/a.md'])
      expect(result.current.confirmDelete).not.toBeNull()
      expect(result.current.confirmDelete?.title).toBe('Delete permanently?')
    })

    it('onConfirm deletes the note and clears dialog', async () => {
      await confirmDeleteAndExpectBatchCall(['/vault/a.md'])
      expect(setToastMessage).toHaveBeenCalledWith('Note permanently deleted')
    })
  })

  // --- handleBulkDeletePermanently ---

  describe('handleBulkDeletePermanently', () => {
    it.each([
      { paths: ['/vault/a.md'], expectedTitle: 'Delete 1 note permanently?' },
      { paths: ['/vault/a.md', '/vault/b.md'], expectedTitle: 'Delete 2 notes permanently?' },
    ])('sets confirmDelete title for $expectedTitle', ({ paths, expectedTitle }) => {
      const { result } = renderDeleteActions()
      act(() => {
        result.current.handleBulkDeletePermanently(paths)
      })
      expect(result.current.confirmDelete?.title).toBe(expectedTitle)
    })

    it('onConfirm deletes all paths in one backend call and shows toast', async () => {
      await confirmDeleteAndExpectBatchCall(['/vault/a.md', '/vault/b.md'])
      expect(removeEntries).toHaveBeenCalledWith(['/vault/a.md', '/vault/b.md'])
      expect(setToastMessage).toHaveBeenCalledWith('2 notes permanently deleted')
    })

    it('splits bulk deletes by owning vault path', async () => {
      mockInvokeFn.mockImplementation(async (_command, args: { paths: string[] }) => args.paths)
      resolveVaultPathForPath.mockImplementation((path: string) => path.startsWith('/team') ? '/team' : '/personal')
      const { result } = renderDeleteActions({ resolveVaultPathForPath })

      act(() => {
        result.current.handleBulkDeletePermanently(['/personal/a.md', '/team/b.md'])
      })
      await confirmCurrentDelete(result)

      expect(mockInvokeFn).toHaveBeenCalledWith('batch_delete_notes', {
        paths: ['/personal/a.md'],
        vaultPath: '/personal',
      })
      expect(mockInvokeFn).toHaveBeenCalledWith('batch_delete_notes', {
        paths: ['/team/b.md'],
        vaultPath: '/team',
      })
      expect(setToastMessage).toHaveBeenCalledWith('2 notes permanently deleted')
    })

    it('reloads the note list when a batch delete only partially succeeds', async () => {
      await confirmDeleteAndExpectBatchCall(['/vault/a.md', '/vault/b.md'], ['/vault/a.md'])

      expect(reloadVault).toHaveBeenCalledTimes(1)
      expect(refreshModifiedFiles).toHaveBeenCalledTimes(1)
      expect(setToastMessage).toHaveBeenLastCalledWith(
        'Deleted 1 of 2 notes. The note list was reloaded to recover failed items.',
      )
    })
  })

  // --- setConfirmDelete ---

  describe('setConfirmDelete', () => {
    it('can clear confirmDelete via setConfirmDelete(null)', async () => {
      const { result } = renderDeleteActions()
      await openDeleteDialog(result, ['/vault/a.md'])
      expect(result.current.confirmDelete).not.toBeNull()
      act(() => {
        result.current.setConfirmDelete(null)
      })
      expect(result.current.confirmDelete).toBeNull()
    })
  })
})
