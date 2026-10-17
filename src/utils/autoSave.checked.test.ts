import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushEditorContent } from './autoSave'
import { clearSaveBaselines, getSaveBaseline, setSaveBaseline } from '../hooks/noteContentCache'

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

  it('a conflict writes nothing and keeps the baseline', async () => {
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
