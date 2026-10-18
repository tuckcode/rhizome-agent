import { createHash } from 'node:crypto'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AUTO_SAVE_DEBOUNCE_MS, useEditorSave } from './useEditorSave'
import { clearStashedConflict, conflictCopyPath, subscribeSaveConflicts, useSaveNote, type SaveConflict } from './useSaveNote'
import { cacheNoteContent, clearPrefetchCache } from './useTabManagement'
import { clearSaveBaselines } from './noteContentCache'

const invokeFn = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeFn(cmd, args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
  mockInvoke: vi.fn(),
  updateMockContent: vi.fn(),
}))

const PATH = '/vault/plan.md'
const OPENED = '---\nStatus: In progress\n---\n# Plan\nfirst draft\n'
const BUFFER = '---\nStatus: In progress\n---\n# Plan\ntyped while the card moved\n'
const SPLICED = '---\nStatus: Done\n---\n# Plan\ntyped while the card moved\n'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function savedArgs(call = 0): Record<string, unknown> | undefined {
  return invokeFn.mock.calls.filter(([cmd]) => cmd === 'save_note_content_checked')[call]?.[1]
}

function tabContentAfter(setTabs: Mock): string | undefined {
  let tabs = [{ entry: { path: PATH }, content: BUFFER }]
  for (const [update] of setTabs.mock.calls) {
    tabs = typeof update === 'function' ? update(tabs) : update
  }
  return tabs[0]?.content
}

beforeEach(() => {
  invokeFn.mockReset()
  clearPrefetchCache()
  clearSaveBaselines()
})

describe('useSaveNote conflict check', () => {
  it('sends the text the editor read', async () => {
    cacheNoteContent(PATH, OPENED)
    invokeFn.mockResolvedValue({ contentHash: sha256(BUFFER), splicedContent: null })
    const updateContent = vi.fn()
    const { result } = renderHook(() => useSaveNote(updateContent))

    let saved: string | undefined
    await act(async () => {
      saved = await result.current.saveNote(PATH, BUFFER)
    })

    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
    expect(saved).toBe(BUFFER)
    expect(updateContent).toHaveBeenCalledWith(PATH, BUFFER)
  })

  it('sends no expected text when the editor has no cached text', async () => {
    invokeFn.mockResolvedValue({ contentHash: sha256(BUFFER), splicedContent: null })
    const { result } = renderHook(() => useSaveNote(vi.fn()))

    await act(async () => {
      await result.current.saveNote(PATH, BUFFER)
    })

    expect(savedArgs()?.expectedContent).toBeNull()
  })

  it('takes a spliced status as the new text and the next baseline', async () => {
    cacheNoteContent(PATH, OPENED)
    invokeFn.mockResolvedValueOnce({ contentHash: sha256(SPLICED), splicedContent: SPLICED })
    invokeFn.mockResolvedValueOnce({ contentHash: 'x', splicedContent: null })
    const updateContent = vi.fn()
    const { result } = renderHook(() => useSaveNote(updateContent))

    await act(async () => {
      expect(await result.current.saveNote(PATH, BUFFER)).toBe(SPLICED)
    })
    expect(updateContent).toHaveBeenCalledWith(PATH, SPLICED)

    await act(async () => {
      await result.current.saveNote(PATH, SPLICED)
    })
    expect(savedArgs(1)?.expectedContent).toBe(SPLICED)
  })
})

describe('useEditorSave with a board move', () => {
  let updateVaultContent: Mock
  let setTabs: Mock
  let setToastMessage: Mock

  beforeEach(() => {
    vi.useFakeTimers()
    updateVaultContent = vi.fn()
    setTabs = vi.fn()
    setToastMessage = vi.fn()
    cacheNoteContent(PATH, OPENED)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderSave() {
    return renderHook(() => useEditorSave({ updateVaultContent, setTabs, setToastMessage }))
  }

  it('autosave keeps the Done status a board wrote while the editor was dirty', async () => {
    invokeFn.mockResolvedValue({ contentHash: sha256(SPLICED), splicedContent: SPLICED })
    const { result } = renderSave()

    act(() => {
      result.current.handleContentChange(PATH, BUFFER)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
    expect(tabContentAfter(setTabs)).toBe(SPLICED)
    expect(updateVaultContent).toHaveBeenLastCalledWith(PATH, SPLICED)

    await act(async () => {
      await result.current.handleSave()
    })
    expect(setToastMessage).toHaveBeenLastCalledWith('Nothing to save')
  })

  it('keeps the pre-splice text as the baseline for edits typed during the save', async () => {
    let finishSave: (value: unknown) => void = () => {}
    invokeFn.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve }))
    invokeFn.mockResolvedValue({ contentHash: 'next', splicedContent: null })
    const { result } = renderSave()
    const newer = '---\nStatus: In progress\n---\n# Plan\ntyped while the card moved, and more\n'

    act(() => {
      result.current.handleContentChange(PATH, BUFFER)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })
    act(() => {
      result.current.handleContentChange(PATH, newer)
    })
    await act(async () => {
      finishSave({ contentHash: sha256(SPLICED), splicedContent: SPLICED })
    })
    await act(async () => {
      await result.current.handleSave()
    })

    // Rust sees disk = baseline + a Status write, and splices Done into
    // the newer text (board::tests::splice_keeps_edits_typed_during_a_spliced_save).
    expect(savedArgs(1)).toEqual({ path: PATH, content: newer, expectedContent: BUFFER })
    expect(updateVaultContent).not.toHaveBeenCalledWith(PATH, SPLICED)
  })

  it('Keep mine reads the pending text and cancels the autosave that would write over it', async () => {
    invokeFn.mockResolvedValue({ contentHash: 'x', splicedContent: null })
    const { result } = renderSave()
    const typed = `${BUFFER}later\n`
    act(() => { result.current.handleContentChange(PATH, typed) })
    let live: string | null = null
    await act(async () => { live = await result.current.holdPendingSave(PATH) })
    expect(live).toBe(typed)
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS) })
    expect(invokeFn).not.toHaveBeenCalled()
  })

  it('Keep mine waits out an in-flight autosave and keeps the newer text', async () => {
    let finishSave: (value: unknown) => void = () => {}
    invokeFn.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve }))
    const { result } = renderSave()
    act(() => { result.current.handleContentChange(PATH, BUFFER) })
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS) })
    const newer = `${BUFFER}more\n`
    act(() => { result.current.handleContentChange(PATH, newer) })
    let live: string | null = null
    await act(async () => {
      const pending = result.current.holdPendingSave(PATH)
      finishSave({ contentHash: 'x', splicedContent: null })
      live = await pending
    })
    expect(live).toBe(newer)
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS) })
    expect(invokeFn.mock.calls.filter(([cmd]) => cmd === 'save_note_content_checked')).toHaveLength(1)
    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
  })

  describe('a real conflict', () => {
    const CONFLICT = new Error('Save conflict: /vault/plan.md changed on disk since the editor read it.')
    const COPY = '/vault/plan (conflict).md'
    let conflicts: SaveConflict[]
    let unsubscribe: () => void

    beforeEach(() => {
      clearStashedConflict(PATH)
      conflicts = []
      unsubscribe = subscribeSaveConflicts((conflict) => { conflicts.push(conflict) })
      invokeFn.mockImplementation(async (cmd) => {
        if (cmd === 'save_note_content_checked') throw CONFLICT
        return null
      })
    })

    afterEach(() => { unsubscribe() })

    function calls(cmd: string) {
      return invokeFn.mock.calls.filter(([name]) => name === cmd).map(([, args]) => args)
    }

    it('stashes the buffer in a conflict copy and lets the flush finish', async () => {
      const { result } = renderSave()
      act(() => { result.current.handleContentChange(PATH, BUFFER) })

      let flushed: boolean | undefined
      await act(async () => { flushed = await result.current.savePendingForPath(PATH) })

      expect(flushed).toBe(false) // resolves, so navigation goes ahead
      expect(calls('create_note_content')).toEqual([{ path: COPY, content: BUFFER }])
      expect(conflicts).toEqual([{ path: PATH, content: BUFFER, copyPath: COPY }])
      expect(updateVaultContent).not.toHaveBeenCalled()
      expect(setToastMessage).not.toHaveBeenCalled()

      // The buffer is no longer pending, so a retry does not loop on the conflict.
      await act(async () => { await result.current.savePendingForPath(PATH) })
      expect(calls('save_note_content_checked')).toHaveLength(1)
    })

    it('a second conflict on the same note updates the same copy', async () => {
      const { result } = renderSave()
      act(() => { result.current.handleContentChange(PATH, BUFFER) })
      await act(async () => { await result.current.savePendingForPath(PATH) })
      act(() => { result.current.handleContentChange(PATH, `${BUFFER}more\n`) })
      await act(async () => { await result.current.savePendingForPath(PATH) })

      expect(calls('create_note_content')).toHaveLength(1)
      expect(calls('save_note_content')).toEqual([{ path: COPY, content: `${BUFFER}more\n` }])
      expect(conflicts.map((c) => c.copyPath)).toEqual([COPY, COPY])
    })

    it('a taken copy name moves on to the next one', async () => {
      invokeFn.mockImplementation(async (cmd, args) => {
        if (cmd === 'save_note_content_checked') throw CONFLICT
        if (cmd === 'create_note_content' && args?.path === COPY) throw new Error(`File already exists: ${COPY}`)
        return null
      })
      const { result } = renderSave()
      act(() => { result.current.handleContentChange(PATH, BUFFER) })
      await act(async () => { await result.current.savePendingForPath(PATH) })
      expect(conflicts[0]?.copyPath).toBe(conflictCopyPath(PATH, 2))
      expect(conflictCopyPath(PATH, 2)).toBe('/vault/plan (conflict 2).md')
    })

    it('Cmd+S on a conflict leaves the conflict toast alone', async () => {
      const { result } = renderSave()
      act(() => { result.current.handleContentChange(PATH, BUFFER) })
      await act(async () => { await result.current.handleSave() })
      expect(conflicts).toHaveLength(1)
      expect(setToastMessage).not.toHaveBeenCalled()
    })

    it('keeps the buffer pending when the copy cannot be written', async () => {
      invokeFn.mockImplementation(async (cmd) => {
        if (cmd === 'save_note_content_checked') throw CONFLICT
        throw new Error('disk full')
      })
      const { result } = renderSave()
      act(() => { result.current.handleContentChange(PATH, BUFFER) })
      await act(async () => {
        await expect(result.current.savePendingForPath(PATH)).rejects.toThrow('Save conflict:')
      })
      expect(conflicts).toEqual([])
      await act(async () => {
        await expect(result.current.savePendingForPath(PATH)).rejects.toThrow('Save conflict:')
      })
      expect(savedArgs(1)).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
    })
  })
})

// PROBE4–6 from the #242 hold review. The old code swapped the whole
// frontmatter with a TS parser that missed the BOM and a "--- " close,
// and dropped frontmatter typed during the save. Now the newer text goes
// out untouched, with the pre-splice text as its baseline, and Rust's
// set_status replays and splices only the Status value. The Rust half of
// each probe is board::tests::splice_keeps_edits_typed_during_a_spliced_save.
describe('edits typed during a spliced save', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function inflight(opened: string, buffer: string, spliced: string, newer: string) {
    cacheNoteContent(PATH, opened)
    let finish: (v: unknown) => void = () => {}
    invokeFn.mockImplementationOnce(() => new Promise((r) => { finish = r }))
    invokeFn.mockResolvedValue({ contentHash: 'n', splicedContent: null })
    const { result } = renderHook(() => useEditorSave({ updateVaultContent: vi.fn(), setTabs: vi.fn(), setToastMessage: vi.fn() }))
    act(() => { result.current.handleContentChange(PATH, buffer) })
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS) })
    act(() => { result.current.handleContentChange(PATH, newer) })
    await act(async () => { finish({ contentHash: 'x', splicedContent: spliced }) })
    await act(async () => { await result.current.handleSave() })
    return savedArgs(1)
  }

  it('PROBE4 a BOM note keeps the BOM and the newest body', async () => {
    const B = '\uFEFF'
    const buffer = `${B}---\nStatus: In progress\n---\nbody 1\n`
    const newer = `${B}---\nStatus: In progress\n---\nbody 12\n`
    const args = await inflight(`${B}---\nStatus: In progress\n---\nbody\n`, buffer, `${B}---\nStatus: Done\n---\nbody 1\n`, newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })

  it('PROBE5 frontmatter edited during the save survives', async () => {
    const buffer = '---\nStatus: In progress\ntitle: A\n---\nbody 1\n'
    const newer = '---\nStatus: In progress\ntitle: Renamed\n---\nbody 1\n'
    const args = await inflight('---\nStatus: In progress\ntitle: A\n---\nbody\n', buffer, '---\nStatus: Done\ntitle: A\n---\nbody 1\n', newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })

  it('sends a user-edited Status with the baseline so Rust can refuse the splice', async () => {
    const buffer = '---\nStatus: In progress\n---\nbody 1\n'
    const newer = '---\nStatus: Blocked\n---\nbody 1\n'
    const args = await inflight('---\nStatus: In progress\n---\nbody\n', buffer, '---\nStatus: Done\n---\nbody 1\n', newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })

  it('PROBE6 a trailing-space close fence keeps the newest body', async () => {
    const buffer = '---\nStatus: In progress\n--- \nbody 1\n'
    const newer = '---\nStatus: In progress\n--- \nbody 12\n'
    const args = await inflight('---\nStatus: In progress\n--- \nbody\n', buffer, '---\nStatus: Done\n--- \nbody 1\n', newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })
})
