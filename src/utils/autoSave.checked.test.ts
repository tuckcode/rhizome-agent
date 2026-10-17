import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushEditorContent } from './autoSave'
import { clearSaveBaselines, getSaveBaseline, setSaveBaseline } from '../hooks/noteContentCache'
import { clearStashedConflict, stashSaveConflict, subscribeSaveConflicts, type SaveConflict } from '../hooks/useSaveNote'

const invokeFn = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (c: string, a?: Record<string, unknown>) => invokeFn(c, a) }))
vi.mock('../mock-tauri', () => ({ isTauri: () => true, mockInvoke: vi.fn(), updateMockContent: vi.fn() }))

const PATH = '/vault/note.md'

describe('flushEditorContent fallback', () => {
  beforeEach(() => {
    invokeFn.mockReset()
    clearSaveBaselines()
  })

  it('saves through the conflict check and moves the baseline', async () => {
    setSaveBaseline(PATH, 'opened\n')
    invokeFn.mockResolvedValue({ contentHash: 'x', splicedContent: null })
    const onSaved = vi.fn()
    await flushEditorContent(PATH, {
      savePendingForPath: vi.fn().mockResolvedValue(false),
      getTabContent: () => 'typed\n',
      isUnsaved: () => true,
      onSaved,
    })
    expect(invokeFn).toHaveBeenCalledWith('save_note_content_checked', {
      path: PATH,
      content: 'typed\n',
      expectedContent: 'opened\n',
    })
    expect(getSaveBaseline(PATH)).toBe('typed\n')
    expect(onSaved).toHaveBeenCalledWith(PATH, 'typed\n')
  })

  it('PROBE7 a conflict stashes the text and lets navigation continue', async () => {
    setSaveBaseline(PATH, 'opened\n')
    clearStashedConflict(PATH)
    invokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'save_note_content_checked') throw new Error('Save conflict: changed')
      return null
    })
    const onSaved = vi.fn()
    const conflicts: SaveConflict[] = []
    const unsubscribe = subscribeSaveConflicts((conflict) => { conflicts.push(conflict) })
    await flushEditorContent(PATH, {
      savePendingForPath: vi.fn().mockResolvedValue(false),
      getTabContent: () => 'typed\n',
      isUnsaved: () => true,
      onSaved,
    })
    unsubscribe()
    expect(onSaved).toHaveBeenCalledWith(PATH, 'typed\n')
    expect(getSaveBaseline(PATH)).toBe('opened\n')
    expect(conflicts).toEqual([{ path: PATH, content: 'typed\n', copyPath: '/vault/note (conflict).md' }])
    expect(invokeFn).toHaveBeenCalledWith('create_note_content', {
      path: '/vault/note (conflict).md',
      content: 'typed\n',
    })
  })

  it('does not check the save a second time after the pending flush already conflicted', async () => {
    setSaveBaseline(PATH, 'opened\n')
    clearStashedConflict(PATH)
    invokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'save_note_content_checked') throw new Error('Save conflict: changed')
      return null
    })
    const onSaved = vi.fn()
    await flushEditorContent(PATH, {
      savePendingForPath: async () => {
        try {
          await invokeFn('save_note_content_checked', { path: PATH, content: 'typed\n' })
        } catch (error) {
          await stashSaveConflict(error, PATH, 'typed\n')
        }
        return false
      },
      getTabContent: () => 'typed\n',
      isUnsaved: () => true,
      onSaved,
    })
    const checks = invokeFn.mock.calls.filter(([cmd]) => cmd === 'save_note_content_checked')
    expect(checks).toHaveLength(1)
    expect(onSaved).toHaveBeenCalledWith(PATH, 'typed\n')
  })

  it('a failed conflict copy still blocks the flush', async () => {
    setSaveBaseline(PATH, 'opened\n')
    invokeFn.mockRejectedValue(new Error('Save conflict: changed'))
    await expect(flushEditorContent(PATH, {
      savePendingForPath: vi.fn().mockResolvedValue(false),
      getTabContent: () => 'typed\n',
      isUnsaved: () => true,
    })).rejects.toThrow('Save conflict:')
    expect(getSaveBaseline(PATH)).toBe('opened\n')
  })
})
